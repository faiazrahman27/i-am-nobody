import { createHash } from "node:crypto";
import {
  NextResponse,
} from "next/server";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export async function GET(
  request: Request,
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
    error:
      galleryError,
  } = await supabase
    .from(
      "gallery_entries",
    )
    .select(
      "id,primary_render_id,status,visibility,published_at",
    )
    .eq(
      "slug",
      slug,
    )
    .eq(
      "status",
      "published",
    )
    .eq(
      "visibility",
      "public",
    )
    .not(
      "published_at",
      "is",
      null,
    )
    .maybeSingle();

  if (
    galleryError ||
    !gallery
      ?.primary_render_id
  ) {
    return NextResponse.json(
      {
        error:
          "NOT_FOUND",
      },
      {
        status: 404,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const {
    data: render,
    error:
      renderError,
  } = await supabase
    .from(
      "template_renders",
    )
    .select(
      "storage_bucket,storage_path,mime_type,status,sha256",
    )
    .eq(
      "id",
      gallery.primary_render_id,
    )
    .in(
      "status",
      [
        "ready",
        "published",
      ],
    )
    .maybeSingle();

  if (
    renderError ||
    !render
  ) {
    return NextResponse.json(
      {
        error:
          "NOT_FOUND",
      },
      {
        status: 404,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const etag =
    render.sha256
      ? `"${render.sha256}"`
      : null;

  if (
    etag &&
    request.headers.get(
      "if-none-match",
    ) === etag
  ) {
    return new NextResponse(
      null,
      {
        status: 304,

        headers: {
          ETag: etag,

          "Cache-Control":
            "public, max-age=0, s-maxage=0, must-revalidate",
        },
      },
    );
  }

  const {
    data: file,
    error:
      fileError,
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
      {
        error:
          "NOT_FOUND",
      },
      {
        status: 404,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const bytes =
    new Uint8Array(
      await file.arrayBuffer(),
    );

  if (render.sha256) {
    const actualSha256 =
      createHash("sha256")
        .update(bytes)
        .digest("hex");

    if (
      actualSha256 !==
      render.sha256
    ) {
      return NextResponse.json(
        {
          error:
            "NOT_FOUND",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }
  }

  return new NextResponse(
    bytes,
    {
      status: 200,

      headers: {
        "Content-Type":
          render.mime_type,

        "Content-Length":
          String(
            bytes.byteLength,
          ),

        "Cache-Control":
          "public, max-age=0, s-maxage=0, must-revalidate",

        "Content-Disposition":
          `inline; filename="${slug}"`,

        ETag:
          etag ??
          `W/"${bytes.byteLength}"`,

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}