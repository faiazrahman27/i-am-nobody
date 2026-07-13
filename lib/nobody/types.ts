export type Locale = "it" | "en";

export type ArchetypeSlug =
  | "nobody-classic"
  | "worker"
  | "chef"
  | "athlete"
  | "businessman"
  | "artist"
  | "father"
  | "dancer"
  | "builder"
  | "student"
  | "traveler"
  | "creator"
  | "dreamer"
  | "speaker"
  | "infinite";

export type BackgroundVariantSlug =
  | "canonical-taupe"
  | "warm-beige"
  | "soft-umber"
  | "deep-warm-brown";

export type ImageQuality = "low" | "medium" | "high";

export type ArtworkOutputFormat = "png" | "webp" | "jpeg";

export type NormalizedRectangle = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type CanonicalReference = Readonly<{
  id: string;
  label: string;
  publicPath: string;
  sha256: string;
  width: number;
  height: number;
  aspectRatio: number;
  role: "canonical-cover";
}>;

export type GenerationCanvas = Readonly<{
  width: number;
  height: number;
  size: `${number}x${number}`;
  aspectRatio: number;
}>;

export type BackgroundVariant = Readonly<{
  slug: BackgroundVariantSlug;
  label: string;
  prompt: string;
}>;

export type ArchetypeDefinition = Readonly<{
  slug: ArchetypeSlug;
  code: string;
  title: Readonly<Record<Locale, string>>;
  description: Readonly<Record<Locale, string>>;
  clothingPrompt: string;
  permittedProps: readonly string[];
  forbiddenDetails: readonly string[];
  defaultProp: string | null;
  active: boolean;
  displayOrder: number;
}>;

export type BrandRuleSet = Readonly<{
  version: string;
  projectName: string;

  canonicalQuestion: Readonly<Record<Locale, string>>;

  canonicalReference: CanonicalReference;

  generationCanvas: GenerationCanvas;

  modelCanvas: GenerationCanvas;

  composition: Readonly<{
    figureVisibleFrom: string;
    posture: string;
    alignment: string;

    subjectBounds: NormalizedRectangle;
    helmetBounds: NormalizedRectangle;

    typographySafeZones: Readonly<{
      title: NormalizedRectangle;
      subtitle: NormalizedRectangle;
      author: NormalizedRectangle;
    }>;
  }>;

  mask: Readonly<{
    required: readonly string[];
    forbidden: readonly string[];
  }>;

  atmosphere: Readonly<{
    required: readonly string[];
    forbidden: readonly string[];
  }>;

  globalForbiddenElements: readonly string[];

  maximumProps: number;

  defaultBackgroundVariant: BackgroundVariantSlug;
}>;

export type PromptBuildInput = Readonly<{
  archetype: ArchetypeSlug;

  clothingNotes?: string;

  moodNotes?: string;

  backgroundVariant?: BackgroundVariantSlug;

  prop?: string | null;

  variationDirection?: string;

  quality?: ImageQuality;

  outputFormat?: ArtworkOutputFormat;
}>;

export type PromptValidationIssue = Readonly<{
  field: keyof PromptBuildInput | "request";
  code: string;
  message: string;
}>;

export type PromptBuildSuccess = Readonly<{
  ok: true;

  brandVersion: string;

  promptVersion: string;

  referenceId: string;

  archetype: ArchetypeDefinition;

  generation: Readonly<{
    size: `${number}x${number}`;
    width: number;
    height: number;
    quality: ImageQuality;
    outputFormat: ArtworkOutputFormat;
    background: "opaque";
  }>;

  prompt: string;

  negativePrompt: string;

  qualityChecklist: readonly string[];
}>;

export type PromptBuildFailure = Readonly<{
  ok: false;
  issues: readonly PromptValidationIssue[];
}>;

export type PromptBuildResult =
  | PromptBuildSuccess
  | PromptBuildFailure;