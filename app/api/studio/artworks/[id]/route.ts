import { NextResponse } from "next/server";
import {
  getReviewReason,
  getStatusForReviewAction,
  isReviewAction,
} from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReviewRequest = Readonly<{
  action?: unknown;
  notes?: unknown;
}>;

function normalizeNotes(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

export async function PATCH(
  request: Request,
  context: Readonly<{
    params: Promise<{
      id: string;
    }>;
  }>,
) {
  const [access, params] = await Promise.all([getStudioAccess(), context.params]);

  if (!access.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please sign in again.",
      },
      {
        status: 401,
      },
    );
  }

  if (!access.authorized) {
    return NextResponse.json(
      {
        ok: false,
        message: "This account cannot access the studio.",
      },
      {
        status: 403,
      },
    );
  }

  let body: ReviewRequest;

  try {
    body = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "The review information is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isReviewAction(body.action)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Choose a valid review decision.",
      },
      {
        status: 400,
      },
    );
  }

  const notes = normalizeNotes(body.notes);
  const status = getStatusForReviewAction(body.action);
  const rejectionReason = getReviewReason(body.action);
  const approved = body.action === "approve";
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("artwork_variants")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        message: "The artwork could not be found.",
      },
      {
        status: 404,
      },
    );
  }

  const { error: updateError } = await supabase
    .from("artwork_variants")
    .update({
      status,
      human_notes: notes || null,
      rejection_reason: rejectionReason,
      approved_by: approved ? access.admin.userId : null,
      approved_at: approved ? new Date().toISOString() : null,
    })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        message: "The review could not be saved.",
      },
      {
        status: 500,
      },
    );
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: access.admin.userId,
    action: approved ? "artwork.approved" : "artwork.reviewed",
    entity_type: "artwork_variant",
    entity_id: params.id,
    details: {
      decision: body.action,
      notes: notes || null,
    },
  });

  return NextResponse.json({
    ok: true,
    status,
  });
}
