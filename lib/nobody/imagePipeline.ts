import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  NOBODY_BRAND,
  NOBODY_CANONICAL_BACKGROUND,
  NOBODY_CANONICAL_HELMET,
  NOBODY_SUBJECT_MATTE,
} from "./brand";
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
    helmetOverlay: Buffer;
    canonicalBackground: Buffer;
    modelBackground: Buffer;
    subjectMatte: Buffer;
    modelEditMask: Buffer;
    sha256: string;
    helmetSha256: string;
    backgroundSha256: string;
    subjectMatteSha256: string;
  }>;

export type GeneratedArtwork = Readonly<{
  rawModelImage: Buffer;
  cleanArtworkImage: Buffer;
  thumbnailImage: Buffer;
  sha256: string;
  technicalValidation: Readonly<{
    sourceWidth: number;
    sourceHeight: number;
    sourceAspectRatio: number;
    requestedAspectRatio: number;
    aspectDifferencePercent: number;
    width: number;
    height: number;
    format: "png";
    hasAlpha: boolean;
    canonicalRatio: number;
    normalization: "centre-edge-trim";
    canonicalHelmetApplied: true;
    canonicalHelmetId: string;
    canonicalHelmetSha256: string;
    canonicalBackgroundApplied: true;
    backgroundIsolation: "difference-matte-composite";
    canonicalBackgroundId: string;
    canonicalBackgroundSha256: string;
    subjectMatteId: string;
    subjectMatteSha256: string;
  }>;
}>;

export type ImageGenerationBatch = Readonly<{
  model: SupportedImageModel;
  modelSize: `${number}x${number}`;
  requestId: string | null;
  results: readonly GeneratedArtwork[];
  usage: unknown;
  referenceSha256: string;
  helmetSha256: string;
  backgroundSha256: string;
  subjectMatteSha256: string;
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

function getOpenAIImageModel(): SupportedImageModel {
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
    NOBODY_BRAND.canonicalReference.publicPath.replace(
      /^\//,
      "",
    ),
  );
}

function getCanonicalHelmetPath() {
  return path.join(
    process.cwd(),
    "public",
    NOBODY_CANONICAL_HELMET.publicPath.replace(
      /^\//,
      "",
    ),
  );
}

function getCanonicalBackgroundPath() {
  return path.join(process.cwd(), "public", NOBODY_CANONICAL_BACKGROUND.publicPath.replace(/^\//, ""));
}

function getSubjectMattePath() {
  return path.join(process.cwd(), "public", NOBODY_SUBJECT_MATTE.publicPath.replace(/^\//, ""));
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

  const deLettered = await sharp(originalCover)
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
      {
        fit: "fill",
      },
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
  helmetOverlay: Buffer,
) {
  const scaledHelmet = await sharp(helmetOverlay)
    .resize(720, 897, {
      fit: "contain",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 768,
      height: 960,
      channels: 4,
      background: {
        r: 117,
        g: 98,
        b: 77,
        alpha: 1,
      },
    },
  })
    .composite([
      {
        input: scaledHelmet,
        left: 24,
        top: 20,
      },
    ])
    .png()
    .toBuffer();
}

async function verifyCanonicalHelmetOverlay(
  helmetOverlay: Buffer,
) {
  const helmetSha256 = sha256(helmetOverlay);

  if (
    helmetSha256 !==
    NOBODY_CANONICAL_HELMET.sha256
  ) {
    throw new Error(
      "The canonical helmet asset could not be verified. Restore public/nobody-canonical-helmet.png before creating artwork.",
    );
  }

  const metadata =
    await sharp(helmetOverlay).metadata();

  if (
    metadata.width !==
      NOBODY_CANONICAL_HELMET.width ||
    metadata.height !==
      NOBODY_CANONICAL_HELMET.height ||
    metadata.format !== "png" ||
    !metadata.hasAlpha
  ) {
    throw new Error(
      `The canonical helmet asset must be a transparent ${NOBODY_CANONICAL_HELMET.width}x${NOBODY_CANONICAL_HELMET.height} PNG.`,
    );
  }

  return helmetSha256;
}

async function verifyCanonicalBackground(background: Buffer) {
  const backgroundSha256 = sha256(background);
  if (backgroundSha256 !== NOBODY_CANONICAL_BACKGROUND.sha256) {
    throw new Error("The canonical background asset could not be verified. Restore public/nobody-canonical-background.png before creating artwork.");
  }
  const metadata = await sharp(background).metadata();
  if (metadata.width !== NOBODY_CANONICAL_BACKGROUND.width || metadata.height !== NOBODY_CANONICAL_BACKGROUND.height || metadata.format !== "png") {
    throw new Error(`The canonical background must be a ${NOBODY_CANONICAL_BACKGROUND.width}x${NOBODY_CANONICAL_BACKGROUND.height} PNG.`);
  }
  return backgroundSha256;
}

async function verifySubjectMatte(subjectMatte: Buffer) {
  const subjectMatteSha256 = sha256(subjectMatte);
  if (subjectMatteSha256 !== NOBODY_SUBJECT_MATTE.sha256) {
    throw new Error("The canonical subject matte could not be verified. Restore public/nobody-subject-matte.png before creating artwork.");
  }
  const metadata = await sharp(subjectMatte).metadata();
  if (metadata.width !== NOBODY_SUBJECT_MATTE.width || metadata.height !== NOBODY_SUBJECT_MATTE.height || metadata.format !== "png") {
    throw new Error(`The canonical subject matte must be a ${NOBODY_SUBJECT_MATTE.width}x${NOBODY_SUBJECT_MATTE.height} PNG.`);
  }
  return subjectMatteSha256;
}

async function buildModelBackground(canonicalBackground: Buffer) {
  return sharp(canonicalBackground).resize(NOBODY_BRAND.modelCanvas.width, NOBODY_BRAND.modelCanvas.height, { fit: "fill" }).removeAlpha().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function buildModelEditMask(subjectMatte: Buffer) {
  const { data, info } = await sharp(subjectMatte).resize(NOBODY_BRAND.modelCanvas.width, NOBODY_BRAND.modelCanvas.height, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < data.length; index += 1) {
    const outputIndex = index * 4;
    rgba[outputIndex] = 0;
    rgba[outputIndex + 1] = 0;
    rgba[outputIndex + 2] = 0;
    rgba[outputIndex + 3] = 255 - (data[index] ?? 0);
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function applyCanonicalBackground(
  artwork: Buffer,
  canonicalBackground: Buffer,
  subjectMatte: Buffer,
) {
  const [artworkRaw, backgroundRawObject, matteRawObject] = await Promise.all([
    sharp(artwork).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(canonicalBackground)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(subjectMatte)
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const { width, height } = artworkRaw.info;

  if (
    backgroundRawObject.info.width !== width ||
    backgroundRawObject.info.height !== height ||
    matteRawObject.info.width !== width ||
    matteRawObject.info.height !== height ||
    artworkRaw.info.channels !== 3 ||
    backgroundRawObject.info.channels !== 3 ||
    matteRawObject.info.channels !== 1
  ) {
    throw new Error(
      "The fixed background assets do not match the artwork canvas.",
    );
  }

  /*
   * The image edit starts from the canonical background, so unchanged pixels
   * remain very close to the plate. Build a soft alpha mask from the actual
   * colour difference, bounded by the approved subject matte. This removes any
   * regenerated wall pixels between the arms, body, and legs before the subject
   * is composited back onto the immutable background plate.
   */
  const alpha = Buffer.alloc(width * height);
  const differenceStart = 8;
  const differenceEnd = 30;

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 3;
    const matte = matteRawObject.data[pixel] ?? 0;

    if (matte === 0) {
      alpha[pixel] = 0;
      continue;
    }

    const redDifference = Math.abs(
      (artworkRaw.data[offset] ?? 0) -
        (backgroundRawObject.data[offset] ?? 0),
    );
    const greenDifference = Math.abs(
      (artworkRaw.data[offset + 1] ?? 0) -
        (backgroundRawObject.data[offset + 1] ?? 0),
    );
    const blueDifference = Math.abs(
      (artworkRaw.data[offset + 2] ?? 0) -
        (backgroundRawObject.data[offset + 2] ?? 0),
    );
    const difference = Math.max(
      redDifference,
      greenDifference,
      blueDifference,
    );
    const normalized = Math.max(
      0,
      Math.min(1, (difference - differenceStart) / (differenceEnd - differenceStart)),
    );

    alpha[pixel] = Math.round(normalized * matte);
  }

  const cleanedAlpha = await sharp(alpha, {
    raw: { width, height, channels: 1 },
  })
    .median(3)
    .blur(0.55)
    .raw()
    .toBuffer();

  const rgba = Buffer.alloc(width * height * 4);
  let visiblePixels = 0;

  for (let pixel = 0; pixel < cleanedAlpha.length; pixel += 1) {
    const sourceOffset = pixel * 3;
    const outputOffset = pixel * 4;
    const pixelAlpha = cleanedAlpha[pixel] ?? 0;

    rgba[outputOffset] = artworkRaw.data[sourceOffset] ?? 0;
    rgba[outputOffset + 1] = artworkRaw.data[sourceOffset + 1] ?? 0;
    rgba[outputOffset + 2] = artworkRaw.data[sourceOffset + 2] ?? 0;
    rgba[outputOffset + 3] = pixelAlpha;

    if (pixelAlpha >= 24) visiblePixels += 1;
  }

  const minimumVisiblePixels = Math.round(width * height * 0.09);

  if (visiblePixels < minimumVisiblePixels) {
    throw new Error(
      "The generated subject could not be isolated from the fixed background.",
    );
  }

  const subjectWithAlpha = await sharp(rgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  const composed = await sharp(canonicalBackground)
    .composite([{ input: subjectWithAlpha, blend: "over" }])
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const outputRaw = await sharp(composed).removeAlpha().raw().toBuffer();

  for (let pixel = 0; pixel < cleanedAlpha.length; pixel += 1) {
    if ((cleanedAlpha[pixel] ?? 0) !== 0) continue;

    const offset = pixel * 3;

    if (
      backgroundRawObject.data[offset] !== outputRaw[offset] ||
      backgroundRawObject.data[offset + 1] !== outputRaw[offset + 1] ||
      backgroundRawObject.data[offset + 2] !== outputRaw[offset + 2]
    ) {
      throw new Error(
        "The fixed canonical background could not be applied exactly to the artwork.",
      );
    }
  }

  return composed;
}

async function applyCanonicalHelmet(
  artwork: Buffer,
  helmetOverlay: Buffer,
) {
  const composed = await sharp(artwork)
    .composite([
      {
        input: helmetOverlay,
        left:
          NOBODY_CANONICAL_HELMET.placement.left,
        top:
          NOBODY_CANONICAL_HELMET.placement.top,
        blend: "over",
      },
    ])
    .removeAlpha()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();

  const [overlayRaw, outputRegionRaw] =
    await Promise.all([
      sharp(helmetOverlay)
        .ensureAlpha()
        .raw()
        .toBuffer({
          resolveWithObject: true,
        }),

      sharp(composed)
        .extract({
          left:
            NOBODY_CANONICAL_HELMET.placement.left,
          top:
            NOBODY_CANONICAL_HELMET.placement.top,
          width:
            NOBODY_CANONICAL_HELMET.width,
          height:
            NOBODY_CANONICAL_HELMET.height,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({
          resolveWithObject: true,
        }),
    ]);

  for (
    let index = 0;
    index < overlayRaw.data.length;
    index += 4
  ) {
    const alpha =
      overlayRaw.data[index + 3] ?? 0;

    if (alpha !== 255) {
      continue;
    }

    if (
      overlayRaw.data[index] !==
        outputRegionRaw.data[index] ||
      overlayRaw.data[index + 1] !==
        outputRegionRaw.data[index + 1] ||
      overlayRaw.data[index + 2] !==
        outputRegionRaw.data[index + 2]
    ) {
      throw new Error(
        "The canonical helmet could not be applied exactly to the generated artwork.",
      );
    }
  }

  return composed;
}

export async function loadCanonicalReferenceAssets(): Promise<CanonicalReferenceAssets> {
  const [originalCover, helmetOverlay, canonicalBackground, subjectMatte] = await Promise.all([
    readFile(getCanonicalPath()),
    readFile(getCanonicalHelmetPath()),
    readFile(getCanonicalBackgroundPath()),
    readFile(getSubjectMattePath()),
  ]);

  const actualSha256 =
    sha256(originalCover);

  if (
    actualSha256 !==
    NOBODY_BRAND.canonicalReference.sha256
  ) {
    throw new Error(
      "The original book cover could not be verified. Restore the approved cover before creating artwork.",
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

  const [helmetSha256, backgroundSha256, subjectMatteSha256] = await Promise.all([
    verifyCanonicalHelmetOverlay(helmetOverlay),
    verifyCanonicalBackground(canonicalBackground),
    verifySubjectMatte(subjectMatte),
  ]);

  const [compositionReference, helmetReference, modelBackground, modelEditMask] = await Promise.all([
    buildCompositionReference(originalCover),
    buildHelmetReference(helmetOverlay),
    buildModelBackground(canonicalBackground),
    buildModelEditMask(subjectMatte),
  ]);

  return {
    originalCover,
    compositionReference,
    helmetReference,
    helmetOverlay,
    canonicalBackground,
    modelBackground,
    subjectMatte,
    modelEditMask,
    sha256: actualSha256,
    helmetSha256,
    backgroundSha256,
    subjectMatteSha256,
  };
}

async function callOpenAIImageEdit(input: {
  model: SupportedImageModel;
  modelSize: `${number}x${number}`;
  prompt: string;
  quality: ImageQuality;
  variations: number;
  modelBackground: Buffer;
  modelEditMask: Buffer;
  compositionReference: Buffer;
  helmetReference: Buffer;
}) {
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

  /*
   * GPT Image 2 processes image references at high fidelity automatically.
   * Do not send input_fidelity for this model.
   */

  form.append(
    "image[]",
    new Blob([new Uint8Array(input.modelBackground)], { type: "image/png" }),
    "canonical-background-base.png",
  );

  form.append(
    "mask",
    new Blob([new Uint8Array(input.modelEditMask)], { type: "image/png" }),
    "canonical-subject-edit-mask.png",
  );

  form.append(
    "image[]",
    new Blob(
      [
        new Uint8Array(
          input.compositionReference,
        ),
      ],
      {
        type: "image/png",
      },
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
      {
        type: "image/png",
      },
    ),
    "canonical-helmet-reference.png",
  );

  const response = await fetch(
    OPENAI_IMAGES_EDIT_URL,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiKey}`,
      },
      body: form,
      cache: "no-store",
      signal:
        AbortSignal.timeout(
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
        (item) =>
          item.b64_json,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      ) ?? [];

  if (
    images.length !==
    input.variations
  ) {
    throw new Error(
      `OpenAI returned ${images.length} image(s), expected ${input.variations}.`,
    );
  }

  return {
    images: images.map(
      (image) =>
        Buffer.from(
          image,
          "base64",
        ),
    ),
    usage:
      payload.usage ?? null,
    requestId:
      response.headers.get(
        "x-request-id",
      ),
  };
}

async function finalizeCleanArtwork(
  rawModelImage: Buffer,
  helmetOverlay: Buffer,
  helmetSha256: string,
  canonicalBackground: Buffer,
  backgroundSha256: string,
  subjectMatte: Buffer,
  subjectMatteSha256: string,
): Promise<GeneratedArtwork> {
  const { width, height } =
    NOBODY_BRAND.generationCanvas;

  const sourceMetadata =
    await sharp(rawModelImage).metadata();

  if (
    !sourceMetadata.width ||
    !sourceMetadata.height
  ) {
    throw new Error(
      "The generated artwork has no readable dimensions.",
    );
  }

  const sourceAspectRatio =
    sourceMetadata.width /
    sourceMetadata.height;

  const requestedAspectRatio =
    NOBODY_BRAND.modelCanvas.aspectRatio;

  const aspectDifferencePercent =
    Math.abs(
      sourceAspectRatio -
        requestedAspectRatio,
    ) /
    requestedAspectRatio *
    100;

  /*
   * Reject an unexpected canvas instead of destructively cropping it.
   * The requested 896x1264 canvas differs from the 906x1280 book-cover
   * canvas by only about 0.15%, so normal output needs only a sub-pixel
   * centre-edge trim when it is normalized to the exact final size.
   */
  if (aspectDifferencePercent > 1) {
    throw new Error(
      "The generated artwork returned an unexpected aspect ratio. No final artwork was saved.",
    );
  }

  const normalizedArtwork =
    await sharp(rawModelImage)
      .resize(width, height, {
        fit: "cover",
        position: "centre",
      })
      .removeAlpha()
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toBuffer();

  const backgroundLockedArtwork = await applyCanonicalBackground(
    normalizedArtwork,
    canonicalBackground,
    subjectMatte,
  );

  const cleanArtworkImage = await applyCanonicalHelmet(
    backgroundLockedArtwork,
    helmetOverlay,
  );

  const metadata =
    await sharp(
      cleanArtworkImage,
    ).metadata();

  if (
    metadata.width !== width ||
    metadata.height !== height
  ) {
    throw new Error(
      `The artwork could not be prepared at ${width}x${height}.`,
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
    sha256:
      sha256(
        cleanArtworkImage,
      ),
    technicalValidation: {
      sourceWidth:
        sourceMetadata.width,
      sourceHeight:
        sourceMetadata.height,
      sourceAspectRatio,
      requestedAspectRatio,
      aspectDifferencePercent,
      width,
      height,
      format: "png",
      hasAlpha:
        Boolean(
          metadata.hasAlpha,
        ),
      canonicalRatio:
        width / height,
      normalization:
        "centre-edge-trim",
      canonicalHelmetApplied: true,
      canonicalHelmetId:
        NOBODY_CANONICAL_HELMET.id,
      canonicalHelmetSha256: helmetSha256,
      canonicalBackgroundApplied: true,
      backgroundIsolation: "difference-matte-composite",
      canonicalBackgroundId: NOBODY_CANONICAL_BACKGROUND.id,
      canonicalBackgroundSha256: backgroundSha256,
      subjectMatteId: NOBODY_SUBJECT_MATTE.id,
      subjectMatteSha256,
    },
  };
}

export async function generateNobodyArtworks(input: {
  prompt: string;
  negativePrompt: string;
  quality: ImageQuality;
  variations: number;
}): Promise<ImageGenerationBatch> {
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
    "Reference image 1 is the exact canonical background base. Preserve it unchanged and create the figure only inside the editable subject area.",
    "Reference image 2 is the canonical composition guide derived from the original I AM NOBODY cover. Use it for body distance, vertical framing, centred stance, proportion, lighting restraint, and overall elegance only.",
    "Reference image 3 is the immutable canonical helmet blueprint. Match its exact position, scale, silhouette, neck connection, black structural edges, reflective visor, and restrained blue, green, violet, and golden reflections.",
    "Do not invent, redesign, enlarge, shrink, rotate, or stylise the helmet. Do not create a second rim, visor, head shape, face, hair, skin, or helmet edge outside the canonical silhouette. The exact canonical helmet pixels are applied after generation, so the clothing neckline and shoulders must integrate naturally beneath that fixed helmet.",
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
      variations:
        input.variations,
      modelBackground: assets.modelBackground,
      modelEditMask: assets.modelEditMask,
      compositionReference: assets.compositionReference,
      helmetReference:
        assets.helmetReference,
    });

  const results =
    await Promise.all(
      generated.images.map(
        (rawModelImage) =>
          finalizeCleanArtwork(
            rawModelImage,
            assets.helmetOverlay,
            assets.helmetSha256,
            assets.canonicalBackground,
            assets.backgroundSha256,
            assets.subjectMatte,
            assets.subjectMatteSha256,
          ),
      ),
    );

  return {
    model,
    modelSize,
    requestId:
      generated.requestId,
    results,
    usage:
      generated.usage,
    referenceSha256:
      assets.sha256,
    helmetSha256: assets.helmetSha256,
    backgroundSha256: assets.backgroundSha256,
    subjectMatteSha256: assets.subjectMatteSha256,
  };
}