"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./automation.module.css";

export default function AutomationControls({
  enabled,
  canManage,
}: Readonly<{
  enabled: boolean;
  canManage: boolean;
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
            ? "Today's ten-artwork queue is ready."
            : payload.processed
              ? "The next artwork was created and sent to review."
              : "There is no queued artwork waiting to be processed.",
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
        {pending === "prepare" ? "Preparing…" : "Prepare today’s queue"}
      </button>

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
        {pending === "process" ? "Creating & reviewing…" : "Create next artwork now"}
      </button>

      {!canManage ? (
        <small>Owners and editors can manage the daily schedule.</small>
      ) : null}

      {message ? (
        <p className={error ? styles.errorMessage : styles.successMessage}>{message}</p>
      ) : null}
    </div>
  );
}
