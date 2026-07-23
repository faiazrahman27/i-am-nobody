"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./automation.module.css";

export default function AutomationControls({
  enabled,
  canManage,
  showPlanningRecovery,
  showGenerationRecovery,
}: Readonly<{
  enabled: boolean;
  canManage: boolean;
  showPlanningRecovery: boolean;
  showGenerationRecovery: boolean;
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
      const payload = (await response.json()) as Readonly<{
        ok?: boolean;
        message?: string;
        processed?: boolean;
        reason?: string;
      }>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "The automation action could not be completed.");
      }

      setMessage(
        action === "toggle"
          ? enabled
            ? "Daily generation paused."
            : "Daily generation resumed."
          : action === "prepare"
            ? "AI planning for today's collection completed."
            : payload.processed
              ? "The pending artwork was generated and sent to review."
              : "There is no pending artwork to retry.",
      );
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "The automation action failed.");
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
        {pending === "toggle" ? "Saving…" : enabled ? "Pause daily generation" : "Resume daily generation"}
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
          {pending === "prepare" ? "Retrying AI planning…" : "Retry AI planning"}
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
          {pending === "process" ? "Retrying generation…" : "Retry pending generation"}
        </button>
      ) : null}

      {!canManage ? (
        <small>Owners and editors can manage the daily schedule.</small>
      ) : null}

      {message ? (
        <p className={error ? styles.errorMessage : styles.successMessage}>{message}</p>
      ) : null}
    </div>
  );
}
