import "server-only";

import {
  claimNextDailyAutomationItem,
  completeDailyAutomationItem,
  ensureDailyAutomationBatch,
  failDailyAutomationItem,
} from "./automationService";

const DEFAULT_WORK_BUDGET_MS = 285_000;
const GENERATION_CONCURRENCY = 2;
const MINIMUM_WAVE_BUDGET_MS = 220_000;

const HUMAN_REVIEW_READY_STATUSES = new Set([
  "ready_for_review",
  "approved_artwork",
  "approved_for_template",
  "published",
]);

type ClaimedItem = NonNullable<
  Awaited<ReturnType<typeof claimNextDailyAutomationItem>>
>;

export type ProcessedAutomationItem = Readonly<{
  itemId: string;
  roleTitle: string;
  jobId: string;
  artworkVariantId: string;
  variantStatus: string;
}>;

export type FailedAutomationItem = Readonly<{
  itemId: string;
  roleTitle: string;
  message: string;
  retryQueued: boolean;
  variantStatus: string | null;
}>;

export type DailyAutomationWorkerResult = Readonly<{
  ok: boolean;
  processed: boolean;
  processedCount: number;
  failedCount: number;
  batchId: string | null;
  localDate: string;
  items: readonly ProcessedAutomationItem[];
  failures: readonly FailedAutomationItem[];
  reason?: string;
  message?: string;
}>;

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function normalizeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function processClaimedItem(input: {
  origin: string;
  item: ClaimedItem;
  timeout: number;
}): Promise<
  | Readonly<{ ok: true; item: ProcessedAutomationItem }>
  | Readonly<{ ok: false; item: FailedAutomationItem }>
> {
  const { origin, item, timeout } = input;

  try {
    const secret = process.env.CRON_SECRET?.trim() ?? "";
    const response = await fetch(`${origin}/api/studio/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ automationItemId: item.itemId }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });

    const payload = (await response.json()) as Readonly<{
      ok?: boolean;
      error?: string;
      message?: string;
      jobId?: string;
      variants?: ReadonlyArray<
        Readonly<{
          id?: string;
          status?: string;
          reviewSummary?: string | null;
        }>
      >;
    }>;

    const variant = payload.variants?.[0];
    const variantId = variant?.id;
    const variantStatus = variant?.status ?? null;

    const errorCode = typeof payload.error === "string" && payload.error.trim() ? payload.error.trim() : null;
    const responseStatus = response.status;

    if (!response.ok || !payload.ok || !payload.jobId || !variantId) {
      const fallbackParts = [
        responseStatus ? `Artwork generation failed (HTTP ${responseStatus}).` : "Artwork generation failed.",
        errorCode ? `Code: ${errorCode}.` : "",
        normalizeMessage(payload.message, "The scheduled artwork could not be completed."),
      ].filter(Boolean);

      const message = fallbackParts.join(" ").trim();

      const retryable = isRetryableStatus(response.status);
      const failure = await failDailyAutomationItem({
        itemId: item.itemId,
        batchId: item.batchId,
        message,
        retryable,
        preserveAttempt:
          response.status === 409 ||
          response.status === 429 ||
          payload.error === "GENERATION_ALREADY_RUNNING",
      });
      const retryQueued = failure.retryQueued;

      return {
        ok: false,
        item: {
          itemId: item.itemId,
          roleTitle: item.roleTitle,
          message,
          retryQueued,
          variantStatus,
        },
      };
    }

    if (!variantStatus || !HUMAN_REVIEW_READY_STATUSES.has(variantStatus)) {
      const fallbackReviewMessage = variantStatus === "auto_rejected"
        ? "The generated artwork did not pass the automated visual quality gate. A fresh attempt has been queued."
        : "The generated artwork could not be certified for human review. A fresh attempt has been queued.";

      const message = [
        variantStatus ? `Automatic review result: ${variantStatus}.` : "",
        normalizeMessage(variant?.reviewSummary, fallbackReviewMessage),
      ].filter(Boolean).join(" ").trim();

      const failure = await failDailyAutomationItem({
        itemId: item.itemId,
        batchId: item.batchId,
        message,
        retryable: true,
      });

      return {
        ok: false,
        item: {
          itemId: item.itemId,
          roleTitle: item.roleTitle,
          message,
          retryQueued: failure.retryQueued,
          variantStatus,
        },
      };
    }

    await completeDailyAutomationItem({
      itemId: item.itemId,
      batchId: item.batchId,
      generationJobId: payload.jobId,
      artworkVariantId: variantId,
    });

    return {
      ok: true,
      item: {
        itemId: item.itemId,
        roleTitle: item.roleTitle,
        jobId: payload.jobId,
        artworkVariantId: variantId,
        variantStatus,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The scheduled artwork worker failed.";

    const failure = await failDailyAutomationItem({
      itemId: item.itemId,
      batchId: item.batchId,
      message,
      retryable: true,
    }).catch(() => ({ retryQueued: false as const }));

    return {
      ok: false,
      item: {
        itemId: item.itemId,
        roleTitle: item.roleTitle,
        message,
        retryQueued: failure.retryQueued,
        variantStatus: null,
      },
    };
  }
}

export async function processDailyAutomationQueue(input: {
  requestUrl: string;
  itemLimit?: number;
  force?: boolean;
  workBudgetMs?: number;
}): Promise<DailyAutomationWorkerResult> {
  const startedAt = Date.now();
  const itemLimit = Math.max(1, Math.min(10, input.itemLimit ?? 10));
  const workBudgetMs = Math.max(
    60_000,
    Math.min(DEFAULT_WORK_BUDGET_MS, input.workBudgetMs ?? DEFAULT_WORK_BUDGET_MS),
  );
  const origin = new URL(input.requestUrl).origin;
  const processed: ProcessedAutomationItem[] = [];
  const failures: FailedAutomationItem[] = [];

  const batch = await ensureDailyAutomationBatch({ force: input.force === true });

  if (!batch.batchId) {
    return {
      ok: true,
      processed: false,
      processedCount: 0,
      failedCount: 0,
      batchId: null,
      localDate: batch.localDate,
      items: processed,
      failures,
      reason: batch.reason,
      message:
        batch.reason === "outside-window"
          ? "The scheduled worker is outside the Rome automation window. Use the Studio manual action to run it now."
          : undefined,
    };
  }

  while (
    processed.length + failures.length < itemLimit &&
    Date.now() - startedAt < workBudgetMs
  ) {
    const remaining = workBudgetMs - (Date.now() - startedAt);

    if (remaining < MINIMUM_WAVE_BUDGET_MS) {
      break;
    }

    const waveSize = Math.min(
      GENERATION_CONCURRENCY,
      itemLimit - processed.length - failures.length,
    );

    const claimed = (
      await Promise.all(
        Array.from({ length: waveSize }, () => claimNextDailyAutomationItem()),
      )
    ).filter((item): item is ClaimedItem => Boolean(item));

    if (claimed.length === 0) {
      break;
    }

    const timeout = Math.max(60_000, Math.min(remaining - 8_000, 275_000));
    const results = await Promise.all(
      claimed.map((item) => processClaimedItem({ origin, item, timeout })),
    );

    for (const result of results) {
      if (result.ok) {
        processed.push(result.item);
      } else {
        failures.push(result.item);
      }
    }
  }

  const firstFailure = failures[0];
  const reason =
    processed.length === 0 && failures.length === 0
      ? "queue-empty-or-worker-active"
      : undefined;

  return {
    ok: failures.length === 0,
    processed: processed.length > 0,
    processedCount: processed.length,
    failedCount: failures.length,
    batchId: batch.batchId,
    localDate: batch.localDate,
    items: processed,
    failures,
    reason,
    message: firstFailure?.message,
  };
}
