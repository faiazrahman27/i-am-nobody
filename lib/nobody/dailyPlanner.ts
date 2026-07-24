import "server-only";

import { createHash } from "node:crypto";
import {
  NOBODY_BOOK_AUDIENCE_LENSES,
  NOBODY_BOOK_CHAPTERS,
  NOBODY_BOOK_CONTEXT_VERSION,
  NOBODY_BOOK_QUESTIONS,
  NOBODY_BOOK_THRESHOLDS,
  NOBODY_BOOK_VOICES,
  NOBODY_DAILY_PLANNER_SOURCEBOOK,
} from "./bookCreativeContext";
import type { BackgroundVariantSlug, ImageQuality } from "./types";
import type { NobodyThreshold } from "./types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_PLANNER_MODEL = "gpt-5.6-luna";
export const NOBODY_DAILY_PLANNER_VERSION = "3.1.0";

const THRESHOLDS: readonly NobodyThreshold[] = [
  "Nobody",
  "Somebody",
  "Anybody",
  "Infinite",
];

const FORBIDDEN_BRIEF_PATTERNS: readonly Readonly<{
  label: string;
  pattern: RegExp;
}>[] = [
  {
    label: "a text-bearing or screen-based object",
    pattern:
      /\b(phone|smartphone|screen|tablet|laptop|book|newspaper|magazine|letter|document|paperwork|passport|ticket|badge|name tag|sign|label|package|clipboard|certificate)\b/i,
  },
  {
    label: "letters, numbers, logos, badges, labels, or insignia",
    pattern:
      /\b(text|lettered|numbered|printed|slogan|logo|brand(?:ed)?|insignia|emblem|patch|nameplate|label|badge|symbol|glyph)\b/i,
  },
  {
    label: "an incompatible pose or scene",
    pattern:
      /\b(sitting|seated|leaning|profile|three-quarter|running|walking|jumping|dancing|fighting|crowd|office|street|city|classroom|kitchen|stage|landscape)\b/i,
  },
];

export type DailyAiArtworkBrief = Readonly<{
  position: number;
  roleTitle: string;
  roleFamily: string;
  lifeContext: string;
  threshold: NobodyThreshold;
  bookTheme: string;
  conceptQuestion: string;
  visualStory: string;
  clothingDirection: string;
  moodDirection: string;
  bodyDirection: string;
  objectDirection: string;
  creativeDirection: string;
}>;

export type DailyAiArtworkPlan = Readonly<{
  collectionTitle: string;
  collectionNote: string;
  items: readonly DailyAiArtworkBrief[];
  model: string;
  responseId: string | null;
  requestId: string | null;
  usage: unknown;
  rawResponse: unknown;
}>;

type RecentConcept = Readonly<{
  roleTitle: string;
  roleFamily: string;
  threshold: string;
  conceptQuestion: string;
  bookTheme: string;
  usedOn: string;
}>;

type PlannerPayload = Readonly<{
  id?: string;
  model?: string;
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

function requireEnvironmentValue(name: string, value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return normalized;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = Array.from(leftTokens).filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function makeSchema(count: number) {
  return {
    type: "object",
    properties: {
      collectionTitle: { type: "string" },
      collectionNote: { type: "string" },
      items: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          properties: {
            position: {
              type: "integer",
              minimum: 1,
              maximum: count,
            },
            roleTitle: { type: "string" },
            roleFamily: { type: "string" },
            lifeContext: { type: "string" },
            threshold: {
              type: "string",
              enum: [...THRESHOLDS],
            },
            bookTheme: { type: "string" },
            conceptQuestion: { type: "string" },
            visualStory: { type: "string" },
            clothingDirection: { type: "string" },
            moodDirection: { type: "string" },
            bodyDirection: { type: "string" },
            objectDirection: { type: "string" },
            creativeDirection: { type: "string" },
          },
          required: [
            "position",
            "roleTitle",
            "roleFamily",
            "lifeContext",
            "threshold",
            "bookTheme",
            "conceptQuestion",
            "visualStory",
            "clothingDirection",
            "moodDirection",
            "bodyDirection",
            "objectDirection",
            "creativeDirection",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["collectionTitle", "collectionNote", "items"],
    additionalProperties: false,
  } as const;
}

function extractOutputText(payload: PlannerPayload) {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;

    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error(
          `The daily creative planner refused the request: ${content.refusal}`,
        );
      }

      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  throw new Error("The daily creative planner returned no structured plan.");
}

function validatePlan(
  input: unknown,
  count: number,
  recentConcepts: readonly RecentConcept[],
):
  | Readonly<{
      ok: true;
      collectionTitle: string;
      collectionNote: string;
      items: readonly DailyAiArtworkBrief[];
    }>
  | Readonly<{
      ok: false;
      issues: readonly string[];
    }> {
  if (!input || typeof input !== "object") {
    return { ok: false, issues: ["The planner output is not an object."] };
  }

  const row = input as Record<string, unknown>;
  const sourceItems = Array.isArray(row.items) ? row.items : [];
  const issues: string[] = [];

  if (sourceItems.length !== count) {
    issues.push(`The plan must contain exactly ${count} artworks.`);
  }

  const recentRoleSet = new Set(
    recentConcepts.map((item) => normalize(item.roleTitle)),
  );
  const recentQuestionSet = new Set(
    recentConcepts.map((item) => normalize(item.conceptQuestion)),
  );
  const recentRoles = recentConcepts.map((item) => item.roleTitle);
  const recentQuestions = recentConcepts.map((item) => item.conceptQuestion);
  const usedPositions = new Set<number>();
  const usedRoles = new Set<string>();
  const usedQuestions = new Set<string>();
  const usedStories = new Set<string>();
  const roleFamilies = new Set<string>();
  const thresholds = new Set<string>();

  const items: DailyAiArtworkBrief[] = sourceItems
    .slice(0, count)
    .map((value, index) => {
      const item =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : {};

      const position = Number.isInteger(item.position)
        ? Number(item.position)
        : index + 1;
      const roleTitle = clean(item.roleTitle, 80);
      const roleFamily = clean(item.roleFamily, 60);
      const lifeContext = clean(item.lifeContext, 220);
      const threshold = THRESHOLDS.includes(item.threshold as NobodyThreshold)
        ? (item.threshold as NobodyThreshold)
        : "Nobody";
      const bookTheme = clean(item.bookTheme, 180);
      const conceptQuestion = clean(item.conceptQuestion, 220);
      const visualStory = clean(item.visualStory, 320);
      const clothingDirection = clean(item.clothingDirection, 420);
      const moodDirection = clean(item.moodDirection, 240);
      const bodyDirection = clean(item.bodyDirection, 220);
      const objectDirection = clean(item.objectDirection, 140) || "none";
      const creativeDirection = clean(item.creativeDirection, 420);

      if (position < 1 || position > count || usedPositions.has(position)) {
        issues.push(
          `Artwork ${index + 1} has an invalid or repeated position.`,
        );
      }
      usedPositions.add(position);

      const normalizedRole = normalize(roleTitle);
      const normalizedQuestion = normalize(conceptQuestion);
      const normalizedStory = normalize(visualStory);
      const normalizedFamily = normalize(roleFamily);

      if (roleTitle.length < 3)
        issues.push(`Artwork ${position} needs a clear role title.`);
      if (roleFamily.length < 3)
        issues.push(`Artwork ${position} needs a role family.`);
      if (lifeContext.length < 20)
        issues.push(`Artwork ${position} needs a real human context.`);
      if (bookTheme.length < 12)
        issues.push(`Artwork ${position} needs a book theme.`);
      if (conceptQuestion.length < 12)
        issues.push(`Artwork ${position} needs a meaningful question.`);
      if (visualStory.length < 30)
        issues.push(`Artwork ${position} needs a visual story.`);
      if (clothingDirection.length < 30)
        issues.push(`Artwork ${position} needs a clothing direction.`);
      if (moodDirection.length < 12)
        issues.push(`Artwork ${position} needs a mood direction.`);
      if (bodyDirection.length < 12)
        issues.push(`Artwork ${position} needs a body direction.`);
      if (creativeDirection.length < 30)
        issues.push(`Artwork ${position} needs a complete creative direction.`);

      const visualDirections = [
        clothingDirection,
        bodyDirection,
        objectDirection,
        creativeDirection,
      ].join(" ");

      for (const rule of FORBIDDEN_BRIEF_PATTERNS) {
        if (rule.pattern.test(visualDirections)) {
          issues.push(
            `Artwork ${position} requests ${rule.label}; replace it with a text-free, front-facing, production-safe direction.`,
          );
        }
      }

      if (
        objectDirection.toLowerCase() !== "none" &&
        objectDirection.split(/\s+/).length > 12
      ) {
        issues.push(
          `Artwork ${position} has an object direction that is too complex.`,
        );
      }

      if (usedRoles.has(normalizedRole))
        issues.push(`The role “${roleTitle}” is repeated today.`);
      if (usedQuestions.has(normalizedQuestion))
        issues.push(`A concept question is repeated today.`);
      if (usedStories.has(normalizedStory))
        issues.push(`A visual story is repeated today.`);
      if (recentRoleSet.has(normalizedRole))
        issues.push(`The recent role “${roleTitle}” was repeated.`);
      if (recentQuestionSet.has(normalizedQuestion))
        issues.push(`A recent concept question was repeated.`);
      if (
        recentRoles.some(
          (recentRole) => tokenSimilarity(roleTitle, recentRole) >= 0.8,
        )
      ) {
        issues.push(`The role “${roleTitle}” is too close to a recent role.`);
      }
      if (
        recentQuestions.some(
          (recentQuestion) =>
            tokenSimilarity(conceptQuestion, recentQuestion) >= 0.72,
        )
      ) {
        issues.push(
          "A concept question is too close to recent Studio history.",
        );
      }

      usedRoles.add(normalizedRole);
      usedQuestions.add(normalizedQuestion);
      usedStories.add(normalizedStory);
      roleFamilies.add(normalizedFamily);
      thresholds.add(threshold);

      return {
        position,
        roleTitle,
        roleFamily,
        lifeContext,
        threshold,
        bookTheme,
        conceptQuestion,
        visualStory,
        clothingDirection,
        moodDirection,
        bodyDirection,
        objectDirection,
        creativeDirection,
      };
    });

  if (roleFamilies.size < Math.min(6, count)) {
    issues.push(
      "The collection needs broader role and life-context diversity.",
    );
  }

  if (count >= 8 && thresholds.size < 4) {
    issues.push("The collection must move across all four book thresholds.");
  }

  return issues.length
    ? { ok: false, issues }
    : {
        ok: true,
        collectionTitle:
          clean(row.collectionTitle, 100) || "Morning collection",
        collectionNote: clean(row.collectionNote, 300),
        items: items.sort((a, b) => a.position - b.position),
      };
}

function buildRecentHistory(recent: readonly RecentConcept[]) {
  if (recent.length === 0) return "No previous daily concepts exist yet.";

  return recent
    .slice(0, 180)
    .map(
      (item, index) =>
        `${index + 1}. ${item.usedOn} — ${item.roleTitle} | ${item.roleFamily} | ${item.threshold} | ${item.bookTheme} | ${item.conceptQuestion}`,
    )
    .join("\n");
}

async function requestPlan(input: {
  localDate: string;
  count: number;
  quality: ImageQuality;
  backgroundVariant: BackgroundVariantSlug;
  recentConcepts: readonly RecentConcept[];
  previousIssues?: readonly string[];
}) {
  const apiKey = requireEnvironmentValue(
    "OPENAI_API_KEY",
    process.env.OPENAI_API_KEY,
  );
  const model =
    process.env.OPENAI_PLANNER_MODEL?.trim() || DEFAULT_PLANNER_MODEL;

  const instructions = [
    "You are the autonomous daily creative director for the private I AM NOBODY Image Studio.",
    `Create exactly ${input.count} original artwork briefs for ${input.localDate}.`,
    "You decide the human role or life situation, emotional tension, clothing, posture nuance, one optional object, philosophical question, and complete visual direction.",
    "Do not choose from a fixed archetype list. The role library is intentionally open-ended and must grow over time.",
    "Professions may appear, but the collection must not be dominated by professions. Include relational roles, invisible labour, inner conflicts, life transitions, civic and ecological responsibility, community, technology, body, care, disagreement, loss, renewal, and legacy when appropriate.",
    "Every brief must be visually possible as one calm, front-facing, standing figure inside the fixed I AM NOBODY visual system. Communicate the idea through clothing, material, subtle posture, and at most one small unbranded object. Never request a different background, literal environment, scenery, another person, readable text, logos, uniforms with insignia, weapons, or spectacle.",
    "Do not write image-generation boilerplate. Write precise creative briefs that make each person recognisable without becoming a costume or stereotype.",
    "Treat the embedded editorial dossier as the authoritative source for the book. Do not claim to quote or retrieve the PDF, and do not invent chapters, claims, or values outside the supplied dossier.",
    "Use the book deeply rather than decoratively: the life situation, threshold, question, clothing contradiction, posture, and mood must express one coherent philosophical tension.",
    "Usually write an original concept question for the specific person instead of copying one of the 25 Keys word for word.",
    "Do not repeat or lightly rename any role, question, or visual story in recent Studio history.",
    "The ten artworks must form a coherent morning collection but remain clearly different from one another.",
    "Use all four thresholds across a ten-item collection and at least six genuinely different role families.",
    "No more than four of the ten may be conventional professions. At least six must come from relationships, invisible labour, life stages, inner conflicts, care, community, technology, embodiment, ecology, responsibility, loss, transition, or legacy.",
    "objectDirection must be exactly the word 'none' or one simple restrained object. Do not use phones, screens, books, papers, documents, newspapers, badges, signs, labels, packages, tickets, passports, certificates, or anything likely to contain text.",
    "Clothing must contain no letters, numbers, slogans, badges, insignia, labels, patches, nameplates, logos, or pseudo-text. Prefer plain fabrics and physically believable tailoring.",
    "bodyDirection must always preserve an upright, front-facing, centred standing pose with level shoulders. Prefer hands in pockets or relaxed at the sides; never request sitting, profile, three-quarter view, leaning, action, or a complex hand gesture.",
    "Lighting and shadow direction must stay coherent with the canonical cover, including a natural contact shadow beneath the fixed helmet and physically plausible garment folds.",
    "The fixed visual identity is handled elsewhere by the production system and should not be discussed in the brief.",
    "Return only the requested structured data.",
  ].join("\n");

  const inputText = [
    `BOOK CONTEXT VERSION: ${NOBODY_BOOK_CONTEXT_VERSION}`,
    "",
    "CORE SOURCEBOOK:",
    NOBODY_DAILY_PLANNER_SOURCEBOOK,
    "",
    "FOUR THRESHOLDS:",
    ...NOBODY_BOOK_THRESHOLDS.map(
      (item) =>
        `${item.name} — Central question: ${item.centralQuestion} Meaning: ${item.meaning} Human movement: ${item.humanMovement} Visual tension: ${item.visualTension} Avoid: ${item.avoid}`,
    ),
    "",
    "COMPLETE CHAPTER-LEVEL EDITORIAL DOSSIER:",
    ...NOBODY_BOOK_CHAPTERS.map((chapter, index) => {
      const references =
        "references" in chapter && chapter.references?.length
          ? ` References: ${chapter.references.join("; ")}.`
          : "";

      return `${index + 1}. [${chapter.threshold}] ${chapter.title} — Core question: ${chapter.coreQuestion} Thesis: ${chapter.thesis} Tensions: ${chapter.tensions.join("; ")}. Human situations: ${chapter.humanSituations.join("; ")}. Visual metaphors: ${chapter.visualMetaphors.join("; ")}.${references}`;
    }),
    "",
    "PHILOSOPHICAL AND LIVING VOICES:",
    ...NOBODY_BOOK_VOICES.map((voice, index) => `${index + 1}. ${voice}`),
    "",
    "THE 25 KEYS:",
    ...NOBODY_BOOK_QUESTIONS.map(
      (question, index) => `${index + 1}. ${question}`,
    ),
    "",
    "AUDIENCE AND LIFE LENSES:",
    ...NOBODY_BOOK_AUDIENCE_LENSES.map(
      (lens, index) => `${index + 1}. ${lens}`,
    ),
    "",
    `PRODUCTION SETTINGS: ${input.quality} exploration quality; exact fixed canonical background; exactly ${input.count} artworks.`,
    "",
    "RECENT STUDIO HISTORY — DO NOT REPEAT:",
    buildRecentHistory(input.recentConcepts),
    ...(input.previousIssues?.length
      ? [
          "",
          "THE PREVIOUS PLAN WAS REJECTED FOR THESE REASONS. CORRECT ALL OF THEM:",
          ...input.previousIssues.map(
            (issue, index) => `${index + 1}. ${issue}`,
          ),
        ]
      : []),
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "medium" },
      max_output_tokens: 9000,
      instructions,
      input: inputText,
      text: {
        format: {
          type: "json_schema",
          name: "nobody_daily_artwork_plan",
          strict: true,
          schema: makeSchema(input.count),
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as PlannerPayload;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `The daily creative planner failed with status ${response.status}.`,
    );
  }

  return {
    model: payload.model || model,
    responseId: payload.id ?? null,
    requestId: response.headers.get("x-request-id"),
    usage: payload.usage ?? null,
    rawResponse: payload,
    parsed: JSON.parse(extractOutputText(payload)) as unknown,
  };
}

export async function planDailyNobodyArtworks(input: {
  localDate: string;
  count: number;
  quality: ImageQuality;
  backgroundVariant: BackgroundVariantSlug;
  recentConcepts: readonly RecentConcept[];
}): Promise<DailyAiArtworkPlan> {
  let previousIssues: readonly string[] | undefined;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await requestPlan({ ...input, previousIssues });
      const validation = validatePlan(
        response.parsed,
        input.count,
        input.recentConcepts,
      );

      if (!validation.ok) {
        previousIssues = validation.issues;
        lastError = new Error(validation.issues.join(" "));
        continue;
      }

      return {
        collectionTitle: validation.collectionTitle,
        collectionNote: validation.collectionNote,
        items: validation.items,
        model: response.model,
        responseId: response.responseId,
        requestId: response.requestId,
        usage: response.usage,
        rawResponse: response.rawResponse,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("The daily plan failed.");
    }
  }

  throw (
    lastError ??
    new Error(
      "The daily creative planner could not produce a valid collection.",
    )
  );
}

export function createConceptFingerprint(item: DailyAiArtworkBrief) {
  return createHash("sha256")
    .update(
      [
        normalize(item.roleTitle),
        normalize(item.roleFamily),
        normalize(item.threshold),
        normalize(item.bookTheme),
        normalize(item.conceptQuestion),
        normalize(item.visualStory),
        normalize(item.clothingDirection),
      ].join("|"),
    )
    .digest("hex");
}
