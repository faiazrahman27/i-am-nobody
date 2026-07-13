"use client";

import {
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import type {
  ImageQuality,
  ReviewAction,
} from "@/lib/nobody";
import styles from "../artworks.module.css";
import localStyles from "./review-actions.module.css";

const ACTIONS:
  ReadonlyArray<
    Readonly<{
      value:
        ReviewAction;
      label: string;
      approve?: boolean;
    }>
  > = [
    {
      value: "approve",
      label:
        "Approve artwork",
      approve: true,
    },
    {
      value:
        "needs_regeneration",
      label:
        "Request another version",
    },
    {
      value:
        "wrong_mask",
      label:
        "Wrong mask",
    },
    {
      value:
        "wrong_composition",
      label:
        "Wrong framing",
    },
    {
      value:
        "too_busy",
      label:
        "Too busy",
    },
    {
      value:
        "too_literal",
      label:
        "Too literal",
    },
    {
      value:
        "too_generic",
      label:
        "Too generic",
    },
  ];

const REGENERATION_REASONS =
  ACTIONS.filter(
    (action) =>
      !action.approve,
  );

type RegenerateResponse =
  Readonly<{
    ok?: boolean;
    message?: string;
    replacementVariantIds?:
      readonly string[];
  }>;

export default function ReviewActions({
  artworkId,
  initialNotes,
  canRegenerate,
}: Readonly<{
  artworkId: string;
  initialNotes: string;
  canRegenerate: boolean;
}>) {
  const router =
    useRouter();

  const [
    notes,
    setNotes,
  ] =
    useState(
      initialNotes,
    );

  const [
    pendingAction,
    setPendingAction,
  ] = useState<
    string | null
  >(null);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    isError,
    setIsError,
  ] = useState(false);

  const [
    regenerationReason,
    setRegenerationReason,
  ] =
    useState<ReviewAction>(
      "needs_regeneration",
    );

  const [
    regenerationQuality,
    setRegenerationQuality,
  ] =
    useState<ImageQuality>(
      "low",
    );

  async function submitReview(
    action: ReviewAction,
  ) {
    if (pendingAction) {
      return;
    }

    setPendingAction(
      action,
    );

    setMessage("");
    setIsError(false);

    try {
      const response =
        await fetch(
          `/api/studio/artworks/${artworkId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
                notes,
              }),
          },
        );

      const payload =
        (await response.json()) as
          Readonly<{
            ok?: boolean;
            message?: string;
          }>;

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.message ||
            "The review could not be saved.",
        );
      }

      if (
        action !==
        "approve"
      ) {
        setRegenerationReason(
          action,
        );
      }

      setMessage(
        action ===
          "approve"
          ? "Artwork approved."
          : "Review reason saved.",
      );

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The review could not be saved.",
      );
    } finally {
      setPendingAction(
        null,
      );
    }
  }

  async function regenerateArtwork() {
    if (
      pendingAction ||
      !canRegenerate
    ) {
      return;
    }

    setPendingAction(
      "regenerate",
    );

    setMessage("");
    setIsError(false);

    try {
      const response =
        await fetch(
          `/api/studio/artworks/${artworkId}/regenerate`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reason:
                  regenerationReason,

                notes,

                quality:
                  regenerationQuality,
              }),
          },
        );

      const payload =
        (await response.json()) as
          RegenerateResponse;

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.message ||
            "The corrected version could not be generated.",
        );
      }

      const replacementId =
        payload
          .replacementVariantIds
          ?.[0];

      setMessage(
        "A corrected version was generated and reviewed.",
      );

      if (replacementId) {
        router.push(
          `/studio/artworks/${replacementId}`,
        );
      } else {
        router.push(
          "/studio/artworks?filter=review",
        );
      }

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The corrected version could not be generated.",
      );
    } finally {
      setPendingAction(
        null,
      );
    }
  }

  return (
    <section
      aria-labelledby="review-title"
      className={
        styles.reviewPanel
      }
    >
      <p
        className={
          styles.eyebrow
        }
      >
        Creative decision
      </p>

      <h2 id="review-title">
        Review this artwork
      </h2>

      <label
        className={
          styles.notes
        }
      >
        <span>Notes</span>

        <textarea
          maxLength={1200}
          onChange={(event) =>
            setNotes(
              event.target
                .value,
            )
          }
          placeholder="Optional notes for the next version or for the creative team."
          rows={5}
          value={notes}
        />

        <small>
          {notes.length}/1200
        </small>
      </label>

      <div
        className={
          styles.reviewActions
        }
      >
        {ACTIONS.map(
          (action) => (
            <button
              className={
                action.approve
                  ? styles.approveButton
                  : styles.changeButton
              }
              disabled={
                pendingAction !==
                null
              }
              key={
                action.value
              }
              onClick={() =>
                submitReview(
                  action.value,
                )
              }
              type="button"
            >
              {pendingAction ===
              action.value
                ? "Saving…"
                : action.label}
            </button>
          ),
        )}
      </div>

      <div
        className={
          localStyles.regenerationBox
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Corrected version
          </p>

          <h3>
            Regenerate from this artwork
          </h3>

          <p>
            The new option reuses the
            original controlled
            archetype, clothing, mood,
            background and prop, then
            adds the selected correction
            and your notes. It is saved
            as a linked new variant.
          </p>
        </div>

        <label>
          <span>
            Correction reason
          </span>

          <select
            disabled={
              pendingAction !==
                null ||
              !canRegenerate
            }
            onChange={(event) =>
              setRegenerationReason(
                event.target
                  .value as ReviewAction,
              )
            }
            value={
              regenerationReason
            }
          >
            {REGENERATION_REASONS.map(
              (action) => (
                <option
                  key={
                    action.value
                  }
                  value={
                    action.value
                  }
                >
                  {action.label}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>
            Generation finish
          </span>

          <select
            disabled={
              pendingAction !==
                null ||
              !canRegenerate
            }
            onChange={(event) =>
              setRegenerationQuality(
                event.target
                  .value as ImageQuality,
              )
            }
            value={
              regenerationQuality
            }
          >
            <option value="low">
              Draft
            </option>

            <option value="medium">
              Standard
            </option>

            <option value="high">
              Final
            </option>
          </select>
        </label>

        <button
          className={
            styles.approveButton
          }
          disabled={
            pendingAction !==
              null ||
            !canRegenerate
          }
          onClick={
            regenerateArtwork
          }
          type="button"
        >
          {pendingAction ===
          "regenerate"
            ? "Generating and reviewing…"
            : "Generate corrected version"}
        </button>

        {!canRegenerate ? (
          <small>
            Reviewer accounts can save
            decisions but cannot spend
            image-generation credits.
          </small>
        ) : null}
      </div>

      {message ? (
        <p
          className={
            isError
              ? styles.messageError
              : styles.messageSuccess
          }
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}