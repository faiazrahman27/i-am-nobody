import { NextResponse } from "next/server";
import { renderAndSaveArtworkTemplate } from "@/lib/nobody/renderService";
import type { Locale, TemplateType } from "@/lib/nobody";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ENABLED_TEMPLATE_TYPES: readonly TemplateType[] = [
  "clean_artwork",
  "book_cover",
  "social_4x5",
  "social_square",
  "story_9x16",
  "gallery_thumbnail",
  "poster",
  "collectible_card",
];

type RenderRequest = Readonly<{
  templateType?: unknown;
  locale?: unknown;
}>;

function isTemplateType(value: unknown): value is TemplateType {
  return (
    typeof value === "string" &&
    ENABLED_TEMPLATE_TYPES.includes(value as TemplateType)
  );
}

function normalizeLocale(value: unknown): Locale | null {
  return value === "it" || value === "en" ? value : null;
}

export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const [access, params] = await Promise.all([
    getStudioAccess(),
    context.params,
  ]);

  if (!access.authenticated) {
    return NextResponse.json(
      { ok: false, message: "Please sign in again." },
      { status: 401 },
    );
  }

  if (!access.authorized) {
    return NextResponse.json(
      { ok: false, message: "This account cannot access the studio." },
      { status: 403 },
    );
  }

  if (access.admin.role === "reviewer") {
    return NextResponse.json(
      {
        ok: false,
        message: "Reviewer accounts cannot create final production files.",
      },
      { status: 403 },
    );
  }

  let body: RenderRequest;

  try {
    body = (await request.json()) as RenderRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "The format request is invalid." },
      { status: 400 },
    );
  }

  if (!isTemplateType(body.templateType)) {
    return NextResponse.json(
      { ok: false, message: "Choose a supported final format." },
      { status: 400 },
    );
  }

  try {
    const render = await renderAndSaveArtworkTemplate({
      artworkId: params.id,
      templateType: body.templateType,
      locale: normalizeLocale(body.locale),
      actorUserId: access.admin.userId,
      siteUrl:
          process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          new URL(request.url).origin,
    });

    return NextResponse.json({ ok: true, render });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The final format could not be created.",
      },
      { status: 500 },
    );
  }
}
