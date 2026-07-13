import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NOBODY_BRAND } from "./brand";
import type { ImageQuality } from "./types";

const OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits";

const SUPPORTED_IMAGE_MODELS = [
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
] as const;

type SupportedImageModel = (typeof SUPPORTED_IMAGE_MODELS)[number];

type Point = Readonly<{ x: number; y: number }>;

type OpenAIImageResponse = Readonly<{
  data?: ReadonlyArray<Readonly<{ b64_json?: string }>>;
  usage?: unknown;
  error?: Readonly<{
    message?: string;
    type?: string;
    code?: string;
  }>;
}>;

export type GeneratedCover = Readonly<{
  rawModelImage: Buffer;
  finalCoverImage: Buffer;
  thumbnailImage: Buffer;
  sha256: string;
}>;

export type ImageGenerationBatch = Readonly<{
  model: SupportedImageModel;
  modelSize: `${number}x${number}`;
  results: readonly GeneratedCover[];
  usage: unknown;
}>;

function requireEnvironmentValue(
  name: string,
  value: string | undefined,
) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }

  return normalized;
}

function getOpenAIImageModel(): SupportedImageModel {
  const configured =
    process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";

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

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;

  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];

    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) *
          (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInEllipse(
  point: Point,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
) {
  const normalizedX = (point.x - centerX) / radiusX;
  const normalizedY = (point.y - centerY) / radiusY;

  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

async function buildCharacterMatte(width: number, height: number) {
  const bodyPolygon: readonly Point[] = [
    { x: 0.43, y: 0.285 },
    { x: 0.365, y: 0.305 },
    { x: 0.295, y: 0.34 },
    { x: 0.235, y: 0.395 },
    { x: 0.195, y: 0.52 },
    { x: 0.165, y: 0.735 },
    { x: 0.19, y: 0.79 },
    { x: 0.245, y: 0.975 },
    { x: 0.365, y: 0.975 },
    { x: 0.39, y: 0.78 },
    { x: 0.61, y: 0.78 },
    { x: 0.635, y: 0.975 },
    { x: 0.755, y: 0.975 },
    { x: 0.81, y: 0.79 },
    { x: 0.835, y: 0.735 },
    { x: 0.805, y: 0.52 },
    { x: 0.765, y: 0.395 },
    { x: 0.705, y: 0.34 },
    { x: 0.635, y: 0.305 },
    { x: 0.57, y: 0.285 },
  ];

  const raw = Buffer.alloc(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = {
        x: x / width,
        y: y / height,
      };

      const insideHelmet = pointInEllipse(
        point,
        0.5,
        0.195,
        0.155,
        0.12,
      );

      const insideNeck =
        point.x >= 0.43 &&
        point.x <= 0.57 &&
        point.y >= 0.265 &&
        point.y <= 0.34;

      const insideBody = pointInPolygon(point, bodyPolygon);

      raw[y * width + x] =
        insideHelmet || insideNeck || insideBody ? 255 : 0;
    }
  }

  return sharp(raw, {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .blur(4.2)
    .raw()
    .toBuffer();
}

function makeRgbaMask(
  alpha: Buffer,
  width: number,
  height: number,
  invertAlpha: boolean,
) {
  const output = Buffer.alloc(width * height * 4, 255);

  for (let index = 0; index < width * height; index += 1) {
    const sourceAlpha = alpha[index] ?? 0;

    output[index * 4 + 3] = invertAlpha
      ? 255 - sourceAlpha
      : sourceAlpha;
  }

  return output;
}

type TextRegion = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  low: number;
  high: number;
}>;

const TEXT_REGIONS: readonly TextRegion[] = [
  {
    x1: 384,
    y1: 584,
    x2: 406,
    y2: 640,
    low: 175,
    high: 230,
  },
  {
    x1: 444,
    y1: 584,
    x2: 487,
    y2: 640,
    low: 185,
    high: 230,
  },
  {
    x1: 494,
    y1: 584,
    x2: 542,
    y2: 640,
    low: 180,
    high: 230,
  },
  {
    x1: 375,
    y1: 642,
    x2: 550,
    y2: 802,
    low: 150,
    high: 235,
  },
  {
    x1: 290,
    y1: 800,
    x2: 645,
    y2: 963,
    low: 150,
    high: 235,
  },
  {
    x1: 340,
    y1: 995,
    x2: 575,
    y2: 1075,
    low: 125,
    high: 210,
  },
  {
    x1: 255,
    y1: 1145,
    x2: 660,
    y2: 1200,
    low: 125,
    high: 210,
  },
];

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function getLuma(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

async function buildTypographyOverlay(originalCover: Buffer) {
  const { width, height } = NOBODY_BRAND.canonicalReference;

  const { data, info } = await sharp(originalCover)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (
    info.width !== width ||
    info.height !== height ||
    info.channels !== 4
  ) {
    throw new Error(
      "The canonical cover dimensions changed unexpectedly.",
    );
  }

  const overlay = Buffer.alloc(width * height * 4);

  for (const region of TEXT_REGIONS) {
    for (let y = region.y1; y < region.y2; y += 1) {
      for (let x = region.x1; x < region.x2; x += 1) {
        const pixelIndex = y * width + x;
        const sourceIndex = pixelIndex * 4;

        const red = data[sourceIndex] ?? 0;
        const green = data[sourceIndex + 1] ?? 0;
        const blue = data[sourceIndex + 2] ?? 0;
        const luma = getLuma(red, green, blue);

        const alpha = clampByte(
          ((luma - region.low) /
            (region.high - region.low)) *
            255,
        );

        if (alpha <= overlay[sourceIndex + 3]) {
          continue;
        }

        overlay[sourceIndex] = red;
        overlay[sourceIndex + 1] = green;
        overlay[sourceIndex + 2] = blue;
        overlay[sourceIndex + 3] = alpha;
      }
    }
  }

  /*
   * Restore the small coloured separator directly above the subtitle.
   */
  for (let y = 974; y < 990; y += 1) {
    for (let x = 415; x < 520; x += 1) {
      const pixelIndex = y * width + x;
      const sourceIndex = pixelIndex * 4;

      const red = data[sourceIndex] ?? 0;
      const green = data[sourceIndex + 1] ?? 0;
      const blue = data[sourceIndex + 2] ?? 0;

      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);

      const saturation =
        maximum === 0 ? 0 : (maximum - minimum) / maximum;

      if (saturation <= 0.18 || maximum <= 55) {
        continue;
      }

      const alpha = clampByte(
        ((saturation - 0.18) / 0.4) * 255,
      );

      overlay[sourceIndex] = red;
      overlay[sourceIndex + 1] = green;
      overlay[sourceIndex + 2] = blue;
      overlay[sourceIndex + 3] = alpha;
    }
  }

  return sharp(overlay, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function prepareCanonicalAssets(
  modelSize: `${number}x${number}`,
) {
  const [modelWidth, modelHeight] = modelSize
    .split("x")
    .map((value) => Number.parseInt(value, 10));

  const {
    width,
    height,
    publicPath,
  } = NOBODY_BRAND.canonicalReference;

  const canonicalPath = path.join(
    process.cwd(),
    "public",
    publicPath.slice(1),
  );

  const originalCover = await readFile(canonicalPath);

  const characterMatte = await buildCharacterMatte(
    width,
    height,
  );

  /*
   * OpenAI masks use fully transparent pixels as the editable region.
   * Therefore the character matte is inverted for the API mask.
   */
  const editMask = makeRgbaMask(
    characterMatte,
    width,
    height,
    true,
  );

  /*
   * No crop is used. The complete canonical cover is proportionally
   * transformed to the closest API-compatible model canvas.
   */
  const modelCover = await sharp(originalCover)
    .resize(modelWidth, modelHeight, {
      fit: "fill",
    })
    .png()
    .toBuffer();

  const modelEditMask = await sharp(editMask, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .resize(modelWidth, modelHeight, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .png()
    .toBuffer();

  const typographyOverlay =
    await buildTypographyOverlay(originalCover);

  return {
    originalCover,
    characterMatte,
    modelCover,
    modelEditMask,
    typographyOverlay,
  };
}

async function callOpenAIImageEdit(input: {
  model: SupportedImageModel;
  modelSize: `${number}x${number}`;
  prompt: string;
  quality: ImageQuality;
  variations: number;
  modelCover: Buffer;
  modelEditMask: Buffer;
}) {
  const apiKey = requireEnvironmentValue(
    "OPENAI_API_KEY",
    process.env.OPENAI_API_KEY,
  );

  const form = new FormData();

  form.set("model", input.model);
  form.set("prompt", input.prompt);
  form.set("size", input.modelSize);
  form.set("quality", input.quality);
  form.set("n", String(input.variations));
  form.set("output_format", "png");
  form.set("background", "opaque");

  form.set(
    "image",
    new Blob([new Uint8Array(input.modelCover)], {
      type: "image/png",
    }),
    "canonical-cover.png",
  );

  form.set(
    "mask",
    new Blob([new Uint8Array(input.modelEditMask)], {
      type: "image/png",
    }),
    "character-edit-mask.png",
  );

  const response = await fetch(OPENAI_IMAGES_EDIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(280_000),
  });

  const payload =
    (await response.json()) as OpenAIImageResponse;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `OpenAI image generation failed with status ${response.status}.`,
    );
  }

  const images =
    payload.data
      ?.map((item) => item.b64_json)
      .filter(
        (value): value is string => Boolean(value),
      ) ?? [];

  if (images.length !== input.variations) {
    throw new Error(
      `OpenAI returned ${images.length} image(s), expected ${input.variations}.`,
    );
  }

  return {
    images: images.map((image) =>
      Buffer.from(image, "base64"),
    ),
    usage: payload.usage ?? null,
  };
}

async function finalizeCover(input: {
  rawModelImage: Buffer;
  originalCover: Buffer;
  characterMatte: Buffer;
  typographyOverlay: Buffer;
}) {
  const { width, height } =
    NOBODY_BRAND.canonicalReference;

  /*
   * Return the model output to the exact 906x1280 canvas.
   * fit: "fill" changes dimensions but never removes any image part.
   */
  const generatedAtCanonicalSize = await sharp(
    input.rawModelImage,
  )
    .resize(width, height, {
      fit: "fill",
    })
    .removeAlpha()
    .png()
    .toBuffer();

  /*
   * Attach the character-only alpha matte to the generated image.
   */
  const generatedWithCharacterAlpha = await sharp(
    generatedAtCanonicalSize,
  )
    .removeAlpha()
    .joinChannel(input.characterMatte, {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
    .png()
    .toBuffer();

  /*
   * Begin from the untouched original cover.
   *
   * Layer 1: generated character only.
   * Layer 2: original controlled title, subtitle, author and separator.
   *
   * Every non-character pixel therefore comes directly from the original
   * canonical book cover.
   */
  const finalCoverImage = await sharp(
    input.originalCover,
  )
    .composite([
      {
        input: generatedWithCharacterAlpha,
        blend: "over",
      },
      {
        input: input.typographyOverlay,
        blend: "over",
      },
    ])
    .png({
      compressionLevel: 9,
    })
    .toBuffer();

  const metadata =
    await sharp(finalCoverImage).metadata();

  if (
    metadata.width !== width ||
    metadata.height !== height
  ) {
    throw new Error(
      `Final cover validation failed. Expected ${width}x${height}, received ${metadata.width}x${metadata.height}.`,
    );
  }

  const thumbnailImage = await sharp(
    finalCoverImage,
  )
    .resize(453, 640, {
      fit: "fill",
    })
    .webp({
      quality: 84,
    })
    .toBuffer();

  return {
    finalCoverImage,
    thumbnailImage,
    sha256: createHash("sha256")
      .update(finalCoverImage)
      .digest("hex"),
  };
}

export async function generateNobodyCovers(input: {
  prompt: string;
  quality: ImageQuality;
  variations: number;
}): Promise<ImageGenerationBatch> {
  const model = getOpenAIImageModel();
  const modelSize = NOBODY_BRAND.modelCanvas.size;

  const assets =
    await prepareCanonicalAssets(modelSize);

  const generated = await callOpenAIImageEdit({
    model,
    modelSize,
    prompt: input.prompt,
    quality: input.quality,
    variations: input.variations,
    modelCover: assets.modelCover,
    modelEditMask: assets.modelEditMask,
  });

  const results = await Promise.all(
    generated.images.map(async (rawModelImage) => {
      const finalized = await finalizeCover({
        rawModelImage,
        originalCover: assets.originalCover,
        characterMatte: assets.characterMatte,
        typographyOverlay: assets.typographyOverlay,
      });

      return {
        rawModelImage,
        finalCoverImage: finalized.finalCoverImage,
        thumbnailImage: finalized.thumbnailImage,
        sha256: finalized.sha256,
      };
    }),
  );

  return {
    model,
    modelSize,
    results,
    usage: generated.usage,
  };
}