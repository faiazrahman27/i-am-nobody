import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: Readonly<{
    params: Promise<{
      slug: string;
    }>;
  }>,
) {
  const { slug } =
    await context.params;

  const supabase =
    createSupabaseAdminClient();

  const {
    data: gallery,
    error: galleryError,
  } = await supabase
    .from("gallery_entries")
    .select(
      "id,primary_render_id,status,visibility,published_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .not(
      "published_at",
      "is",
      null,
    )
    .maybeSingle();

  if (
    galleryError ||
    !gallery?.primary_render_id
  ) {
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const {
    data: render,
    error: renderError,
  } = await supabase
    .from("template_renders")
    .select(
      "storage_bucket,storage_path,mime_type,status,sha256",
    )
    .eq(
      "id",
      gallery.primary_render_id,
    )
    .in("status", [
      "ready",
      "published",
    ])
    .maybeSingle();

  if (
    renderError ||
    !render
  ) {
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const {
    data: file,
    error: fileError,
  } = await supabase.storage
    .from(
      render.storage_bucket,
    )
    .download(
      render.storage_path,
    );

  if (
    fileError ||
    !file
  ) {
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const bytes =
    new Uint8Array(
      await file.arrayBuffer(),
    );

  return new NextResponse(
    bytes,
    {
      status: 200,
      headers: {
        "Content-Type":
          render.mime_type,

        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",

        "Content-Disposition":
          `inline; filename="${slug}"`,

        ETag:
          render.sha256
            ? `"${render.sha256}"`
            : `W/"${bytes.byteLength}"`,

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}
