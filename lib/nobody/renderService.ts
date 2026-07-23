import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  renderNobodyTemplate,
  type NobodyCertificateRenderData,
} from "./templateRenderer";
import type { Locale, TemplateType } from "./types";

export type SavedTemplateRender = Readonly<{
  id: string;
  template_type: string;
  status: string;
  storage_path: string;
  width: number;
  height: number;
  mime_type: string;
  sha256: string;
  previewUrl: string | null;
}>;

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function loadCertificateData(
  artworkId: string,
  siteUrl: string,
): Promise<NobodyCertificateRenderData> {
  const supabase = createSupabaseAdminClient();

  const { data: certificate, error } = await supabase
    .from("artwork_certificates")
    .select("certificate_code,issued_at,archetype_slug,metadata")
    .eq("artwork_variant_id", artworkId)
    .eq("status", "valid")
    .maybeSingle();

  if (error || !certificate) {
    throw new Error(
      error?.message || "This artwork does not have a valid certificate yet.",
    );
  }

  const [{ data: artwork }, { data: archetype }] = await Promise.all([
    supabase
      .from("artwork_variants")
      .select("artwork_code")
      .eq("id", artworkId)
      .maybeSingle(),
    supabase
      .from("archetypes")
      .select("title_en")
      .eq("slug", certificate.archetype_slug)
      .maybeSingle(),
  ]);

  if (!artwork || !archetype) {
    throw new Error("The certificate artwork details are unavailable.");
  }

  const certificateMetadata =
    certificate.metadata && typeof certificate.metadata === "object"
      ? (certificate.metadata as Record<string, unknown>)
      : {};

  const roleTitle =
    typeof certificateMetadata.role_title === "string"
      ? certificateMetadata.role_title.trim()
      : "";

  return {
    certificateCode: certificate.certificate_code,
    artworkCode: artwork.artwork_code,
    archetypeTitle: roleTitle || archetype.title_en,
    issuedAt: certificate.issued_at,
    verificationUrl: `${siteUrl.replace(/\/$/, "")}/verify/${encodeURIComponent(
      certificate.certificate_code,
    )}`,
  };
}

export async function renderAndSaveArtworkTemplate(input: {
  artworkId: string;
  templateType: TemplateType;
  locale?: Locale | null;
  actorUserId: string;
  siteUrl: string;
}): Promise<SavedTemplateRender> {
  const supabase = createSupabaseAdminClient();
  const locale = input.locale ?? null;

  const { data: artwork, error: artworkError } = await supabase
    .from("artwork_variants")
    .select(
      "id,artwork_code,status,storage_bucket,storage_path,sha256,immutable_at",
    )
    .eq("id", input.artworkId)
    .maybeSingle();

  if (artworkError || !artwork) {
    throw new Error(artworkError?.message || "The artwork could not be found.");
  }

  if (
    !["approved_artwork", "approved_for_template", "published"].includes(
      artwork.status,
    )
  ) {
    throw new Error("Approve the artwork before creating final formats.");
  }

  if (!artwork.sha256 || !artwork.immutable_at) {
    throw new Error("The approved artwork integrity record is incomplete.");
  }

  const { data: storedArtwork, error: downloadError } = await supabase.storage
    .from(artwork.storage_bucket)
    .download(artwork.storage_path);

  if (downloadError || !storedArtwork) {
    throw new Error(
      downloadError?.message || "The artwork file is unavailable.",
    );
  }

  const artworkBuffer = Buffer.from(await storedArtwork.arrayBuffer());

  if (sha256(artworkBuffer) !== artwork.sha256) {
    throw new Error(
      "The approved artwork failed its integrity check. Restore the approved file before creating formats.",
    );
  }

  const certificate =
    input.templateType === "collectible_card"
      ? await loadCertificateData(input.artworkId, input.siteUrl)
      : null;

  const rendered = await renderNobodyTemplate({
    artwork: artworkBuffer,
    templateType: input.templateType,
    locale,
    certificate,
  });

  const localeSegment = locale ?? "neutral";
  const storagePath =
    `templates/${artwork.artwork_code}/${input.templateType}-` +
    `${localeSegment}-${rendered.templateVersion}.${rendered.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("nobody-private")
    .upload(storagePath, rendered.buffer, {
      contentType: rendered.mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  let existingQuery = supabase
    .from("template_renders")
    .select("id")
    .eq("artwork_variant_id", artwork.id)
    .eq("template_type", input.templateType)
    .eq("template_version", rendered.templateVersion);

  existingQuery = locale
    ? existingQuery.eq("locale", locale)
    : existingQuery.is("locale", null);

  const { data: existingRender } = await existingQuery.maybeSingle();

  const renderValues = {
    artwork_variant_id: artwork.id,
    template_type: input.templateType,
    locale,
    template_version: rendered.templateVersion,
    storage_bucket: "nobody-private",
    storage_path: storagePath,
    mime_type: rendered.mimeType,
    width: rendered.width,
    height: rendered.height,
    status: "ready",
    sha256: rendered.sha256,
    error_message: null,
    rendered_at: new Date().toISOString(),
    metadata: {
      ...rendered.metadata,
      source_artwork_sha256: artwork.sha256,
    },
    created_by: input.actorUserId,
  };

  const mutation = existingRender
    ? supabase
        .from("template_renders")
        .update(renderValues)
        .eq("id", existingRender.id)
        .select(
          "id,template_type,status,storage_path,width,height,mime_type,sha256",
        )
        .single()
    : supabase
        .from("template_renders")
        .insert(renderValues)
        .select(
          "id,template_type,status,storage_path,width,height,mime_type,sha256",
        )
        .single();

  const { data: renderRow, error: renderError } = await mutation;

  if (renderError || !renderRow) {
    throw new Error(
      renderError?.message || "The final format could not be saved.",
    );
  }

  if (artwork.status === "approved_artwork") {
    await supabase
      .from("artwork_variants")
      .update({ status: "approved_for_template" })
      .eq("id", artwork.id);
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: input.actorUserId,
    action: "template.rendered",
    entity_type: "template_render",
    entity_id: renderRow.id,
    details: {
      artwork_variant_id: artwork.id,
      template_type: input.templateType,
      locale,
      sha256: rendered.sha256,
    },
  });

  const { data: signed } = await supabase.storage
    .from("nobody-private")
    .createSignedUrl(storagePath, 60 * 60);

  return {
    ...renderRow,
    previewUrl: signed?.signedUrl ?? null,
  } as SavedTemplateRender;
}
