import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { renderNobodyTemplate } from "@/lib/nobody/templateRenderer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const [access, params] = await Promise.all([
    getStudioAccess(),
    context.params,
  ]);

  if (!access.authenticated) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!access.authorized) {
    return NextResponse.json({ error: "NOT_AUTHORIZED" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: artwork } = await supabase
    .from("artwork_variants")
    .select("storage_bucket,storage_path,sha256")
    .eq("id", params.id)
    .maybeSingle();

  if (!artwork?.sha256) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data: file } = await supabase.storage
    .from(artwork.storage_bucket)
    .download(artwork.storage_path);

  if (!file) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const actualHash = createHash("sha256").update(buffer).digest("hex");

  if (actualHash !== artwork.sha256) {
    return NextResponse.json({ error: "INTEGRITY_CHECK_FAILED" }, { status: 409 });
  }

  const rendered = await renderNobodyTemplate({
    artwork: buffer,
    templateType: "book_cover",
  });

  return new NextResponse(new Uint8Array(rendered.buffer), {
    status: 200,
    headers: {
      "Content-Type": rendered.mimeType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
