import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  renderNobodyTemplate,
} from "@/lib/nobody/templateRenderer";
import type {
  Locale,
  TemplateType,
} from "@/lib/nobody";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import {
  getStudioAccess,
} from "@/lib/supabase/studioAccess";

export const dynamic =
  "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ENABLED_TEMPLATE_TYPES:
  readonly TemplateType[] = [
    "clean_artwork",
    "book_cover",
    "social_4x5",
    "social_square",
    "story_9x16",
    "gallery_thumbnail",
    "poster",
  ];

type RenderRequest = Readonly<{
  templateType?: unknown;
  locale?: unknown;
}>;

function isTemplateType(
  value: unknown,
): value is TemplateType {
  return (
    typeof value === "string" &&
    ENABLED_TEMPLATE_TYPES.includes(
      value as TemplateType,
    )
  );
}

function normalizeLocale(
  value: unknown,
): Locale | null {
  return (
    value === "it" ||
    value === "en"
  )
    ? value
    : null;
}

export async function POST(
  request: Request,
  context: Readonly<{
    params: Promise<{
      id: string;
    }>;
  }>,
) {
  const [access, params] =
    await Promise.all([
      getStudioAccess(),
      context.params,
    ]);

  if (!access.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please sign in again.",
      },
      { status: 401 },
    );
  }

  if (!access.authorized) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This account cannot access the studio.",
      },
      { status: 403 },
    );
  }

  if (
    access.admin.role ===
    "reviewer"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Reviewer accounts cannot render production files.",
      },
      { status: 403 },
    );
  }

  let body: RenderRequest;

  try {
    body =
      (await request.json()) as
        RenderRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The template request is invalid.",
      },
      { status: 400 },
    );
  }

  if (
    !isTemplateType(
      body.templateType,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a supported template type.",
      },
      { status: 400 },
    );
  }

  const locale =
    normalizeLocale(
      body.locale,
    );

  const supabase =
    createSupabaseAdminClient();

  const {
    data: artwork,
    error: artworkError,
  } = await supabase
    .from("artwork_variants")
    .select(
      "id,artwork_code,status,storage_bucket,storage_path,sha256,immutable_at",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (
    artworkError ||
    !artwork
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The artwork could not be found.",
      },
      { status: 404 },
    );
  }

  if (
    ![
      "approved_artwork",
      "approved_for_template",
      "published",
    ].includes(
      artwork.status,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Approve the clean artwork before creating production templates.",
      },
      { status: 409 },
    );
  }

  if (
    !artwork.sha256 ||
    !artwork.immutable_at
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The approved master is missing its immutable integrity record.",
      },
      { status: 409 },
    );
  }

  const {
    data: storedArtwork,
    error: downloadError,
  } = await supabase.storage
    .from(
      artwork.storage_bucket,
    )
    .download(
      artwork.storage_path,
    );

  if (
    downloadError ||
    !storedArtwork
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          downloadError?.message ||
          "The artwork file is unavailable.",
      },
      { status: 500 },
    );
  }

  try {
    const artworkBuffer = Buffer.from(
      await storedArtwork.arrayBuffer(),
    );

    const actualArtworkSha256 =
      createHash("sha256")
        .update(artworkBuffer)
        .digest("hex");

    if (
      actualArtworkSha256 !==
      artwork.sha256
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The approved artwork failed its integrity check. Restore the original approved file before creating formats.",
        },
        { status: 409 },
      );
    }

    const rendered =
      await renderNobodyTemplate({
        artwork: artworkBuffer,
        templateType:
          body.templateType,
        locale,
      });

    const localeSegment =
      locale ?? "neutral";

    const storagePath =
      `templates/${artwork.artwork_code}/${body.templateType}-` +
      `${localeSegment}-${rendered.templateVersion}.${rendered.extension}`;

    const {
      error: uploadError,
    } = await supabase.storage
      .from("nobody-private")
      .upload(
        storagePath,
        rendered.buffer,
        {
          contentType:
            rendered.mimeType,
          upsert: true,
        },
      );

    if (uploadError) {
      throw new Error(
        uploadError.message,
      );
    }

    let existingQuery =
      supabase
        .from(
          "template_renders",
        )
        .select("id")
        .eq(
          "artwork_variant_id",
          artwork.id,
        )
        .eq(
          "template_type",
          body.templateType,
        )
        .eq(
          "template_version",
          rendered.templateVersion,
        );

    existingQuery = locale
      ? existingQuery.eq(
          "locale",
          locale,
        )
      : existingQuery.is(
          "locale",
          null,
        );

    const {
      data: existingRender,
    } = await existingQuery
      .maybeSingle();

    const renderValues = {
      artwork_variant_id:
        artwork.id,

      template_type:
        body.templateType,

      locale,

      template_version:
        rendered.templateVersion,

      storage_bucket:
        "nobody-private",

      storage_path:
        storagePath,

      mime_type:
        rendered.mimeType,

      width:
        rendered.width,

      height:
        rendered.height,

      status: "ready",

      sha256:
        rendered.sha256,

      error_message: null,

      rendered_at:
        new Date().toISOString(),

      metadata: {
        ...rendered.metadata,

        source_artwork_sha256:
          artwork.sha256,
      },

      created_by:
        access.admin.userId,
    };

    const renderMutation =
      existingRender
        ? supabase
            .from(
              "template_renders",
            )
            .update(
              renderValues,
            )
            .eq(
              "id",
              existingRender.id,
            )
            .select(
              "id,template_type,status,storage_path,width,height,mime_type",
            )
            .single()
        : supabase
            .from(
              "template_renders",
            )
            .insert(
              renderValues,
            )
            .select(
              "id,template_type,status,storage_path,width,height,mime_type",
            )
            .single();

    const {
      data: renderRow,
      error: renderError,
    } = await renderMutation;

    if (
      renderError ||
      !renderRow
    ) {
      throw new Error(
        renderError?.message ||
          "The template record could not be saved.",
      );
    }

    if (
      artwork.status ===
      "approved_artwork"
    ) {
      await supabase
        .from(
          "artwork_variants",
        )
        .update({
          status:
            "approved_for_template",
        })
        .eq(
          "id",
          artwork.id,
        );
    }

    await supabase
      .from(
        "studio_audit_log",
      )
      .insert({
        actor_user_id:
          access.admin.userId,

        action:
          "template.rendered",

        entity_type:
          "template_render",

        entity_id:
          renderRow.id,

        details: {
          artwork_variant_id:
            artwork.id,

          template_type:
            body.templateType,

          locale,

          sha256:
            rendered.sha256,
        },
      });

    const { data: signed } =
      await supabase.storage
        .from(
          "nobody-private",
        )
        .createSignedUrl(
          storagePath,
          60 * 60,
        );

    return NextResponse.json({
      ok: true,

      render: {
        ...renderRow,

        sha256:
          rendered.sha256,

        templateVersion:
          rendered
            .templateVersion,

        previewUrl:
          signed?.signedUrl ??
          null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The template could not be rendered.",
      },
      { status: 500 },
    );
  }
}
