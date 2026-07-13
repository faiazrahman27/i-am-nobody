"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewAction } from "@/lib/nobody";
import styles from "../artworks.module.css";

const ACTIONS: ReadonlyArray<
  Readonly<{
    value: ReviewAction;
    label: string;
    approve?: boolean;
  }>
> = [
  { value: "approve", label: "Approve artwork", approve: true },
  { value: "needs_regeneration", label: "Request another version" },
  { value: "wrong_mask", label: "Wrong mask" },
  { value: "wrong_composition", label: "Wrong framing" },
  { value: "too_busy", label: "Too busy" },
  { value: "too_literal", label: "Too literal" },
  { value: "too_generic", label: "Too generic" },
];

export default function ReviewActions({
  artworkId,
  initialNotes,
}: Readonly<{
  artworkId: string;
  initialNotes: string;
}>) {
  const router = useRouter();

  const [notes, setNotes] = useState(initialNotes);
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submitReview(action: ReviewAction) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`/api/studio/artworks/${artworkId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          notes,
        }),
      });

      const payload = (await response.json()) as Readonly<{
        ok?: boolean;
        message?: string;
      }>;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "The review could not be saved.");
      }

      setMessage(action === "approve" ? "Artwork approved." : "Review saved.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "The review could not be saved.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-labelledby="review-title" className={styles.reviewPanel}>
      <p className={styles.eyebrow}>Creative decision</p>
      <h2 id="review-title">Review this artwork</h2>

      <label className={styles.notes}>
        <span>Notes</span>

        <textarea
          maxLength={1200}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional notes for the next version or for the creative team."
          rows={5}
          value={notes}
        />

        <small>{notes.length}/1200</small>
      </label>

      <div className={styles.reviewActions}>
        {ACTIONS.map((action) => (
          <button
            className={action.approve ? styles.approveButton : styles.changeButton}
            disabled={pendingAction !== null}
            key={action.value}
            onClick={() => submitReview(action.value)}
            type="button"
          >
            {pendingAction === action.value ? "Saving…" : action.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className={isError ? styles.messageError : styles.messageSuccess}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
