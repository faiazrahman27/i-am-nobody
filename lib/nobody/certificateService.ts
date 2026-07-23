import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NOBODY_BRAND } from "./brand";

export type CertificateVerification = Readonly<{
  found: boolean;
  valid: boolean;
  certificateCode: string;
  status: "valid" | "revoked" | "not_found";
  issuedAt: string | null;
  artworkCode: string | null;
  archetypeSlug: string | null;
  archetypeTitle: string | null;
  artworkSha256: string | null;
  verificationHash: string | null;
  verificationRecordVerified: boolean;
  referenceVerified: boolean;
  artworkFileVerified: boolean;
  gallerySlug: string | null;
  galleryPublished: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
}>;

export function normalizeCertificateCode(value: string) {
  return decodeURIComponent(value).trim().toUpperCase().replace(/\s+/g, "");
}

export async function getCertificateVerification(
  rawCode: string,
): Promise<CertificateVerification> {
  const certificateCode = normalizeCertificateCode(rawCode);
  const supabase = createSupabaseAdminClient();

  const { data: certificate, error } = await supabase
    .from("artwork_certificates")
    .select(
      "artwork_variant_id,certificate_code,status,artwork_sha256,reference_sha256,verification_hash,issued_at,revoked_at,revoked_reason,archetype_slug,metadata",
    )
    .eq("certificate_code", certificateCode)
    .maybeSingle();

  if (error || !certificate) {
    return {
      found: false,
      valid: false,
      certificateCode,
      status: "not_found",
      issuedAt: null,
      artworkCode: null,
      archetypeSlug: null,
      archetypeTitle: null,
      artworkSha256: null,
      verificationHash: null,
      verificationRecordVerified: false,
      referenceVerified: false,
      artworkFileVerified: false,
      gallerySlug: null,
      galleryPublished: false,
      revokedAt: null,
      revokedReason: null,
    };
  }

  const [{ data: artwork }, { data: archetype }, { data: gallery }] =
    await Promise.all([
      supabase
        .from("artwork_variants")
        .select("artwork_code,storage_bucket,storage_path,sha256")
        .eq("id", certificate.artwork_variant_id)
        .maybeSingle(),
      supabase
        .from("archetypes")
        .select("title_en")
        .eq("slug", certificate.archetype_slug)
        .maybeSingle(),
      supabase
        .from("gallery_entries")
        .select("slug,status,visibility,published_at")
        .eq("artwork_variant_id", certificate.artwork_variant_id)
        .maybeSingle(),
    ]);

  let artworkFileVerified = false;

  if (
    artwork &&
    artwork.sha256 === certificate.artwork_sha256 &&
    artwork.storage_bucket &&
    artwork.storage_path
  ) {
    const { data: file } = await supabase.storage
      .from(artwork.storage_bucket)
      .download(artwork.storage_path);

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const actualHash = createHash("sha256").update(buffer).digest("hex");
      artworkFileVerified = actualHash === certificate.artwork_sha256;
    }
  }

  const referenceVerified =
    certificate.reference_sha256 === NOBODY_BRAND.canonicalReference.sha256;

  const verificationTimestamp = new Date(certificate.issued_at).toISOString();
  const expectedVerificationHash = createHash("sha256")
    .update(
      `${certificate.certificate_code}:${certificate.artwork_sha256}:` +
        `${certificate.reference_sha256}:${verificationTimestamp}`,
    )
    .digest("hex");
  const verificationRecordVerified =
    expectedVerificationHash === certificate.verification_hash;

  const galleryPublished = Boolean(
    gallery &&
    gallery.status === "published" &&
    gallery.visibility === "public" &&
    gallery.published_at,
  );
  const valid =
    certificate.status === "valid" &&
    artworkFileVerified &&
    referenceVerified &&
    verificationRecordVerified;

  const certificateMetadata =
    certificate.metadata && typeof certificate.metadata === "object"
      ? (certificate.metadata as Record<string, unknown>)
      : {};

  const roleTitle =
    typeof certificateMetadata.role_title === "string"
      ? certificateMetadata.role_title.trim()
      : "";

  return {
    found: true,
    valid,
    certificateCode: certificate.certificate_code,
    status: certificate.status,
    issuedAt: certificate.issued_at,
    artworkCode: artwork?.artwork_code ?? null,
    archetypeSlug: certificate.archetype_slug,
    archetypeTitle: roleTitle || archetype?.title_en || null,
    artworkSha256: certificate.artwork_sha256,
    verificationHash: certificate.verification_hash,
    verificationRecordVerified,
    referenceVerified,
    artworkFileVerified,
    gallerySlug: gallery?.slug ?? null,
    galleryPublished,
    revokedAt: certificate.revoked_at,
    revokedReason: certificate.revoked_reason,
  };
}
