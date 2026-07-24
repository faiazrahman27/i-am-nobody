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
  ArchetypeDefinition,
} from "./types";

const MAX_CUSTOM_NOTE_LENGTH = 280;
const MAX_INTERNAL_DIRECTION_LENGTH = 700;

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
  {
    code: "forbidden_text_bearing_object",
    pattern:
      /\b(phone|smartphone|screen|tablet|laptop|book|newspaper|magazine|letter|document|paperwork|passport|ticket|badge|name tag|sign|placard|label|package|clipboard|certificate)\b/i,
    message:
      "Objects that normally contain text or screens are not permitted because they can create artificial lettering.",
  },
  {
    code: "forbidden_clothing_marking",
    pattern:
      /\b(printed|lettered|numbered|slogan|insignia|emblem|patch|nameplate|brand(?:ed)?|logo)\b/i,
    message:
      "Clothing must be completely unbranded and free of letters, numbers, insignia, and printed markings.",
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

  const baseArchetype = getNobodyArchetype(
    input.archetype,
  );

  const creativeBrief = input.creativeBrief;

  const internalObject = creativeBrief?.objectDirection
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  const archetype: ArchetypeDefinition = creativeBrief
    ? {
        ...baseArchetype,
        code: "AID",
        title: {
          en: creativeBrief.roleTitle
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80),
          it: creativeBrief.roleTitle
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80),
        },
        description: {
          en: [creativeBrief.lifeContext, creativeBrief.bookTheme]
            .filter(Boolean)
            .join(" — ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 440),
          it: [creativeBrief.lifeContext, creativeBrief.bookTheme]
            .filter(Boolean)
            .join(" — ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 440),
        },
        clothingPrompt: creativeBrief.clothingDirection
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 440),
        permittedProps:
          internalObject && internalObject.toLowerCase() !== "none"
            ? [internalObject]
            : [],
        defaultProp:
          internalObject && internalObject.toLowerCase() !== "none"
            ? internalObject
            : null,
      }
    : baseArchetype;

  if (!archetype.active) {
    issues.push({
      field: "archetype",
      code: "inactive_archetype",
      message:
        "This archetype is not active for generation.",
    });
  }

  const clothingNotes = creativeBrief
    ? ""
    : normalizeOptionalText(input.clothingNotes);

  const moodNotes = creativeBrief
    ? creativeBrief.moodDirection
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_INTERNAL_DIRECTION_LENGTH)
    : normalizeOptionalText(input.moodNotes);

  const variationDirection = creativeBrief
    ? [
        `Threshold: ${creativeBrief.threshold}.`,
        `Book theme: ${creativeBrief.bookTheme}.`,
        `Human context: ${creativeBrief.lifeContext}.`,
        `Question: ${creativeBrief.conceptQuestion}.`,
        `Visual story: ${creativeBrief.visualStory}.`,
        `Body nuance: ${creativeBrief.bodyDirection}.`,
        creativeBrief.creativeDirection,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_INTERNAL_DIRECTION_LENGTH)
    : normalizeOptionalText(input.variationDirection);

  if (!creativeBrief) {
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
  } else {
    if (!archetype.title.en || archetype.title.en.length < 3) {
      issues.push({
        field: "creativeBrief",
        code: "invalid_role_title",
        message: "The AI creative brief needs a clear role title.",
      });
    }

    if (!archetype.clothingPrompt || archetype.clothingPrompt.length < 20) {
      issues.push({
        field: "creativeBrief",
        code: "invalid_clothing_direction",
        message: "The AI creative brief needs a complete clothing direction.",
      });
    }

    const controlledBriefText = [
      creativeBrief.clothingDirection,
      creativeBrief.bodyDirection,
      creativeBrief.objectDirection,
      creativeBrief.creativeDirection,
    ].join(" ");

    for (const rule of forbiddenInputPatterns) {
      if (rule.pattern.test(controlledBriefText)) {
        issues.push({
          field: "creativeBrief",
          code: rule.code,
          message: rule.message,
        });
      }
    }
  }

  const backgroundSlug = NOBODY_BRAND.defaultBackgroundVariant;

  const background =
    NOBODY_BACKGROUND_VARIANTS[backgroundSlug];

  if (!background) {
    issues.push({
      field: "backgroundVariant",
      code: "invalid_background",
      message:
        "The studio background is fixed by the production system.",
    });
  }

  const requestedProp = creativeBrief
    ? archetype.defaultProp ?? ""
    : normalizeOptionalText(input.prop ?? undefined);

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
          "brand rules and must remain refined, minimal, realistic, unbranded,",
          "and specific enough that the role can be understood before typography is added.",
          "Do not reduce the character to a vague hoodie, plain suit, generic jacket, or ordinary casual clothing.",
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
          "fixed canonical helmet position, body distance, and visual grammar.",
        ].join(" ")
      : "";

  const propSentence =
    selectedProp
      ? [
          "Include exactly one restrained role-defining object:",
          `${selectedProp}.`,
          "It must be naturally worn, carried, held, or attached to the person,",
          "never floating, displayed as a sign, or placed separately in the background.",
          "A plain backpack, school bag, satchel, shoulder bag, tote, fabric carry bag,",
          "small utility pouch, glove, or similarly restrained object is acceptable when relevant.",
          "It must have no screen, letters, numbers, labels, badges, logos, symbols, or pseudo-text.",
        ].join(" ")
      : "Do not include any separate object or prop.";

  const prompt = [
    `Create one clean vertical editorial artwork belonging to the official visual universe of “${NOBODY_BRAND.projectName}”. The person must read as a distinct individual role or life situation, not as another variation of the same generic neutral figure.`,

    "",

    [
      "CANONICAL REFERENCE:",
      `The approved I AM NOBODY cover (${NOBODY_BRAND.canonicalReference.id}) defines the production system.`,
      "Use the attached neutral composition guide and exact helmet guide for body distance,",
      "vertical framing, centred alignment, head and helmet scale, posture, background mood,",
      "light restraint, and overall elegance.",
      "Generate a completely new person and outfit. Do not copy, trace, ghost, or partially preserve",
      "the original tuxedo body, typography, frame, spine, or graphic design.",
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

    creativeBrief
      ? [
          `DAILY CONCEPT — ${creativeBrief.threshold.toUpperCase()}:`,
          creativeBrief.conceptQuestion,
          creativeBrief.visualStory,
          `Human context: ${creativeBrief.lifeContext}.`,
          `The role family is ${creativeBrief.roleFamily}.`,
        ].join(" ")
      : "",

    [
      `ARCHETYPE — ${archetype.title.en.toUpperCase()}:`,
      `Dress the figure in ${archetype.clothingPrompt}.`,
      "The clothing, materials, layering, and one restrained carried or worn object when requested",
      "must make the specific human role or life situation understandable before typography is added.",
      "Use concrete role-defining details so the person never reads as a generic man or woman.",
      "Honour the brief literally enough that a student looks like a student, a doctor looks like a doctor, a municipal worker looks like a municipal worker, and a seasonal gift-bearer still reads clearly without parody.",
      "Do not flatten everything into the same beige, taupe, grey, charcoal, or dark-jacket formula.",
      "It must feel clean, iconic, premium, realistic, restrained, and contemporary—avoid parody, caricature, cheap costume shorthand, or overloaded accessories.",
    ].join(" "),

    customClothingSentence,

    propSentence,

    "",

    [
      "VISUAL DIFFERENTIATION:",
      "Follow the daily creative brief closely. Preserve its specific garments, material contrast, silhouette, and restrained colour story.",
      "Do not default to the same loose neutral tailoring, the same overshirt, the same monochrome sweater layering, or the same generic editorial uniform from one artwork to the next.",
      "If the brief calls for a backpack, satchel, pouch, stethoscope, apron, sack, glove, or similar text-free carried signal, integrate it naturally with correct scale and anatomy.",
      "The role signal must come from the person and what they wear or carry, never from background storytelling.",
    ].join(" "),

    "",

    [
      "IMMUTABLE CANONICAL HELMET:",
      "Every archetype uses the same helmet from the original book cover.",
      "Only the clothing and social role may change; the helmet identity never changes.",
      "Match the original helmet's exact position, scale, upright angle, silhouette, visor proportions, black side structures, chin structure, and neck connection.",
      `It ${joinNaturalLanguage(NOBODY_BRAND.mask.required)}.`,
      "No human face or recognisable facial feature is visible.",
      "Do not create a second helmet outline, extra rim, alternative visor, exposed head, hair, skin, or facial feature around the canonical helmet.",
      "The production pipeline applies the verified canonical helmet pixels after generation, so the generated shoulders, collar, and neckline must connect naturally beneath that fixed helmet.",
    ].join(" "),

    "",

    [
      "LIGHTING, SHADOWS, AND PHYSICAL INTEGRATION:",
      "Use one coherent soft directional light consistent with the canonical cover.",
      "The helmet reflections, collar, shoulders, torso, sleeves, hands, and clothing folds must agree with the same light direction and exposure.",
      "Create subtle natural contact shadows where the fixed helmet meets the collar and neck opening, where fabric overlaps, and where arms meet the torso.",
      "Do not cast a dramatic body or helmet shadow onto the background wall or studio floor. Keep the figure cleanly integrated without a fake projected backdrop shadow.",
      "Do not create a large halo, echo, fringe, or second rim around the helmet. Keep the area directly around the helmet clean and simple so the verified production helmet can sit perfectly on the shoulders and collar.",
      "The helmet must feel physically worn by the figure, never floating, pasted on, glowing, outlined, or separated by a halo.",
      "Keep skin absent and preserve realistic adult anatomy, symmetrical shoulders, plausible arms, and natural hands and fingers if visible.",
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
      "and restrained cinematic depth without artificial grain,",
      "blur, over-sharpening, plastic skin, or CGI gloss.",
      "The figure must be fully opaque, physically integrated, and technically clean,",
      "with no transparency, double exposure, ghosting, scanlines, horizontal banding, or pasted overlay effect.",
      "The result must feel like an official alternate cover",
      "artwork from the same I AM NOBODY universe.",
    ].join(" "),

    moodSentence,

    variationSentence,

    "",

    [
      "OUTPUT:",
      "Artwork only.",
      "Do not include readable text, pseudo-text, letters, numbers, random glyphs, logos, labels, badges, signs, placards, signatures, or any graphic template layer.",
      "Do not add floating icons, decorative symbols, explanatory signs, or separate background objects.",
      "Use an opaque background.",
      "Maintain clean edges, realistic material detail, natural anatomy,",
      "production-ready resolution, and flawless technical cleanliness.",
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
      "skin through the visor, recognisable face, hair, exposed head,",
      "second helmet edge, extra visor, duplicate chin guard, or alternative helmet silhouette.",
    ].join(" "),

    [
      "Do not create inconsistent light directions, impossible shadows,",
      "a fake cast shadow on the background, a helmet halo, cut-out edge, floating helmet, missing contact shadow,",
      "mismatched exposure, or reflections unrelated to the body lighting.",
      "Do not create malformed shoulders, duplicated limbs, twisted arms,",
      "extra fingers, missing fingers, fused fingers, broken hands,",
      "impossible clothing seams, or warped body proportions.",
    ].join(" "),

    [
      "Do not create readable text or fake text anywhere, including random",
      "letters, numbers, symbols, badges, labels, patches, logos, signatures,",
      "screen content, paper content, or AI-like pseudo-typography.",
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

    [
      "Do not create scanlines, horizontal bands, halftone stripes, transparency,",
      "double exposure, ghosted duplicate bodies, partial original-cover overlays,",
      "pasted-on clothing, low-opacity figures, or visible edit-mask artifacts.",
    ].join(" "),

    `Do not include ${joinNaturalLanguage(
      NOBODY_BRAND.globalForbiddenElements,
    )}.`,

    [
      "Do not add more than one role-defining object.",
      "If an object is requested, keep it naturally worn, carried, held, or attached to the person.",
      "If no object is explicitly requested above, add no object.",
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