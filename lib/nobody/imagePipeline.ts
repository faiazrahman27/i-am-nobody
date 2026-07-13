import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NOBODY_BRAND } from "./brand";
import type { ImageQuality } from "./types";

const OPENAI_IMAGES_EDIT_URL =
  "https://api.openai.com/v1/images/edits";

const SUPPORTED_IMAGE_MODELS = [
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
] as const;

type SupportedImageModel =
  (typeof SUPPORTED_IMAGE_MODELS)[number];

type OpenAIImageResponse = Readonly<{
  data?: ReadonlyArray<
    Readonly<{ b64_json?: string }>
  >;
  usage?: unknown;
  error?: Readonly<{
    message?: string;
    type?: string;
    code?: string;
  }>;
}>;

export type CanonicalReferenceAssets =
  Readonly<{
    originalCover: Buffer;
    compositionReference: Buffer;
    helmetReference: Buffer;
    sha256: string;
  }>;

export type GeneratedArtwork = Readonly<{
  rawModelImage: Buffer;
  cleanArtworkImage: Buffer;
  thumbnailImage: Buffer;
  sha256: string;
  technicalValidation: Readonly<{
    width: number;
    height: number;
    format: "png";
    hasAlpha: boolean;
    canonicalRatio: number;
  }>;
}>;

export type ImageGenerationBatch = Readonly<{
  model: SupportedImageModel;
  modelSize: `${number}x${number}`;
  requestId: string | null;
  results: readonly GeneratedArtwork[];
  usage: unknown;
  referenceSha256: string;
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

function getOpenAIImageModel():
  SupportedImageModel {
  const configured =
    process.env.OPENAI_IMAGE_MODEL?.trim() ||
    "gpt-image-2-2026-04-21";

  if (
    !SUPPORTED_IMAGE_MODELS.includes(
      configured as SupportedImageModel,
    )
  ) {
    throw new Error(
      `OPENAI_IMAGE_MODEL must be one of: ${SUPPORTED_IMAGE_MODELS.join(
        ", ",
      )}.`,
    );
  }

  return configured as SupportedImageModel;
}

function getCanonicalPath() {
  return path.join(
    process.cwd(),
    "public",
    NOBODY_BRAND.canonicalReference
      .publicPath.replace(/^\//, ""),
  );
}

function sha256(buffer: Buffer) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

async function blurRegion(
  input: Buffer,
  region: {
    left: number;
    top: number;
    width: number;
    height: number;
    sigma: number;
  },
) {
  return sharp(input)
    .extract({
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
    })
    .blur(region.sigma)
    .png()
    .toBuffer();
}

async function buildCompositionReference(
  originalCover: Buffer,
) {
  const { width, height } =
    NOBODY_BRAND.canonicalReference;

  const blurredRegions = await Promise.all([
    blurRegion(originalCover, {
      left: 290,
      top: 560,
      width: 350,
      height: 420,
      sigma: 22,
    }),
    blurRegion(originalCover, {
      left: 270,
      top: 990,
      width: 380,
      height: 105,
      sigma: 16,
    }),
    blurRegion(originalCover, {
      left: 245,
      top: 1135,
      width: 430,
      height: 75,
      sigma: 14,
    }),
    blurRegion(originalCover, {
      left: 24,
      top: 380,
      width: 44,
      height: 560,
      sigma: 12,
    }),
  ]);

  const deLettered = await sharp(
    originalCover,
  )
    .composite([
      {
        input: blurredRegions[0],
        left: 290,
        top: 560,
      },
      {
        input: blurredRegions[1],
        left: 270,
        top: 990,
      },
      {
        input: blurredRegions[2],
        left: 245,
        top: 1135,
      },
      {
        input: blurredRegions[3],
        left: 24,
        top: 380,
      },
    ])
    .resize(
      NOBODY_BRAND.modelCanvas.width,
      NOBODY_BRAND.modelCanvas.height,
      { fit: "fill" },
    )
    .png()
    .toBuffer();

  const metadata =
    await sharp(deLettered).metadata();

  if (
    metadata.width !==
      NOBODY_BRAND.modelCanvas.width ||
    metadata.height !==
      NOBODY_BRAND.modelCanvas.height
  ) {
    throw new Error(
      "Could not prepare the canonical composition reference.",
    );
  }

  if (width !== 906 || height !== 1280) {
    throw new Error(
      "The canonical reference dimensions changed unexpectedly.",
    );
  }

  return deLettered;
}

async function buildHelmetReference(
  originalCover: Buffer,
) {
  return sharp(originalCover)
    .extract({
      left: 315,
      top: 70,
      width: 285,
      height: 355,
    })
    .resize(768, 960, {
      fit: "contain",
      background: {
        r: 117,
        g: 98,
        b: 77,
        alpha: 1,
      },
    })
    .png()
    .toBuffer();
}

export async function loadCanonicalReferenceAssets():
  Promise<CanonicalReferenceAssets> {
  const originalCover = await readFile(
    getCanonicalPath(),
  );

  const actualSha256 = sha256(
    originalCover,
  );

  if (
    actualSha256 !==
    NOBODY_BRAND.canonicalReference.sha256
  ) {
    throw new Error(
      "The canonical book cover failed its SHA-256 check. Restore the approved public/book-cover.png before generating artwork.",
    );
  }

  const metadata =
    await sharp(originalCover).metadata();

  if (
    metadata.width !==
      NOBODY_BRAND.canonicalReference.width ||
    metadata.height !==
      NOBODY_BRAND.canonicalReference.height
  ) {
    throw new Error(
      `The canonical book cover must be ${NOBODY_BRAND.canonicalReference.width}x${NOBODY_BRAND.canonicalReference.height}.`,
    );
  }

  const [
    compositionReference,
    helmetReference,
  ] = await Promise.all([
    buildCompositionReference(originalCover),
    buildHelmetReference(originalCover),
  ]);

  return {
    originalCover,
    compositionReference,
    helmetReference,
    sha256: actualSha256,
  };
}

async function callOpenAIImageEdit(
  input: {
    model: SupportedImageModel;
    modelSize: `${number}x${number}`;
    prompt: string;
    quality: ImageQuality;
    variations: number;
    compositionReference: Buffer;
    helmetReference: Buffer;
  },
) {
  const apiKey =
    requireEnvironmentValue(
      "OPENAI_API_KEY",
      process.env.OPENAI_API_KEY,
    );

  const form = new FormData();

  form.set("model", input.model);
  form.set("prompt", input.prompt);
  form.set("size", input.modelSize);
  form.set("quality", input.quality);
  form.set(
    "n",
    String(input.variations),
  );
  form.set("output_format", "png");
  form.set("background", "opaque");
  form.set("moderation", "auto");

  form.append(
    "image[]",
    new Blob(
      [
        new Uint8Array(
          input.compositionReference,
        ),
      ],
      { type: "image/png" },
    ),
    "canonical-composition-reference.png",
  );

  form.append(
    "image[]",
    new Blob(
      [
        new Uint8Array(
          input.helmetReference,
        ),
      ],
      { type: "image/png" },
    ),
    "canonical-helmet-reference.png",
  );

  const response = await fetch(
    OPENAI_IMAGES_EDIT_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(
        280_000,
      ),
    },
  );

  const payload =
    (await response.json()) as
      OpenAIImageResponse;

  if (!response.ok) {
    const code =
      payload.error?.code
        ? ` (${payload.error.code})`
        : "";

    throw new Error(
      `${
        payload.error?.message ||
        `OpenAI image generation failed with status ${response.status}.`
      }${code}`,
    );
  }

  const images =
    payload.data
      ?.map(
        (item) => item.b64_json,
      )
      .filter(
        (value): value is string =>
          Boolean(value),
      ) ?? [];

  if (
    images.length !== input.variations
  ) {
    throw new Error(
      `OpenAI returned ${images.length} image(s), expected ${input.variations}.`,
    );
  }

  return {
    images: images.map((image) =>
      Buffer.from(image, "base64"),
    ),
    usage: payload.usage ?? null,
    requestId:
      response.headers.get(
        "x-request-id",
      ),
  };
}

async function finalizeCleanArtwork(
  rawModelImage: Buffer,
): Promise<GeneratedArtwork> {
  const { width, height } =
    NOBODY_BRAND.generationCanvas;

  const cleanArtworkImage =
    await sharp(rawModelImage)
      .resize(width, height, {
        fit: "fill",
      })
      .removeAlpha()
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toBuffer();

  const metadata =
    await sharp(
      cleanArtworkImage,
    ).metadata();

  if (
    metadata.width !== width ||
    metadata.height !== height
  ) {
    throw new Error(
      `Clean artwork validation failed. Expected ${width}x${height}, received ${metadata.width}x${metadata.height}.`,
    );
  }

  const thumbnailImage =
    await sharp(cleanArtworkImage)
      .resize(453, 640, {
        fit: "fill",
      })
      .webp({
        quality: 84,
        effort: 5,
      })
      .toBuffer();

  return {
    rawModelImage,
    cleanArtworkImage,
    thumbnailImage,
    sha256: sha256(
      cleanArtworkImage,
    ),
    technicalValidation: {
      width,
      height,
      format: "png",
      hasAlpha: Boolean(
        metadata.hasAlpha,
      ),
      canonicalRatio:
        width / height,
    },
  };
}

export async function generateNobodyArtworks(
  input: {
    prompt: string;
    negativePrompt: string;
    quality: ImageQuality;
    variations: number;
  },
): Promise<ImageGenerationBatch> {
  const model =
    getOpenAIImageModel();

  const modelSize =
    NOBODY_BRAND.modelCanvas.size;

  const assets =
    await loadCanonicalReferenceAssets();

  const combinedPrompt = [
    input.prompt,
    "",
    "REFERENCE USE:",
    "Reference image 1 is the canonical composition guide derived from the original I AM NOBODY cover. Use it for body distance, vertical framing, centred stance, proportion, warmth, lighting restraint, and overall elegance only.",
    "Reference image 2 is the canonical mask detail. Preserve its anonymous reflective identity, black structural edges, realistic head proportion, and restrained blue, green, violet, and golden reflections.",
    "Create a new clean full-bleed artwork. Do not reproduce the original cover typography, spine, frame, border, coloured separator, author name, or any other graphic design element.",
    "",
    "STRICT EXCLUSIONS:",
    input.negativePrompt,
  ].join("\n");

  const generated =
    await callOpenAIImageEdit({
      model,
      modelSize,
      prompt: combinedPrompt,
      quality: input.quality,
      variations: input.variations,
      compositionReference:
        assets.compositionReference,
      helmetReference:
        assets.helmetReference,
    });

  const results = await Promise.all(
    generated.images.map(
      (rawModelImage) =>
        finalizeCleanArtwork(
          rawModelImage,
        ),
    ),
  );

  return {
    model,
    modelSize,
    requestId:
      generated.requestId,
    results,
    usage: generated.usage,
    referenceSha256:
      assets.sha256,
  };
}
