import "server-only";

import {
  NOBODY_QUALITY_CHECKLIST,
  NOBODY_HARD_REJECTION_RULES,
} from "./quality";
import {
  NOBODY_REVIEW_VERSION,
} from "./brand";
import type {
  ArchetypeDefinition,
  QualityCategoryScores,
  QualityChecklistItem,
  QualityReviewResult,
} from "./types";

const OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses";

const DEFAULT_REVIEW_MODEL =
  "gpt-5.6-luna";

const CATEGORY_NAMES = [
  "universeConsistency",
  "composition",
  "mask",
  "anonymity",
  "background",
  "archetypeClarity",
  "restraint",
  "editorialQuality",
  "templateSpace",
] as const;

type OpenAIResponsesPayload =
  Readonly<{
    id?: string;
    model?: string;
    status?: string;
    output?: ReadonlyArray<
      Readonly<{
        type?: string;
        content?: ReadonlyArray<
          Readonly<{
            type?: string;
            text?: string;
            refusal?: string;
          }>
        >;
      }>
    >;
    usage?: unknown;
    error?: Readonly<{
      message?: string;
      code?: string;
    }>;
  }>;

export type AutomatedVisualReview =
  Readonly<{
    model: string;
    requestId: string | null;
    responseId: string | null;
    reviewVersion: string;
    result: QualityReviewResult;
    rawResponse: unknown;
    usage: unknown;
  }>;

function requireEnvironmentValue(
  name: string,
  value: string | undefined,
) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `Missing required environment variable: ${name}.`,
    );
  }

  return normalized;
}

function getReviewModel() {
  return (
    process.env.OPENAI_REVIEW_MODEL
      ?.trim() ||
    DEFAULT_REVIEW_MODEL
  );
}

function extractOutputText(
  payload: OpenAIResponsesPayload,
) {
  for (
    const item of
    payload.output ?? []
  ) {
    if (item.type !== "message") {
      continue;
    }

    for (
      const content of
      item.content ?? []
    ) {
      if (
        content.type === "refusal" &&
        content.refusal
      ) {
        throw new Error(
          `Automated visual review was refused: ${content.refusal}`,
        );
      }

      if (
        content.type ===
          "output_text" &&
        content.text
      ) {
        return content.text;
      }
    }
  }

  throw new Error(
    "Automated visual review returned no structured output.",
  );
}

function makeSchema() {
  const categoryProperties =
    Object.fromEntries(
      CATEGORY_NAMES.map(
        (name) => [
          name,
          {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
        ],
      ),
    );

  return {
    type: "object",
    properties: {
      score: {
        type: "number",
        minimum: 0,
        maximum: 100,
      },
      approvedForHumanReview: {
        type: "boolean",
      },
      hardBlockers: {
        type: "array",
        items: {
          type: "string",
        },
      },
      categoryScores: {
        type: "object",
        properties:
          categoryProperties,
        required: [
          ...CATEGORY_NAMES,
        ],
        additionalProperties: false,
      },
      checklist: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rule: {
              type: "string",
            },
            passed: {
              type: "boolean",
            },
            score: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            note: {
              type: "string",
            },
          },
          required: [
            "rule",
            "passed",
            "score",
            "note",
          ],
          additionalProperties: false,
        },
      },
      issues: {
        type: "array",
        items: {
          type: "string",
        },
      },
      recommendation: {
        type: "string",
        enum: [
          "auto_reject",
          "regenerate",
          "send_to_human_review",
          "approve_with_notes",
        ],
      },
      summary: {
        type: "string",
      },
    },
    required: [
      "score",
      "approvedForHumanReview",
      "hardBlockers",
      "categoryScores",
      "checklist",
      "issues",
      "recommendation",
      "summary",
    ],
    additionalProperties: false,
  } as const;
}

function normalizeScore(
  value: unknown,
) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, value),
  );
}

function normalizeReview(
  value: unknown,
  threshold: number,
): QualityReviewResult {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "The automated visual review payload is invalid.",
    );
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const categoryRow =
    row.categoryScores &&
    typeof row.categoryScores ===
      "object"
      ? (row.categoryScores as Record<
          string,
          unknown
        >)
      : {};

  const categoryScores =
    Object.fromEntries(
      CATEGORY_NAMES.map(
        (name) => [
          name,
          normalizeScore(
            categoryRow[name],
          ),
        ],
      ),
    ) as QualityCategoryScores;

  const hardBlockers =
    Array.isArray(
      row.hardBlockers,
    )
      ? row.hardBlockers.filter(
          (
            item,
          ): item is string =>
            typeof item === "string",
        )
      : [];

  const checklist =
    Array.isArray(row.checklist)
      ? row.checklist
          .filter(
            (
              item,
            ): item is Record<
              string,
              unknown
            > => {
              return (
                Boolean(item) &&
                typeof item === "object"
              );
            },
          )
          .map(
            (
              item,
            ): QualityChecklistItem => ({
              rule:
                typeof item.rule ===
                "string"
                  ? item.rule
                  : "Unspecified rule",
              passed:
                item.passed === true,
              score:
                normalizeScore(
                  item.score,
                ),
              note:
                typeof item.note ===
                "string"
                  ? item.note
                  : "",
            }),
          )
      : [];

  const issues =
    Array.isArray(row.issues)
      ? row.issues.filter(
          (
            item,
          ): item is string =>
            typeof item === "string",
        )
      : [];

  const score = normalizeScore(
    row.score,
  );

  const approvedForHumanReview =
    score >= threshold &&
    hardBlockers.length === 0;

  let recommendation:
    QualityReviewResult["recommendation"] =
      approvedForHumanReview
        ? "send_to_human_review"
        : "regenerate";

  if (
    row.recommendation ===
      "auto_reject" ||
    row.recommendation ===
      "regenerate" ||
    row.recommendation ===
      "send_to_human_review" ||
    row.recommendation ===
      "approve_with_notes"
  ) {
    recommendation =
      row.recommendation;
  }

  if (
    !approvedForHumanReview &&
    recommendation ===
      "approve_with_notes"
  ) {
    recommendation =
      "regenerate";
  }

  return {
    score,
    approvedForHumanReview,
    hardBlockers,
    categoryScores,
    checklist,
    issues,
    recommendation,
    summary:
      typeof row.summary ===
        "string" &&
      row.summary.trim()
        ? row.summary.trim()
        : "Automated visual review completed.",
  };
}

function toDataUrl(
  buffer: Buffer,
  mimeType: "image/png",
) {
  return `data:${mimeType};base64,${buffer.toString(
    "base64",
  )}`;
}

export async function reviewNobodyArtwork(
  input: {
    canonicalCover: Buffer;
    artwork: Buffer;
    archetype: ArchetypeDefinition;
    threshold: number;
  },
): Promise<AutomatedVisualReview> {
  const apiKey =
    requireEnvironmentValue(
      "OPENAI_API_KEY",
      process.env.OPENAI_API_KEY,
    );

  const model =
    getReviewModel();

  const threshold = Math.max(
    0,
    Math.min(100, input.threshold),
  );

  const instructions = [
    "You are the strict visual quality controller for the official I AM NOBODY project.",
    "Compare image 1, the canonical book cover, with image 2, the newly generated clean artwork.",
    `The intended archetype is ${input.archetype.title.en}.`,
    `The clothing direction is: ${input.archetype.clothingPrompt}.`,
    "Judge visual identity and production suitability, not whether the two images are pixel-identical.",
    "The new artwork must contain no typography, border, spine, QR code, logo, author name, metadata, or template layer.",
    "A hard blocker means the image must not proceed to human review.",
    `Use the full 0-100 range. A score of ${threshold} is the minimum for human review.`,
    "Do not be generous merely because the image is attractive.",
    "",
    "Mandatory checklist:",
    ...NOBODY_QUALITY_CHECKLIST.map(
      (rule, index) =>
        `${index + 1}. ${rule}`,
    ),
    "",
    "Hard rejection rules:",
    ...NOBODY_HARD_REJECTION_RULES.map(
      (rule, index) =>
        `${index + 1}. ${rule}`,
    ),
    "",
    "Return a checklist item for every mandatory checklist rule, in the same order.",
  ].join("\n");

  const response = await fetch(
    OPENAI_RESPONSES_URL,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 4000,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: instructions,
              },
              {
                type: "input_image",
                image_url: toDataUrl(
                  input.canonicalCover,
                  "image/png",
                ),
                detail: "high",
              },
              {
                type: "input_image",
                image_url: toDataUrl(
                  input.artwork,
                  "image/png",
                ),
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name:
              "nobody_visual_review",
            strict: true,
            schema: makeSchema(),
          },
        },
      }),
      cache: "no-store",
      signal:
        AbortSignal.timeout(
          160_000,
        ),
    },
  );

  const payload =
    (await response.json()) as
      OpenAIResponsesPayload;

  if (!response.ok) {
    const code =
      payload.error?.code
        ? ` (${payload.error.code})`
        : "";

    throw new Error(
      `${
        payload.error?.message ||
        `Automated visual review failed with status ${response.status}.`
      }${code}`,
    );
  }

  const outputText =
    extractOutputText(payload);

  const parsed =
    JSON.parse(
      outputText,
    ) as unknown;

  return {
    model:
      payload.model || model,
    requestId:
      response.headers.get(
        "x-request-id",
      ),
    responseId:
      payload.id ?? null,
    reviewVersion:
      NOBODY_REVIEW_VERSION,
    result:
      normalizeReview(
        parsed,
        threshold,
      ),
    rawResponse: payload,
    usage:
      payload.usage ?? null,
  };
}
