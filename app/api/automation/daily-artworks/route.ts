import { NextResponse } from "next/server";
import {
  claimNextDailyAutomationItem,
  completeDailyAutomationItem,
  ensureDailyAutomationBatch,
  failDailyAutomationItem,
} from "@/lib/nobody/automationService";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { assertNobodyRuntimeReady } from "@/lib/nobody/runtimeConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const WORK_BUDGET_MS = 285_000;
const GENERATION_CONCURRENCY = 3;
const MINIMUM_WAVE_BUDGET_MS = 55_000;

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

type ProcessedItem = Readonly<{
  itemId: string;
  roleTitle: string;
  jobId: string;
  artworkVariantId: string;
}>;

type FailedItem = Readonly<{
  itemId: string;
  roleTitle: string;
  message: string;
}>;

async function processClaimedItem(input: {
  request: Request;
  item: NonNullable<Awaited<ReturnType<typeof claimNextDailyAutomationItem>>>;
  timeout: number;
}): Promise<
  | Readonly<{ ok: true; item: ProcessedItem }>
  | Readonly<{ ok: false; item: FailedItem }>
> {
  const { request, item, timeout } = input;

  try {
    const origin = new URL(request.url).origin;
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
      message?: string;
      jobId?: string;
      variants?: ReadonlyArray<Readonly<{ id: string }>>;
    }>;

    const variantId = payload.variants?.[0]?.id;

    if (!response.ok || !payload.ok || !payload.jobId || !variantId) {
      const message =
        payload.message || "The scheduled artwork could not be completed.";

      await failDailyAutomationItem({
        itemId: item.itemId,
        batchId: item.batchId,
        message,
        retryable: isRetryableStatus(response.status),
      });

      return {
        ok: false,
        item: {
          itemId: item.itemId,
          roleTitle: item.roleTitle,
          message,
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
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The scheduled artwork worker failed.";

    await failDailyAutomationItem({
      itemId: item.itemId,
      batchId: item.batchId,
      message,
      retryable: true,
    }).catch(() => undefined);

    return {
      ok: false,
      item: {
        itemId: item.itemId,
        roleTitle: item.roleTitle,
        message,
      },
    };
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized scheduled request." },
      { status: 401 },
    );
  }

  try {
    assertNobodyRuntimeReady();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The Studio runtime configuration is invalid.",
      },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const requestUrl = new URL(request.url);
  const requestedLimit = Number(requestUrl.searchParams.get("limit") ?? "10");
  const itemLimit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(10, requestedLimit))
    : 10;

  const processed: ProcessedItem[] = [];
  const failures: FailedItem[] = [];

  try {
    const batch = await ensureDailyAutomationBatch();

    if (!batch.batchId) {
      return NextResponse.json({
        ok: true,
        processed: false,
        processedCount: 0,
        reason: batch.reason,
        localDate: batch.localDate,
      });
    }

    while (
      processed.length + failures.length < itemLimit &&
      Date.now() - startedAt < WORK_BUDGET_MS
    ) {
      const remaining = WORK_BUDGET_MS - (Date.now() - startedAt);

      if (remaining < MINIMUM_WAVE_BUDGET_MS) {
        break;
      }

      const waveSize = Math.min(
        GENERATION_CONCURRENCY,
        itemLimit - processed.length - failures.length,
      );

      const claimed = (
        await Promise.all(
          Array.from({ length: waveSize }, () =>
            claimNextDailyAutomationItem(),
          ),
        )
      ).filter(
        (
          item,
        ): item is NonNullable<
          Awaited<ReturnType<typeof claimNextDailyAutomationItem>>
        > => Boolean(item),
      );

      if (claimed.length === 0) {
        break;
      }

      const timeout = Math.max(20_000, Math.min(remaining - 5_000, 280_000));

      const results = await Promise.all(
        claimed.map((item) => processClaimedItem({ request, item, timeout })),
      );

      for (const result of results) {
        if (result.ok) {
          processed.push(result.item);
        } else {
          failures.push(result.item);
        }
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      processed: processed.length > 0,
      processedCount: processed.length,
      failedCount: failures.length,
      batchId: batch.batchId,
      localDate: batch.localDate,
      items: processed,
      failures,
      reason:
        processed.length === 0 && failures.length === 0
          ? "queue-empty-or-worker-active"
          : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        processed: processed.length > 0,
        processedCount: processed.length,
        failedCount: failures.length,
        items: processed,
        failures,
        message:
          error instanceof Error
            ? error.message
            : "The scheduled artwork worker failed.",
      },
      { status: 500 },
    );
  }
}
