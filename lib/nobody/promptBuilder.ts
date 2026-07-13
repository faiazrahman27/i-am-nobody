import {
  NOBODY_BACKGROUND_VARIANTS,
  NOBODY_BRAND,
  NOBODY_PROMPT_VERSION,
} from "./brand";

import {
  getNobodyArchetype,
  isNobodyArchetypeSlug,
} from "./archetypes";

import {
  NOBODY_QUALITY_CHECKLIST,
} from "./quality";

import type {
  PromptBuildFailure,
  PromptBuildInput,
  PromptBuildResult,
  PromptValidationIssue,
} from "./types";

const MAX_CUSTOM_NOTE_LENGTH = 280;

const forbiddenInputPatterns: readonly Readonly<{
  code: string;
  pattern: RegExp;
  message: string;
}>[] = [
  {
    code: "forbidden_text_layer",
    pattern:
      /\b(text|typography|title|subtitle|caption|logo|watermark|qr|barcode|edition|certificate|metadata)\b/i,
    message:
      "Text, logos, QR codes, and metadata belong to the template layer, not the artwork prompt.",
  },

  {
    code: "forbidden_visual_genre",
    pattern:
      /\b(cyberpunk|superhero|astronaut|biker|robot|monster|fantasy|warrior|gaming|nft|trading card|horror)\b/i,
    message:
      "The requested direction conflicts with the I AM NOBODY visual grammar.",
  },

  {
    code: "forbidden_action",
    pattern:
      /\b(running|jumping|fighting|dancing|action pose|explosion|flames?|weapon|gun|sword)\b/i,
    message:
      "The character must remain standing, calm, front-facing, and composed.",
  },

  {
    code: "forbidden_environment",
    pattern:
      /\b(kitchen|office|gym|stadium|street|city|airport|classroom|construction site|landscape|stage|crowd)\b/i,
    message:
      "The archetype must be communicated through clothing, not a literal environment.",
  },
];

function normalizeOptionalText(
  value: string | undefined,
) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CUSTOM_NOTE_LENGTH);
}

function validateCustomText(
  field:
    | "clothingNotes"
    | "moodNotes"
    | "variationDirection",
  value: string,
): PromptValidationIssue[] {
  if (!value) {
    return [];
  }

  const issues: PromptValidationIssue[] = [];

  if (value.length >= MAX_CUSTOM_NOTE_LENGTH) {
    issues.push({
      field,
      code: "note_too_long",
      message:
        `${field} must be shorter than ` +
        `${MAX_CUSTOM_NOTE_LENGTH} characters.`,
    });
  }

  for (const rule of forbiddenInputPatterns) {
    if (rule.pattern.test(value)) {
      issues.push({
        field,
        code: rule.code,
        message: rule.message,
      });
    }
  }

  return issues;
}

function failure(
  issues: readonly PromptValidationIssue[],
): PromptBuildFailure {
  return {
    ok: false,
    issues,
  };
}

function joinNaturalLanguage(
  items: readonly string[],
) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return (
    `${items.slice(0, -1).join(", ")}, and ` +
    `${items[items.length - 1]}`
  );
}

export function buildNobodyArtworkPrompt(
  input: PromptBuildInput,
): PromptBuildResult {
  const issues: PromptValidationIssue[] = [];

  if (!isNobodyArchetypeSlug(input.archetype)) {
    issues.push({
      field: "archetype",
      code: "invalid_archetype",
      message:
        "Choose one of the controlled I AM NOBODY archetypes.",
    });

    return failure(issues);
  }

  const archetype = getNobodyArchetype(
    input.archetype,
  );

  if (!archetype.active) {
    issues.push({
      field: "archetype",
      code: "inactive_archetype",
      message:
        "This archetype is not active for generation.",
    });
  }

  const clothingNotes = normalizeOptionalText(
    input.clothingNotes,
  );

  const moodNotes = normalizeOptionalText(
    input.moodNotes,
  );

  const variationDirection = normalizeOptionalText(
    input.variationDirection,
  );

  issues.push(
    ...validateCustomText(
      "clothingNotes",
      clothingNotes,
    ),
  );

  issues.push(
    ...validateCustomText(
      "moodNotes",
      moodNotes,
    ),
  );

  issues.push(
    ...validateCustomText(
      "variationDirection",
      variationDirection,
    ),
  );

  const backgroundSlug =
    input.backgroundVariant ??
    NOBODY_BRAND.defaultBackgroundVariant;

  const background =
    NOBODY_BACKGROUND_VARIANTS[backgroundSlug];

  if (!background) {
    issues.push({
      field: "backgroundVariant",
      code: "invalid_background",
      message:
        "Choose one of the controlled warm neutral background variants.",
    });
  }

  const requestedProp = normalizeOptionalText(
    input.prop ?? undefined,
  );

  if (requestedProp) {
    if (archetype.permittedProps.length === 0) {
      issues.push({
        field: "prop",
        code: "prop_not_allowed",
        message:
          `${archetype.title.en} does not permit a prop ` +
          "in the current brand definition.",
      });
    } else if (
      !archetype.permittedProps.includes(
        requestedProp,
      )
    ) {
      issues.push({
        field: "prop",
        code: "unapproved_prop",
        message:
          `Approved props for ${archetype.title.en}: ` +
          `${archetype.permittedProps.join(", ")}.`,
      });
    }
  }

  if (issues.length > 0) {
    return failure(issues);
  }

  const selectedProp =
    requestedProp || archetype.defaultProp;

  const generation = {
    size: NOBODY_BRAND.generationCanvas.size,

    width:
      NOBODY_BRAND.generationCanvas.width,

    height:
      NOBODY_BRAND.generationCanvas.height,

    quality:
      input.quality ?? "medium",

    outputFormat:
      input.outputFormat ?? "png",

    background: "opaque" as const,
  };

  const customClothingSentence =
    clothingNotes
      ? [
          "Additional approved clothing direction:",
          `${clothingNotes}.`,
          "This direction is secondary to the canonical",
          "brand rules and must remain refined, minimal,",
          "realistic, and unbranded.",
        ].join(" ")
      : "";

  const moodSentence =
    moodNotes
      ? [
          "Additional approved mood nuance:",
          `${moodNotes}.`,
          "Keep it subtle and within the established",
          "warm editorial atmosphere.",
        ].join(" ")
      : "";

  const variationSentence =
    variationDirection
      ? [
          "Creative direction:",
          `${variationDirection}.`,
          "Change only restrained secondary details;",
          "preserve the same Nobody identity, composition,",
          "mask logic, body distance, and visual grammar.",
        ].join(" ")
      : "";

  const propSentence =
    selectedProp
      ? [
          "Include exactly one restrained symbolic prop:",
          `${selectedProp}.`,
          "It must remain visually secondary and must not",
          "explain the whole archetype.",
        ].join(" ")
      : "Do not include any prop.";

  const prompt = [
    `Create one clean vertical editorial artwork belonging to the official visual universe of “${NOBODY_BRAND.projectName}”.`,

    "",

    [
      "CANONICAL REFERENCE:",
      "Use the supplied original I AM NOBODY book cover",
      `(${NOBODY_BRAND.canonicalReference.id})`,
      "as the highest visual authority for body distance,",
      "vertical framing, centred alignment, head and helmet",
      "scale, posture, background mood, light restraint,",
      "and overall elegance.",
      "Preserve the same visual grammar without copying",
      "any typography from the cover.",
    ].join(" "),

    "",

    [
      "COMPOSITION:",
      "Show exactly one anonymous adult human figure.",
      "The figure is standing upright, front-facing,",
      "perfectly centred, calm, composed, and visually",
      "dominant without being oversized.",
      "Frame the figure from approximately the upper knees",
      "or mid-thigh to the top of the helmet, with body",
      "presence close to the original cover.",
      "Keep the shoulders level and the head upright.",
      "Hands may rest naturally or remain in pockets.",
      "Leave balanced, controlled visual space so typography",
      "can be applied later as a separate design layer.",
    ].join(" "),

    "",

    [
      `ARCHETYPE — ${archetype.title.en.toUpperCase()}:`,
      `Dress the figure in ${archetype.clothingPrompt}.`,
      "The clothing alone should suggest the social role.",
      "It must feel clean, iconic, premium, realistic,",
      "restrained, and contemporary—not theatrical, literal,",
      "comedic, or costume-like.",
    ].join(" "),

    customClothingSentence,

    propSentence,

    "",

    [
      "MASK:",
      "The head is fully covered by the canonical Nobody mask.",
      `It ${joinNaturalLanguage(NOBODY_BRAND.mask.required)}.`,
      "No human face or recognisable facial feature is visible.",
      "The visor reflection is elegant and controlled,",
      "not a source of neon light.",
      "The helmet must feel like the same iconic Nobody",
      "presence seen on the original cover,",
      "not a new character design.",
    ].join(" "),

    "",

    [
      "BACKGROUND:",
      `${background.prompt}.`,
      "The background supports the figure but does not",
      "describe the archetype.",
      "It contains no literal workplace, architecture,",
      "landscape, crowd, narrative event,",
      "or decorative symbolism.",
    ].join(" "),

    "",

    [
      "MOOD AND IMAGE CHARACTER:",
      `${joinNaturalLanguage(NOBODY_BRAND.atmosphere.required)}.`,
      "Photographic editorial realism, believable tailoring",
      "and materials, natural body proportions,",
      "soft controlled contrast, subtle surface texture,",
      "and restrained cinematic depth.",
      "The result must feel like an official alternate cover",
      "artwork from the same I AM NOBODY universe.",
    ].join(" "),

    moodSentence,

    variationSentence,

    "",

    [
      "OUTPUT:",
      "Artwork only.",
      "Do not include text or any graphic template layer.",
      "Use an opaque background.",
      "Maintain clean edges, realistic material detail,",
      "natural anatomy, and production-ready resolution.",
    ].join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  const negativePrompt = [
    [
      "Do not create a random AI poster, generic sci-fi avatar,",
      "NFT collectible, trading card, movie poster, cyberpunk",
      "scene, superhero, robot, astronaut, biker, soldier,",
      "fantasy warrior, gaming character, monster,",
      "or horror character.",
    ].join(" "),

    `Do not include ${joinNaturalLanguage(
      NOBODY_BRAND.mask.forbidden,
    )}.`,

    [
      "Do not show any visible eye, mouth, nose, beard,",
      "skin through the visor, or recognisable face.",
    ].join(" "),

    [
      "Do not crop to a close-up portrait.",
      "Do not make the figure tiny or lost in the frame.",
      "Do not use profile, three-quarter view, crouching,",
      "sitting, running, jumping, fighting, dancing,",
      "or exaggerated gestures.",
    ].join(" "),

    `Do not include ${joinNaturalLanguage(
      archetype.forbiddenDetails,
    )}.`,

    [
      "Do not use a busy environment, literal workplace,",
      "city, street, office, kitchen, gym, stadium, classroom,",
      "airport, construction site, stage, landscape, fire,",
      "smoke, explosion, crowd, or excessive symbolic storytelling.",
    ].join(" "),

    [
      "Do not use cartoon, anime, comic-book, illustration,",
      "painterly, toy, plastic-render, videogame,",
      "or overly retouched CGI styling.",
    ].join(" "),

    `Do not include ${joinNaturalLanguage(
      NOBODY_BRAND.globalForbiddenElements,
    )}.`,

    [
      "Do not add more than one prop.",
      "If a prop is not explicitly requested above,",
      "add no prop.",
    ].join(" "),

    [
      "Do not imitate another artist, franchise, film,",
      "musician, fashion campaign, or helmet design.",
    ].join(" "),
  ].join("\n");

  return {
    ok: true,

    brandVersion:
      NOBODY_BRAND.version,

    promptVersion:
      NOBODY_PROMPT_VERSION,

    referenceId:
      NOBODY_BRAND.canonicalReference.id,

    archetype,

    generation,

    prompt,

    negativePrompt,

    qualityChecklist:
      NOBODY_QUALITY_CHECKLIST,
  };
}