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
  gamma: number;
  color: readonly [
    number,
    number,
    number,
  ];
}>;

const CANONICAL_WIDTH =
  NOBODY_BRAND.canonicalReference.width;

const CANONICAL_HEIGHT =
  NOBODY_BRAND.canonicalReference.height;

const WHITE_TEXT = [
  244,
  241,
  235,
] as const;

const GOLD_TEXT = [
  224,
  199,
  158,
] as const;

const TEXT_REGIONS:
  readonly TextRegion[] = [
    {
      x1: 384,
      y1: 584,
      x2: 406,
      y2: 640,
      low: 165,
      high: 232,
      gamma: 0.55,
      color: WHITE_TEXT,
    },
    {
      x1: 444,
      y1: 584,
      x2: 487,
      y2: 640,
      low: 175,
      high: 232,
      gamma: 0.55,
      color: WHITE_TEXT,
    },
    {
      x1: 494,
      y1: 584,
      x2: 542,
      y2: 640,
      low: 170,
      high: 232,
      gamma: 0.55,
      color: WHITE_TEXT,
    },
    {
      x1: 375,
      y1: 642,
      x2: 550,
      y2: 802,
      low: 150,
      high: 230,
      gamma: 0.5,
      color: WHITE_TEXT,
    },
    {
      x1: 290,
      y1: 800,
      x2: 645,
      y2: 963,
      low: 150,
      high: 230,
      gamma: 0.5,
      color: WHITE_TEXT,
    },
    {
      x1: 340,
      y1: 995,
      x2: 575,
      y2: 1075,
      low: 115,
      high: 205,
      gamma: 0.58,
      color: GOLD_TEXT,
    },
    {
      x1: 255,
      y1: 1145,
      x2: 660,
      y2: 1200,
      low: 115,
      high: 205,
      gamma: 0.58,
      color: GOLD_TEXT,
    },
  ];

const FRAME_REGIONS = {
  top: {
    left: 0,
    top: 0,
    width:
      CANONICAL_WIDTH,
    height: 28,
  },
  bottom: {
    left: 0,
    top: 1232,
    width:
      CANONICAL_WIDTH,
    height: 48,
  },
  left: {
    left: 0,
    top: 0,
    width: 69,
    height:
      CANONICAL_HEIGHT,
  },
  right: {
    left: 879,
    top: 0,
    width: 27,
    height:
      CANONICAL_HEIGHT,
  },
} as const;


export type NobodyCertificateRenderData = Readonly<{
  certificateCode: string;
  artworkCode: string;
  archetypeTitle: string;
  issuedAt: string;
  verificationUrl: string;
}>;

export type RenderedTemplate =
  Readonly<{
    buffer: Buffer;
    templateType:
      TemplateType;
    templateVersion:
      string;
    locale:
      Locale | null;
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
      Record<
        string,
        unknown
      >
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
  return createHash(
    "sha256",
  )
    .update(buffer)
    .digest("hex");
}

function makeResult(
  input: Omit<
    RenderedTemplate,
    | "sha256"
    | "templateVersion"
  >,
): RenderedTemplate {
  return {
    ...input,
    templateVersion:
      NOBODY_TEMPLATE_VERSION,
    sha256:
      digest(
        input.buffer,
      ),
  };
}

async function extractRegion(
  source: Buffer,
  region: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>,
) {
  return sharp(source)
    .extract(region)
    .png()
    .toBuffer();
}

async function buildTypographyOverlay(
  originalCover: Buffer,
) {
  const {
    data,
    info,
  } = await sharp(
    originalCover,
  )
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject:
        true,
    });

  if (
    info.width !==
      CANONICAL_WIDTH ||
    info.height !==
      CANONICAL_HEIGHT ||
    info.channels !== 4
  ) {
    throw new Error(
      "The canonical cover dimensions changed unexpectedly.",
    );
  }

  const overlay =
    Buffer.alloc(
      CANONICAL_WIDTH *
        CANONICAL_HEIGHT *
        4,
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
        const sourceIndex =
          (y *
            CANONICAL_WIDTH +
            x) *
          4;

        const red =
          data[
            sourceIndex
          ] ?? 0;

        const green =
          data[
            sourceIndex + 1
          ] ?? 0;

        const blue =
          data[
            sourceIndex + 2
          ] ?? 0;

        const luminance =
          getLuma(
            red,
            green,
            blue,
          );

        const normalized =
          Math.max(
            0,
            Math.min(
              1,
              (luminance -
                region.low) /
                (region.high -
                  region.low),
            ),
          );

        const alpha =
          clampByte(
            Math.pow(
              normalized,
              region.gamma,
            ) * 255,
          );

        if (
          alpha <=
          (overlay[
            sourceIndex + 3
          ] ?? 0)
        ) {
          continue;
        }

        overlay[
          sourceIndex
        ] = region.color[0];

        overlay[
          sourceIndex + 1
        ] = region.color[1];

        overlay[
          sourceIndex + 2
        ] = region.color[2];

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
      const sourceIndex =
        (y *
          CANONICAL_WIDTH +
          x) *
        4;

      const red =
        data[
          sourceIndex
        ] ?? 0;

      const green =
        data[
          sourceIndex + 1
        ] ?? 0;

      const blue =
        data[
          sourceIndex + 2
        ] ?? 0;

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
          : (maximum -
              minimum) /
            maximum;

      if (
        saturation <=
          0.2 ||
        maximum <= 55
      ) {
        continue;
      }

      overlay[
        sourceIndex
      ] = red;

      overlay[
        sourceIndex + 1
      ] = green;

      overlay[
        sourceIndex + 2
      ] = blue;

      overlay[
        sourceIndex + 3
      ] = clampByte(
        ((saturation -
          0.2) /
          0.35) *
          255,
      );
    }
  }

  return sharp(
    overlay,
    {
      raw: {
        width:
          CANONICAL_WIDTH,
        height:
          CANONICAL_HEIGHT,
        channels: 4,
      },
    },
  )
    .png()
    .toBuffer();
}

async function buildBookCover(
  artwork: Buffer,
) {
  const {
    originalCover,
  } =
    await loadCanonicalReferenceAssets();

  const [
    normalizedArtwork,
    typographyOverlay,
    topFrame,
    bottomFrame,
    leftFrame,
    rightFrame,
  ] = await Promise.all([
    sharp(artwork)
      .resize(
        CANONICAL_WIDTH,
        CANONICAL_HEIGHT,
        {
          fit: "fill",
        },
      )
      .removeAlpha()
      .png({
        compressionLevel: 9,
        adaptiveFiltering:
          true,
      })
      .toBuffer(),

    buildTypographyOverlay(
      originalCover,
    ),

    extractRegion(
      originalCover,
      FRAME_REGIONS.top,
    ),

    extractRegion(
      originalCover,
      FRAME_REGIONS.bottom,
    ),

    extractRegion(
      originalCover,
      FRAME_REGIONS.left,
    ),

    extractRegion(
      originalCover,
      FRAME_REGIONS.right,
    ),
  ]);

  return sharp(
    normalizedArtwork,
  )
    .composite([
      {
        input:
          topFrame,
        left: 0,
        top: 0,
      },
      {
        input:
          bottomFrame,
        left: 0,
        top: 1232,
      },
      {
        input:
          leftFrame,
        left: 0,
        top: 0,
      },
      {
        input:
          rightFrame,
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
      adaptiveFiltering:
        true,
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
    await sharp(
      input.image,
    )
      .resize(
        input.width,
        input.height,
        {
          fit: "cover",
        },
      )
      .blur(34)
      .modulate({
        brightness: 0.32,
        saturation: 0.55,
      })
      .toBuffer();

  const foreground =
    await sharp(
      input.image,
    )
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
    sharp(
      background,
    ).composite([
      {
        input:
          foreground,
        left:
          input.margin,
        top:
          input.margin,
      },
    ]);

  if (
    input.format ===
    "webp"
  ) {
    return canvas
      .webp({
        quality: 90,
        effort: 5,
      })
      .toBuffer();
  }

  if (
    input.format ===
    "jpeg"
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


function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatCertificateDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(date);
}

async function buildCertificateCard(
  artwork: Buffer,
  certificate: NobodyCertificateRenderData,
) {
  const width = 1359;
  const height = 1920;
  const artworkWidth = 983;
  const artworkHeight = 1388;
  const artworkLeft = Math.round((width - artworkWidth) / 2);
  const artworkTop = 178;

  const normalizedArtwork = await sharp(artwork)
    .resize(artworkWidth, artworkHeight, {
      fit: "fill",
    })
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const certificateCode = escapeXml(certificate.certificateCode);
  const artworkCode = escapeXml(certificate.artworkCode);
  const archetypeTitle = escapeXml(certificate.archetypeTitle.toUpperCase());
  const issuedAt = escapeXml(formatCertificateDate(certificate.issuedAt));
  const verificationUrl = escapeXml(certificate.verificationUrl);

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="iris" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#35a8c5"/>
          <stop offset="0.25" stop-color="#3eb889"/>
          <stop offset="0.5" stop-color="#e0bf81"/>
          <stop offset="0.75" stop-color="#d08a9b"/>
          <stop offset="1" stop-color="#7661a7"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#070707"/>
      <rect x="0" y="0" width="${width}" height="6" fill="url(#iris)"/>
      <rect x="${artworkLeft - 1}" y="${artworkTop - 1}" width="${artworkWidth + 2}" height="${artworkHeight + 2}" fill="none" stroke="#e0bf81" stroke-opacity="0.42" stroke-width="2"/>
      <text x="92" y="92" fill="#f2eee6" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="8">I AM NOBODY</text>
      <text x="1267" y="92" text-anchor="end" fill="#e0bf81" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="4">CERTIFICATE OF AUTHENTICITY</text>
      <line x1="92" y1="126" x2="1267" y2="126" stroke="#ffffff" stroke-opacity="0.15"/>
      <text x="92" y="1630" fill="#9d9488" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" letter-spacing="3">OFFICIAL ARTWORK</text>
      <text x="92" y="1692" fill="#f2eee6" font-family="Georgia, 'Times New Roman', serif" font-size="62" letter-spacing="2">${archetypeTitle}</text>
      <text x="92" y="1754" fill="#e0bf81" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="700" letter-spacing="5">${certificateCode}</text>
      <text x="92" y="1810" fill="#9d9488" font-family="Arial, Helvetica, sans-serif" font-size="18">Artwork ${artworkCode} · Issued ${issuedAt}</text>
      <text x="1267" y="1754" text-anchor="end" fill="#f2eee6" font-family="Arial, Helvetica, sans-serif" font-size="18">Verify this artwork</text>
      <text x="1267" y="1787" text-anchor="end" fill="#e0bf81" font-family="Arial, Helvetica, sans-serif" font-size="17">${verificationUrl}</text>
      <line x1="92" y1="1844" x2="1267" y2="1844" stroke="#ffffff" stroke-opacity="0.15"/>
      <text x="92" y="1883" fill="#77716a" font-family="Arial, Helvetica, sans-serif" font-size="15">The approved artwork file is unchanged. This certificate is its permanent verification record.</text>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 7, g: 7, b: 7, alpha: 1 },
    },
  })
    .composite([
      { input: normalizedArtwork, left: artworkLeft, top: artworkTop },
      { input: overlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export async function renderNobodyTemplate(
  input: {
    artwork: Buffer;
    templateType:
      TemplateType;
    locale?:
      Locale | null;
    certificate?:
      NobodyCertificateRenderData | null;
  },
): Promise<RenderedTemplate> {
  const locale =
    input.locale ?? null;

  if (
    input.templateType ===
    "clean_artwork"
  ) {
    const buffer =
      await sharp(
        input.artwork,
      )
        .resize(
          CANONICAL_WIDTH,
          CANONICAL_HEIGHT,
          {
            fit: "fill",
          },
        )
        .removeAlpha()
        .png({
          compressionLevel: 9,
          adaptiveFiltering:
            true,
        })
        .toBuffer();

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width:
        CANONICAL_WIDTH,
      height:
        CANONICAL_HEIGHT,
      mimeType:
        "image/png",
      extension: "png",
      metadata: {
        controlledLayer:
          "none",
        cropPolicy:
          "no-destructive-crop",
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
    return makeResult({
      buffer: bookCover,
      templateType:
        input.templateType,
      locale,
      width:
        CANONICAL_WIDTH,
      height:
        CANONICAL_HEIGHT,
      mimeType:
        "image/png",
      extension: "png",
      metadata: {
        controlledLayer:
          "canonical-cover-frame-and-typography",
        sourceCanvas:
          "906x1280",
        cropPolicy:
          "no-destructive-crop",
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

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1350,
      mimeType:
        "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "58px",
        source:
          "book_cover",
        cropPolicy:
          "contained-master-on-background",
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

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1080,
      mimeType:
        "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "70px",
        source:
          "book_cover",
        cropPolicy:
          "contained-master-on-background",
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

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1080,
      height: 1920,
      mimeType:
        "image/jpeg",
      extension: "jpg",
      metadata: {
        safeArea: "96px",
        source:
          "book_cover",
        cropPolicy:
          "contained-master-on-background",
      },
    });
  }

  if (
    input.templateType ===
    "gallery_thumbnail"
  ) {
    const buffer =
      await sharp(
        input.artwork,
      )
        .resize(
          453,
          640,
          {
            fit: "fill",
          },
        )
        .webp({
          quality: 86,
          effort: 5,
        })
        .toBuffer();

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 453,
      height: 640,
      mimeType:
        "image/webp",
      extension: "webp",
      metadata: {
        source:
          "clean_artwork",
        cropPolicy:
          "no-destructive-crop",
      },
    });
  }

  if (
    input.templateType ===
    "poster"
  ) {
    const buffer =
      await sharp(
        bookCover,
      )
        .resize(
          1359,
          1920,
          {
            fit: "fill",
          },
        )
        .png({
          compressionLevel: 9,
          adaptiveFiltering:
            true,
        })
        .toBuffer();

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1359,
      height: 1920,
      mimeType:
        "image/png",
      extension: "png",
      metadata: {
        source:
          "book_cover",
        printDraft: true,
        cropPolicy:
          "no-destructive-crop",
      },
    });
  }

  if (
    input.templateType ===
    "collectible_card"
  ) {
    if (!input.certificate) {
      throw new Error(
        "This artwork must have a certificate before its certificate card can be created.",
      );
    }

    const buffer =
      await buildCertificateCard(
        input.artwork,
        input.certificate,
      );

    return makeResult({
      buffer,
      templateType:
        input.templateType,
      locale,
      width: 1359,
      height: 1920,
      mimeType:
        "image/png",
      extension: "png",
      metadata: {
        source:
          "approved_artwork",
        certificateCode:
          input.certificate.certificateCode,
        verificationUrl:
          input.certificate.verificationUrl,
        cropPolicy:
          "no-destructive-crop",
      },
    });
  }

  throw new Error(
    "Choose a supported final format.",
  );
}