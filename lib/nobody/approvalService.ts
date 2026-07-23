import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCertificateCode } from "./dailyAutomation";
import { getNobodyArchetype, isNobodyArchetypeSlug } from "./archetypes";
import { renderAndSaveArtworkTemplate } from "./renderService";

function makeGallerySlug(artworkCode: string) {
  return artworkCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type CertificateRpcRow = Readonly<{
  certificate_id: string;
  certificate_code: string;
  issued_at: string;
  verification_hash: string;
  artwork_status: string;
}>;

export type ApprovalResult = Readonly<{
  status: string;
  certificateCode: string;
  certificateId: string;
  preparationComplete: boolean;
  preparationMessage: string | null;
}>;

export async function approveCertifyAndPrepareArtwork(input: {
  artworkId: string;
  actorUserId: string;
  notes: string;
  siteUrl: string;
}): Promise<ApprovalResult> {
  const supabase = createSupabaseAdminClient();

  const { data: artwork, error: artworkError } = await supabase
    .from("artwork_variants")
    .select("id,artwork_code,job_id,status")
    .eq("id", input.artworkId)
    .maybeSingle();

  if (artworkError || !artwork) {
    throw new Error(artworkError?.message || "The artwork could not be found.");
  }

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .select("id,archetype_slug,metadata")
    .eq("id", artwork.job_id)
    .maybeSingle();

  if (jobError || !job || !isNobodyArchetypeSlug(job.archetype_slug)) {
    throw new Error("The artwork archetype is unavailable.");
  }

  let certificate: CertificateRpcRow | null = null;

  for (let attempt = 0; attempt < 4 && !certificate; attempt += 1) {
    const { data, error } = await supabase.rpc(
      "approve_artwork_and_issue_certificate",
      {
        p_artwork_variant_id: artwork.id,
        p_actor_user_id: input.actorUserId,
        p_human_notes: input.notes || null,
        p_certificate_code: createCertificateCode(),
      },
    );

    if (error) {
      if (error.code === "23505" && attempt < 3) {
        continue;
      }

      throw new Error(error.message);
    }

    const row = Array.isArray(data) ? data[0] : null;

    if (row) {
      certificate = row as CertificateRpcRow;
    }
  }

  if (!certificate) {
    throw new Error("The artwork certificate could not be issued.");
  }

  const archetype = getNobodyArchetype(job.archetype_slug);
  const jobMetadata =
    job.metadata && typeof job.metadata === "object"
      ? (job.metadata as Record<string, unknown>)
      : {};
  const metadataText = (key: string) =>
    typeof jobMetadata[key] === "string"
      ? (jobMetadata[key] as string).trim()
      : "";
  const roleTitle = metadataText("role_title") || archetype.title.en;
  const roleDescription =
    metadataText("life_context") || archetype.description.en;
  const conceptQuestion = metadataText("concept_question");
  const thresholdName = metadataText("threshold_name");
  const bookTheme = metadataText("book_theme");

  let preparationComplete = false;
  let preparationMessage: string | null = null;

  try {
    const [bookCover, galleryThumbnail] = await Promise.all([
      renderAndSaveArtworkTemplate({
        artworkId: artwork.id,
        templateType: "book_cover",
        actorUserId: input.actorUserId,
        siteUrl: input.siteUrl,
      }),
      renderAndSaveArtworkTemplate({
        artworkId: artwork.id,
        templateType: "gallery_thumbnail",
        actorUserId: input.actorUserId,
        siteUrl: input.siteUrl,
      }),
    ]);

    await renderAndSaveArtworkTemplate({
      artworkId: artwork.id,
      templateType: "collectible_card",
      actorUserId: input.actorUserId,
      siteUrl: input.siteUrl,
    });

    const galleryValues = {
      artwork_variant_id: artwork.id,
      primary_render_id: bookCover.id,
      archetype_slug: archetype.slug,
      slug: makeGallerySlug(artwork.artwork_code),
      collection_name: "I AM NOBODY — Official Artworks",
      title_it: roleTitle,
      title_en: roleTitle,
      description_it: roleDescription,
      description_en: roleDescription,
      philosophical_line_it: "Chi sei quando nessuno ti guarda?",
      philosophical_line_en: "Who are you when nobody is watching?",
      display_order: 100,
      featured: false,
      status: "draft",
      visibility: "private",
      published_at: null,
      unpublished_at: null,
      created_by: input.actorUserId,
      metadata: {
        artwork_code: artwork.artwork_code,
        certificate_code: certificate.certificate_code,
        certificate_id: certificate.certificate_id,
        gallery_thumbnail_render_id: galleryThumbnail.id,
        role_title: roleTitle,
        role_family: metadataText("role_family") || null,
        threshold_name: thresholdName || null,
        book_theme: bookTheme || null,
        concept_question: conceptQuestion || null,
      },
    };

    const { error: galleryError } = await supabase
      .from("gallery_entries")
      .upsert(galleryValues, { onConflict: "artwork_variant_id" });

    if (galleryError) {
      throw new Error(galleryError.message);
    }

    const { error: statusError } = await supabase
      .from("artwork_variants")
      .update({ status: "approved_for_template" })
      .eq("id", artwork.id)
      .neq("status", "published");

    if (statusError) {
      throw new Error(statusError.message);
    }

    preparationComplete = true;
  } catch (error) {
    preparationMessage =
      error instanceof Error
        ? error.message
        : "The final formats could not be prepared automatically.";

    console.error(
      "[I AM NOBODY] Approval completed, but final preparation needs attention.",
      error,
    );
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: input.actorUserId,
    action: "artwork.approved_and_certified",
    entity_type: "artwork_variant",
    entity_id: artwork.id,
    details: {
      previous_status: artwork.status,
      certificate_code: certificate.certificate_code,
      certificate_id: certificate.certificate_id,
      preparation_complete: preparationComplete,
      preparation_message: preparationMessage,
    },
  });

  const { data: currentArtwork } = await supabase
    .from("artwork_variants")
    .select("status")
    .eq("id", artwork.id)
    .maybeSingle();

  return {
    status:
      currentArtwork?.status ??
      (preparationComplete
        ? "approved_for_template"
        : certificate.artwork_status),
    certificateCode: certificate.certificate_code,
    certificateId: certificate.certificate_id,
    preparationComplete,
    preparationMessage,
  };
}
