"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./automation.module.css";

type AutomationPayload = Readonly<{
  ok?: boolean;
  message?: string;
  processed?: boolean;
  processedCount?: number;
  failedCount?: number;
  reason?: string;
  created?: boolean;
  requeuedCount?: number;
}>;

export default function AutomationControls({
  enabled,
  canManage,
  showPlanningRecovery,
  showGenerationRecovery,
  showFailedRecovery,
}: Readonly<{
  enabled: boolean;
  canManage: boolean;
  showPlanningRecovery: boolean;
  showGenerationRecovery: boolean;
  showFailedRecovery: boolean;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function run(action: string, callback: () => Promise<Response>) {
    if (pending || !canManage) return;

    setPending(action);
    setMessage("");
    setError(false);

    try {
      const response = await callback();
      const payload = (await response.json()) as AutomationPayload;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.message || "The automation action could not be completed.",
        );
      }

      if (action === "toggle") {
        setMessage(
          enabled
            ? "Daily automation and Supabase Cron are paused. Manual testing remains available."
            : "Daily automation and Supabase Cron are active again.",
        );
      } else if (action === "prepare") {
        setMessage(
          payload.created === false
            ? "Today’s collection is already prepared."
            : "Today’s collection was planned successfully.",
        );
      } else if (action === "retryFailed") {
        setMessage(
          payload.message ||
            (payload.requeuedCount
              ? "Failed artworks returned to the queue."
              : "There are no failed artworks to retry."),
        );
      } else if ((payload.processedCount ?? 0) > 0 || (payload.failedCount ?? 0) > 0) {
        const processedCount = payload.processedCount ?? 0;
        const failedCount = payload.failedCount ?? 0;
        const fragments: string[] = [];

        if (processedCount > 0) {
          fragments.push(
            processedCount === 1
              ? "1 artwork passed the automated gate and reached human review"
              : `${processedCount} artworks passed the automated gate and reached human review`,
          );
        }

        if (failedCount > 0) {
          fragments.push(
            failedCount === 1
              ? "1 test artwork failed; review its exact error before choosing whether to retry it"
              : `${failedCount} test artworks failed; review their exact errors before choosing whether to retry them`,
          );
        }

        setMessage(`${fragments.join(". ")}.`);
      } else if (payload.reason === "queue-empty-or-worker-active") {
        setMessage(
          "There is nothing available to claim right now. Another worker may already be processing the queue.",
        );
      } else {
        setMessage(
          payload.message ||
            "The manual test finished, but no queued artwork was available.",
        );
      }

      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error ? caught.message : "The automation action failed.",
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function toggleAutomation() {
    if (!enabled) {
      const confirmed = window.confirm(
        "Enable automatic daily generation? Supabase Cron will call the worker every ten minutes after the 08:00 Rome start until the daily queue is complete.",
      );

      if (!confirmed) return;
    }

    void run("toggle", () =>
      fetch("/api/studio/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      }),
    );
  }

  return (
    <div className={styles.controls}>
      <button
        className={enabled ? styles.pauseButton : styles.primaryButton}
        disabled={!canManage || pending !== null}
        onClick={toggleAutomation}
        type="button"
      >
        {pending === "toggle"
          ? "Saving…"
          : enabled
            ? "Pause daily automation"
            : "Enable daily automation"}
      </button>

      {showPlanningRecovery ? (
        <button
          className={styles.secondaryButton}
          disabled={!canManage || pending !== null}
          onClick={() =>
            run("prepare", () =>
              fetch("/api/studio/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "prepare_today" }),
              }),
            )
          }
          type="button"
        >
          {pending === "prepare"
            ? "Preparing today’s collection…"
            : "Prepare today’s collection now"}
        </button>
      ) : null}

      {showGenerationRecovery ? (
        <button
          className={styles.secondaryButton}
          disabled={!canManage || pending !== null}
          onClick={() =>
            run("processWave", () =>
              fetch("/api/studio/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "process_next" }),
              }),
            )
          }
          type="button"
        >
          {pending === "processWave"
            ? "Generating one test artwork…"
            : "Generate one test artwork now"}
        </button>
      ) : null}

      {showFailedRecovery ? (
        <button
          className={styles.secondaryButton}
          disabled={!canManage || pending !== null}
          onClick={() =>
            run("retryFailed", () =>
              fetch("/api/studio/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "retry_failed" }),
              }),
            )
          }
          type="button"
        >
          {pending === "retryFailed"
            ? "Returning failed artworks to the queue…"
            : "Retry failed artworks"}
        </button>
      ) : null}

      <p className={styles.helperText}>
        {enabled
          ? "Automatic daily generation is active. Supabase Cron calls the worker every ten minutes after the 08:00 Rome start. Manual testing still generates only one queued artwork per click."
          : "Manual testing mode is active. Supabase Cron is unscheduled and no automatic artwork generation will run. “Generate one test artwork now” processes exactly one queued artwork per click."}
      </p>

      {!canManage ? (
        <small>Owners and editors can manage the daily schedule.</small>
      ) : null}

      {message ? (
        <p className={error ? styles.errorMessage : styles.successMessage}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
