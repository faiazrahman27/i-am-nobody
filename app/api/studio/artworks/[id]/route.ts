import { NextResponse } from "next/server";
import {
  getReviewReason,
  getStatusForReviewAction,
  isReviewAction,
} from "@/lib/nobody";
import { approveCertifyAndPrepareArtwork } from "@/lib/nobody/approvalService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

type ReviewRequest = Readonly<{
  action?: unknown;
  notes?: unknown;
}>;

const REVIEWABLE_STATUSES = new Set([
  "candidate",
  "reviewing",
  "auto_rejected",
  "auto_review_failed",
  "ready_for_review",
  "needs_regeneration",
  "wrong_mask",
  "wrong_composition",
  "too_busy",
  "too_literal",
  "too_generic",
]);

function normalizeNotes(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

export async function PATCH(
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

  let body: ReviewRequest;

  try {
    body = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "The review information is invalid." },
      { status: 400 },
    );
  }

  if (!isReviewAction(body.action)) {
    return NextResponse.json(
      { ok: false, message: "Choose a valid review decision." },
      { status: 400 },
    );
  }

  const notes = normalizeNotes(body.notes);
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("artwork_variants")
    .select("id,status,immutable_at")
    .eq("id", params.id)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json(
      { ok: false, message: "The artwork could not be found." },
      { status: 404 },
    );
  }

  if (!REVIEWABLE_STATUSES.has(existing.status)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This artwork has already entered the final-format or publication workflow.",
      },
      { status: 409 },
    );
  }

  if (body.action === "approve") {
    try {
      const approval = await approveCertifyAndPrepareArtwork({
        artworkId: existing.id,
        actorUserId: access.admin.userId,
        notes,
        siteUrl:
          process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          new URL(request.url).origin,
      });

      return NextResponse.json({
        ok: true,
        status: approval.status,
        certificateCode: approval.certificateCode,
        certificateId: approval.certificateId,
        preparationComplete: approval.preparationComplete,
        message: approval.preparationComplete
          ? "Artwork approved, certified, and prepared for publication."
          : "Artwork approved and certified. One or more final formats need to be retried from the artwork page.",
        preparationMessage: approval.preparationMessage,
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "The artwork could not be approved and certified.",
        },
        { status: 500 },
      );
    }
  }

  const status = getStatusForReviewAction(body.action);
  const rejectionReason = getReviewReason(body.action);

  const { error: updateError } = await supabase
    .from("artwork_variants")
    .update({
      status,
      human_notes: notes || null,
      rejection_reason: rejectionReason,
      approved_by: null,
      approved_at: null,
    })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: updateError.message || "The review could not be saved." },
      { status: 500 },
    );
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: access.admin.userId,
    action: "artwork.reviewed",
    entity_type: "artwork_variant",
    entity_id: params.id,
    details: {
      previous_status: existing.status,
      decision: body.action,
      notes: notes || null,
      immutable_master_preserved: Boolean(existing.immutable_at),
    },
  });

  return NextResponse.json({ ok: true, status });
}
