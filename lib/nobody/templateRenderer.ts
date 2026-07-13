import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  NOBODY_BRAND,
  NOBODY_TEMPLATE_VERSION,
} from "./brand";
import {
  loadCanonicalReferenceAssets,
} from "./imagePipeline";
import type {
  Locale,
  TemplateType,
} from "./types";

type TextRegion = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  low: number;
  high: number;
}>;

const TEXT_REGIONS:
  readonly TextRegion[] = [
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

const BOOK_INTERIOR = {
  left: 69,
  top: 28,
  width: 810,
  height: 1204,
} as const;

export type RenderedTemplate =
  Readonly<{
    buffer: Buffer;
    templateType: TemplateType;
    templateVersion: string;
    locale: Locale | null;
    width: number;
    height: number;
    mimeType:
      | "image/png"
      | "image/webp"
      | "image/jpeg";
    extension:
      | "png"
      | "webp"
      | "jpg";
    sha256: string;
    metadata: Readonly<
      Record<string, unknown>
    >;
  }>;

function clampByte(
  value: number,
) {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(value),
    ),
  );
}

function getLuma(
  red: number,
  green: number,
  blue: number,
) {
  return (
    0.2126 * red +
    0.7152 * green +
    0.0722 * blue
  );
}

function digest(
  buffer: Buffer,
) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex");
}

async function buildTypographyOverlay(
  originalCover: Buffer,
) {
  const { width, height } =
    NOBODY_BRAND.canonicalReference;

  const { data, info } =
    await sharp(originalCover)
      .ensureAlpha()
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

  if (
    info.width !== width ||
    info.height !== height ||
    info.channels !== 4
  ) {
    throw new Error(
      "The canonical cover dimensions changed unexpectedly.",
    );
  }

  const overlay =
    Buffer.alloc(
      width * height * 4,
    );

  for (
    const region of
    TEXT_REGIONS
  ) {
    for (
      let y = region.y1;
      y < region.y2;
      y += 1
    ) {
      for (
        let x = region.x1;
        x < region.x2;
        x += 1
      ) {
        const pixelIndex =
          y * width + x;

        const sourceIndex =
          pixelIndex * 4;

        const red =
          data[sourceIndex] ?? 0;

        const green =
          data[sourceIndex + 1] ??
          0;

        const blue =
          data[sourceIndex + 2] ??
          0;

        const luma = getLuma(
          red,
          green,
          blue,
        );

        const alpha = clampByte(
          ((luma - region.low) /
            (region.high -
              region.low)) *
            255,
        );

        if (
          alpha <=
          overlay[
            sourceIndex + 3
          ]
        ) {
          continue;
        }

        overlay[sourceIndex] =
          red;

        overlay[
          sourceIndex + 1
        ] = green;

        overlay[
          sourceIndex + 2
        ] = blue;

        overlay[
          sourceIndex + 3
        ] = alpha;
      }
    }
  }

  for (
    let y = 974;
    y < 990;
    y += 1
  ) {
    for (
      let x = 415;
      x < 520;
      x += 1
    ) {
      const pixelIndex =
        y * width + x;

      const sourceIndex =
        pixelIndex * 4;

      const red =
        data[sourceIndex] ?? 0;

      const green =
        data[sourceIndex + 1] ??
        0;

      const blue =
        data[sourceIndex + 2] ??
        0;

      const maximum =
        Math.max(
          red,
          green,
          blue,
        );

      const minimum =
        Math.min(
          red,
          green,
          blue,
        );

      const saturation =
        maximum === 0
          ? 0
          : (maximum - minimum) /
            maximum;

      if (
        saturation <= 0.18 ||
        maximum <= 55
      ) {
        continue;
      }

      const alpha = clampByte(
        ((saturation - 0.18) /
          0.4) *
          255,
      );

      overlay[sourceIndex] =
        red;

      overlay[
        sourceIndex + 1
      ] = green;

      overlay[
        sourceIndex + 2
      ] = blue;

      overlay[
        sourceIndex + 3
      ] = alpha;
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

async function buildBookCover(
  artwork: Buffer,
) {
  const { originalCover } =
    await loadCanonicalReferenceAssets();

  const typographyOverlay =
    await buildTypographyOverlay(
      originalCover,
    );

  const interiorArtwork =
    await sharp(artwork)
      .resize(
        BOOK_INTERIOR.width,
        BOOK_INTERIOR.height,
        {
          fit: "cover",
          position: "centre",
        },
      )
      .png()
      .toBuffer();

  const structuralLayers =
    await Promise.all([
      sharp(originalCover)
        .extract({
          left: 0,
          top: 0,
          width: 906,
          height: 28,
        })
        .png()
        .toBuffer(),

      sharp(originalCover)
        .extract({
          left: 0,
          top: 1232,
          width: 906,
          height: 48,
        })
        .png()
        .toBuffer(),

      sharp(originalCover)
        .extract({
          left: 0,
          top: 0,
          width: 69,
          height: 1280,
        })
        .png()
        .toBuffer(),

      sharp(originalCover)
        .extract({
          left: 879,
          top: 0,
          width: 27,
          height: 1280,
        })
        .png()
        .toBuffer(),
    ]);

  return sharp({
    create: {
      width: 906,
      height: 1280,
      channels: 3,
      background: "#050505",
    },
  })
    .composite([
      {
        input:
          interiorArtwork,
        left:
          BOOK_INTERIOR.left,
        top:
          BOOK_INTERIOR.top,
      },
      {
        input:
          structuralLayers[0],
        left: 0,
        top: 0,
      },
      {
        input:
          structuralLayers[1],
        left: 0,
        top: 1232,
      },
      {
        input:
          structuralLayers[2],
        left: 0,
        top: 0,
      },
      {
        input:
          structuralLayers[3],
        left: 879,
        top: 0,
      },
      {
        input:
          typographyOverlay,
        left: 0,
        top: 0,
      },
    ])
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

async function placeOnCanvas(
  input: {
    image: Buffer;
    width: number;
    height: number;
    margin: number;
    format:
      | "png"
      | "webp"
      | "jpeg";
  },
) {
  const background =
    await sharp(input.image)
      .resize(
        input.width,
        input.height,
        { fit: "cover" },
      )
      .blur(34)
      .modulate({
        brightness: 0.32,
        saturation: 0.55,
      })
      .toBuffer();

  const foreground =
    await sharp(input.image)
      .resize(
        input.width -
          input.margin * 2,
        input.height -
          input.margin * 2,
        {
          fit: "contain",
          background: {
            r: 5,
            g: 5,
            b: 5,
            alpha: 1,
          },
        },
      )
      .toBuffer();

  const canvas =
    sharp(background).composite([
      {
        input: foreground,
        left: input.margin,
        top: input.margin,
      },
    ]);

  if (
    input.format === "webp"
  ) {
    return canvas
      .webp({
        quality: 90,
        effort: 5,
      })
      .toBuffer();
  }

  if (
    input.format === "jpeg"
  ) {
    return canvas
      .jpeg({
        quality: 94,
        mozjpeg: true,
      })
      .toBuffer();
  }

  return canvas
    .png({
      compressionLevel: 9,
    })
    .toBuffer();
}

function result(
  input: Omit<
    RenderedTemplate,
    "sha256" |
      "templateVersion"
  >,
) {
  return {
    ...input,
    templateVersion:
      NOBODY_TEMPLATE_VERSION,
    sha256: digest(
      input.buffer,
    ),
  } satisfies RenderedTemplate;
}

export async function renderNobodyTemplate(
  input: {
    artwork: Buffer;
    templateType:
      TemplateType;
    locale?: Locale | null;
  },
): Promise<RenderedTemplate> {
  const locale =
    input.locale ?? null;

  if (
    input.templateType ===
    "clean_artwork"
  ) {
    const buffer =
      await sharp(input.artwork)
        .resize(906, 1280, {
          fit: "fill",
        })
        .removeAlpha()
        .png({
          compressionLevel: 9,
        })
        .toBuffer();

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 906,
      height: 1280,
      mimeType: "image/png",
      extension: "png",
      metadata: {
        controlledLayer:
          "none",
      },
    });
  }

  const bookCover =
    await buildBookCover(
      input.artwork,
    );

  if (
    input.templateType ===
    "book_cover"
  ) {
    return result({
      buffer: bookCover,
      templateType:
        input.templateType,
      locale,
      width: 906,
      height: 1280,
      mimeType: "image/png",
      extension: "png",
      metadata: {
        controlledLayer:
          "canonical-cover-frame-and-typography",
        sourceCanvas:
          "906x1280",
      },
    });
  }

  if (
    input.templateType ===
    "social_4x5"
  ) {
    const buffer =
      await placeOnCanvas({
        image: bookCover,
        width: 1080,
        height: 1350,
        margin: 58,
        format: "jpeg",
      });

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1350,
      mimeType: "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "58px",
        source:
          "book_cover",
      },
    });
  }

  if (
    input.templateType ===
    "social_square"
  ) {
    const buffer =
      await placeOnCanvas({
        image: bookCover,
        width: 1080,
        height: 1080,
        margin: 70,
        format: "jpeg",
      });

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1080,
      mimeType: "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "70px",
        source:
          "book_cover",
      },
    });
  }

  if (
    input.templateType ===
    "story_9x16"
  ) {
    const buffer =
      await placeOnCanvas({
        image: bookCover,
        width: 1080,
        height: 1920,
        margin: 96,
        format: "jpeg",
      });

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "96px",
        source:
          "book_cover",
      },
    });
  }

  if (
    input.templateType ===
    "gallery_thumbnail"
  ) {
    const buffer =
      await sharp(input.artwork)
        .resize(453, 640, {
          fit: "fill",
        })
        .webp({
          quality: 86,
          effort: 5,
        })
        .toBuffer();

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 453,
      height: 640,
      mimeType: "image/webp",
      extension: "webp",
      metadata: {
        source:
          "clean_artwork",
      },
    });
  }

  if (
    input.templateType ===
    "poster"
  ) {
    const buffer =
      await sharp(bookCover)
        .resize(1359, 1920, {
          fit: "fill",
        })
        .png({
          compressionLevel: 9,
        })
        .toBuffer();

    return result({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1359,
      height: 1920,
      mimeType: "image/png",
      extension: "png",
      metadata: {
        source:
          "book_cover",
        printDraft: true,
      },
    });
  }

  throw new Error(
    "The collectible-card template is intentionally disabled until the certification and claim layer is designed.",
  );
}
