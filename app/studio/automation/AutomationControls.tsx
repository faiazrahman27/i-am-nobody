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
          enabled ? "Daily generation paused." : "Daily generation resumed.",
        );
      } else if (action === "prepare") {
        setMessage(
          payload.created === false
            ? "Today's collection is already prepared."
            : "AI planning for today's collection completed.",
        );
      } else if (action === "retryFailed") {
        setMessage(
          payload.message ||
            (payload.requeuedCount
              ? "Failed artworks returned to the queue."
              : "There are no failed artworks to retry."),
        );
      } else if (payload.processed) {
        setMessage(
          payload.processedCount === 1
            ? "One artwork passed the automated quality gate and was sent to human review."
            : `${payload.processedCount ?? 0} artworks passed the automated quality gate and were sent to human review.`,
        );
      } else if (payload.reason === "queue-empty-or-worker-active") {
        setMessage(
          "No queued artwork is available right now. Another worker may already be generating it.",
        );
      } else {
        setMessage(payload.message || "There is no queued artwork to generate.");
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

  return (
    <div className={styles.controls}>
      <button
        className={enabled ? styles.pauseButton : styles.primaryButton}
        disabled={!canManage || pending !== null}
        onClick={() =>
          run("toggle", () =>
            fetch("/api/studio/automation", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: !enabled }),
            }),
          )
        }
        type="button"
      >
        {pending === "toggle"
          ? "Saving…"
          : enabled
            ? "Pause daily generation"
            : "Resume daily generation"}
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
            ? "Preparing today's collection…"
            : "Prepare today's collection now"}
        </button>
      ) : null}

      {showGenerationRecovery ? (
        <button
          className={styles.secondaryButton}
          disabled={!canManage || pending !== null}
          onClick={() =>
            run("process", () =>
              fetch("/api/studio/automation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "process_next" }),
              }),
            )
          }
          type="button"
        >
          {pending === "process"
            ? "Generating and checking artwork…"
            : "Generate next artwork now"}
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
