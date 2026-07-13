export type ArtworkStatus =
  | "candidate"
  | "reviewing"
  | "auto_rejected"
  | "auto_review_failed"
  | "ready_for_review"
  | "approved_artwork"
  | "needs_regeneration"
  | "wrong_mask"
  | "wrong_composition"
  | "too_busy"
  | "too_literal"
  | "too_generic"
  | "approved_for_template"
  | "published"
  | "archived";

export const REVIEW_ACTIONS = [
  "approve",
  "needs_regeneration",
  "wrong_mask",
  "wrong_composition",
  "too_busy",
  "too_literal",
  "too_generic",
] as const;

export type ReviewAction =
  (typeof REVIEW_ACTIONS)[number];

const STATUS_LABELS: Readonly<
  Record<ArtworkStatus, string>
> = {
  candidate: "New",
  reviewing: "Automated review",
  auto_rejected: "Automated review failed",
  auto_review_failed: "Review service error",
  ready_for_review: "Ready for human review",
  approved_artwork: "Artwork approved",
  needs_regeneration: "Another version requested",
  wrong_mask: "Mask needs correction",
  wrong_composition: "Framing needs correction",
  too_busy: "Too busy",
  too_literal: "Too literal",
  too_generic: "Too generic",
  approved_for_template: "Template ready",
  published: "Published",
  archived: "Archived",
};

export function isArtworkStatus(
  value: unknown,
): value is ArtworkStatus {
  return (
    typeof value === "string" &&
    value in STATUS_LABELS
  );
}

export function getArtworkStatusLabel(
  value: unknown,
) {
  return isArtworkStatus(value)
    ? STATUS_LABELS[value]
    : "Awaiting review";
}

export function isReviewAction(
  value: unknown,
): value is ReviewAction {
  return (
    typeof value === "string" &&
    REVIEW_ACTIONS.includes(
      value as ReviewAction,
    )
  );
}

export function getStatusForReviewAction(
  action: ReviewAction,
): ArtworkStatus {
  return action === "approve"
    ? "approved_artwork"
    : action;
}

export function getReviewReason(
  action: ReviewAction,
) {
  switch (action) {
    case "approve":
      return null;
    case "needs_regeneration":
      return "Another version requested";
    case "wrong_mask":
      return "Mask needs correction";
    case "wrong_composition":
      return "Framing needs correction";
    case "too_busy":
      return "Too busy";
    case "too_literal":
      return "Too literal";
    case "too_generic":
      return "Too generic";
  }
}
