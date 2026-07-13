import { NextResponse } from "next/server";
import {
  getNobodyArchetype,
  isNobodyArchetypeSlug,
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

type GalleryAction =
  | "create_draft"
  | "publish"
  | "unpublish";

type GalleryRequest = Readonly<{
  action?: unknown;
  primaryRenderId?: unknown;
  featured?: unknown;
  displayOrder?: unknown;
}>;

function isGalleryAction(
  value: unknown,
): value is GalleryAction {
  return (
    value === "create_draft" ||
    value === "publish" ||
    value === "unpublish"
  );
}

function makeSlug(
  artworkCode: string,
) {
  return artworkCode
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(/^-|-$/g, "");
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
          "Reviewer accounts cannot publish gallery entries.",
      },
      { status: 403 },
    );
  }

  let body: GalleryRequest;

  try {
    body =
      (await request.json()) as
        GalleryRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The gallery request is invalid.",
      },
      { status: 400 },
    );
  }

  if (
    !isGalleryAction(
      body.action,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a valid gallery action.",
      },
      { status: 400 },
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const {
    data: artwork,
    error: artworkError,
  } = await supabase
    .from("artwork_variants")
    .select(
      "id,artwork_code,status,job_id",
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

  const { data: job } =
    await supabase
      .from("generation_jobs")
      .select("archetype_slug")
      .eq("id", artwork.job_id)
      .maybeSingle();

  if (
    !job ||
    !isNobodyArchetypeSlug(
      job.archetype_slug,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The artwork archetype is unavailable.",
      },
      { status: 409 },
    );
  }

  const archetype =
    getNobodyArchetype(
      job.archetype_slug,
    );

  if (
    body.action ===
    "create_draft"
  ) {
    if (
      ![
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
            "Create at least one approved template before a gallery draft.",
        },
        { status: 409 },
      );
    }

    let primaryRenderId =
      typeof body.primaryRenderId ===
      "string"
        ? body.primaryRenderId
        : "";

    if (!primaryRenderId) {
      const {
        data: defaultRender,
      } = await supabase
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
          "book_cover",
        )
        .eq("status", "ready")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      primaryRenderId =
        defaultRender?.id ?? "";
    }

    if (!primaryRenderId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Render the Book cover template before creating the gallery draft.",
        },
        { status: 409 },
      );
    }

    const { data: render } =
      await supabase
        .from(
          "template_renders",
        )
        .select("id,status")
        .eq(
          "id",
          primaryRenderId,
        )
        .eq(
          "artwork_variant_id",
          artwork.id,
        )
        .maybeSingle();

    if (
      !render ||
      render.status !== "ready"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Choose a ready template render for the gallery.",
        },
        { status: 409 },
      );
    }

    const displayOrder =
      typeof body.displayOrder ===
        "number" &&
      Number.isInteger(
        body.displayOrder,
      )
        ? Math.max(
            0,
            body.displayOrder,
          )
        : 100;

    const values = {
      artwork_variant_id:
        artwork.id,

      primary_render_id:
        primaryRenderId,

      archetype_slug:
        archetype.slug,

      slug:
        makeSlug(
          artwork.artwork_code,
        ),

      title_it:
        archetype.title.it,

      title_en:
        archetype.title.en,

      description_it:
        archetype.description.it,

      description_en:
        archetype.description.en,

      display_order:
        displayOrder,

      featured:
        body.featured === true,

      status: "draft",

      visibility: "private",

      published_at: null,

      unpublished_at: null,

      created_by:
        access.admin.userId,

      metadata: {
        artwork_code:
          artwork.artwork_code,

        collection:
          "I AM NOBODY — Archetypes",
      },
    };

    const {
      data: gallery,
      error: galleryError,
    } = await supabase
      .from("gallery_entries")
      .upsert(values, {
        onConflict:
          "artwork_variant_id",
      })
      .select(
        "id,slug,status,visibility,primary_render_id",
      )
      .single();

    if (
      galleryError ||
      !gallery
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            galleryError?.message ||
            "The gallery draft could not be saved.",
        },
        { status: 500 },
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
          "gallery.draft_created",

        entity_type:
          "gallery_entry",

        entity_id:
          gallery.id,

        details: {
          artwork_variant_id:
            artwork.id,

          primary_render_id:
            primaryRenderId,
        },
      });

    return NextResponse.json({
      ok: true,
      gallery,
    });
  }

  const {
    data: gallery,
    error: galleryError,
  } = await supabase
    .from("gallery_entries")
    .select(
      "id,slug,status,visibility,primary_render_id",
    )
    .eq(
      "artwork_variant_id",
      artwork.id,
    )
    .maybeSingle();

  if (
    galleryError ||
    !gallery
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Create the gallery draft first.",
      },
      { status: 409 },
    );
  }

  if (
    body.action === "publish"
  ) {
    if (
      !gallery.primary_render_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The gallery draft has no primary render.",
        },
        { status: 409 },
      );
    }

    const publishedAt =
      new Date().toISOString();

    const {
      error: publishError,
    } = await supabase
      .from("gallery_entries")
      .update({
        status: "published",
        visibility: "public",
        published_at:
          publishedAt,
        unpublished_at: null,
      })
      .eq("id", gallery.id);

    if (publishError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            publishError.message ||
            "The artwork could not be published.",
        },
        { status: 500 },
      );
    }

    await supabase
      .from(
        "artwork_variants",
      )
      .update({
        status: "published",
      })
      .eq("id", artwork.id);

    await supabase
      .from(
        "studio_audit_log",
      )
      .insert({
        actor_user_id:
          access.admin.userId,

        action:
          "gallery.published",

        entity_type:
          "gallery_entry",

        entity_id:
          gallery.id,

        details: {
          artwork_variant_id:
            artwork.id,

          slug:
            gallery.slug,
        },
      });

    return NextResponse.json({
      ok: true,

      gallery: {
        ...gallery,
        status: "published",
        visibility: "public",
        published_at:
          publishedAt,
      },
    });
  }

  const unpublishedAt =
    new Date().toISOString();

  const {
    error: unpublishError,
  } = await supabase
    .from("gallery_entries")
    .update({
      status: "draft",
      visibility: "private",
      published_at: null,
      unpublished_at:
        unpublishedAt,
    })
    .eq("id", gallery.id);

  if (unpublishError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          unpublishError.message ||
          "The artwork could not be unpublished.",
      },
      { status: 500 },
    );
  }

  await supabase
    .from("artwork_variants")
    .update({
      status:
        "approved_for_template",
    })
    .eq("id", artwork.id);

  await supabase
    .from("studio_audit_log")
    .insert({
      actor_user_id:
        access.admin.userId,

      action:
        "gallery.unpublished",

      entity_type:
        "gallery_entry",

      entity_id:
        gallery.id,

      details: {
        artwork_variant_id:
          artwork.id,

        slug:
          gallery.slug,
      },
    });

  return NextResponse.json({
    ok: true,

    gallery: {
      ...gallery,
      status: "draft",
      visibility: "private",
      published_at: null,
    },
  });
}
