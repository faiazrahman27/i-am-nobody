import type {
  BackgroundVariant,
  BackgroundVariantSlug,
  BrandRuleSet,
} from "./types";

export const NOBODY_BRAND_VERSION = "1.0.0";

export const NOBODY_PROMPT_VERSION = "1.0.0";

export const NOBODY_BACKGROUND_VARIANTS: Readonly<
  Record<BackgroundVariantSlug, BackgroundVariant>
> = {
  "canonical-taupe": {
    slug: "canonical-taupe",
    label: "Canonical taupe",
    prompt:
      "a sober warm taupe textured studio wall, subtle natural tonal variation, gentle vignette, and restrained warm editorial lighting close to the original book cover",
  },

  "warm-beige": {
    slug: "warm-beige",
    label: "Warm beige",
    prompt:
      "a warm beige textured studio wall with soft natural falloff, minimal surface variation, and quiet editorial lighting",
  },

  "soft-umber": {
    slug: "soft-umber",
    label: "Soft umber",
    prompt:
      "a soft umber-brown textured studio wall with controlled shadow depth, subtle vignette, and premium low-contrast editorial lighting",
  },

  "deep-warm-brown": {
    slug: "deep-warm-brown",
    label: "Deep warm brown",
    prompt:
      "a deeper warm brown neutral studio wall, restrained texture, soft vignette, and elegant directional light without theatrical darkness",
  },
};

export const NOBODY_BRAND: BrandRuleSet = {
  version: NOBODY_BRAND_VERSION,

  projectName: "I AM NOBODY",

  canonicalQuestion: {
    it: "Chi sei quando nessuno ti guarda?",
    en: "Who are you when nobody is watching?",
  },

  canonicalReference: {
    id: "IAMN-COVER-CANONICAL-001",
    label: "Original I AM NOBODY book cover",
    publicPath: "/book-cover.png",
    sha256:
      "ad76f01fa5a6160eaca1706ba7569f06040c1e2921bf50f2ddad450d72dc0f17",
    width: 906,
    height: 1280,
    aspectRatio: 906 / 1280,
    role: "canonical-cover",
  },

  /*
   * This canvas preserves the visual proportion of the original cover while
   * keeping both dimensions divisible by 16 for GPT Image 2 generation.
   */
  generationCanvas: {
    width: 1360,
    height: 1920,
    size: "1360x1920",
    aspectRatio: 1360 / 1920,
  },

  composition: {
    figureVisibleFrom:
      "approximately upper knees or mid-thigh to the top of the helmet",

    posture:
      "standing upright, calm, composed, balanced, and restrained; hands in pockets or arms resting naturally",

    alignment:
      "single figure, front-facing, centred on the vertical axis, shoulders level, head upright, no profile or three-quarter turn",

    /*
     * Coordinates are normalized from 0 to 1.
     * They describe the intended visual grammar rather than hard image masks.
     */
    subjectBounds: {
      x: 0.2,
      y: 0.075,
      width: 0.6,
      height: 0.885,
    },

    helmetBounds: {
      x: 0.37,
      y: 0.08,
      width: 0.26,
      height: 0.255,
    },

    typographySafeZones: {
      title: {
        x: 0.29,
        y: 0.44,
        width: 0.42,
        height: 0.34,
      },

      subtitle: {
        x: 0.3,
        y: 0.785,
        width: 0.4,
        height: 0.08,
      },

      author: {
        x: 0.21,
        y: 0.91,
        width: 0.58,
        height: 0.05,
      },
    },
  },

  mask: {
    required: [
      "fully covers the human face",
      "is proportional to a real adult human head",
      "is naturally integrated with the neck and clothing",
      "has elegant black structural edges",
      "has a smooth iridescent reflective visor",
      "contains restrained blue, green, violet, and golden reflections",
      "looks mysterious and premium rather than aggressive",
    ],

    forbidden: [
      "visible eyes",
      "visible mouth",
      "visible nose",
      "visible beard",
      "recognisable human facial features",
      "motorcycle helmet styling",
      "astronaut helmet styling",
      "robot head styling",
      "monster styling",
      "superhero styling",
      "Daft Punk imitation",
      "excessive neon emission",
      "a helmet that is too small, too large, too narrow, floating, or disconnected from the body",
    ],
  },

  atmosphere: {
    required: [
      "philosophical",
      "elegant",
      "mysterious",
      "premium",
      "minimal",
      "contemporary",
      "editorial",
      "quietly cinematic",
      "photorealistic",
    ],

    forbidden: [
      "cyberpunk",
      "dystopian",
      "fantasy",
      "superhero cinema",
      "gaming character art",
      "NFT collection styling",
      "trading-card decoration",
      "horror",
      "aggression",
      "spectacle",
    ],
  },

  globalForbiddenElements: [
    "typography",
    "letters",
    "numbers",
    "logos",
    "brand marks",
    "watermarks",
    "QR codes",
    "barcodes",
    "metadata",
    "edition labels",
    "certification strips",
    "borders",
    "frames",
    "UI elements",
    "blockchain graphics",
    "claim status",
    "ownership status",
    "weapons",
    "fire",
    "explosions",
    "dramatic smoke",
    "crowds",
    "multiple people",
    "busy environments",
    "literal workplaces",
  ],

  maximumProps: 1,

  defaultBackgroundVariant: "canonical-taupe",
};