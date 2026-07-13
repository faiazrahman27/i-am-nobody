import { NextResponse } from "next/server";
import {
  getReviewReason,
  isReviewAction,
} from "@/lib/nobody";
import type {
  ImageQuality,
  ReviewAction,
} from "@/lib/nobody";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import {
  getStudioAccess,
} from "@/lib/supabase/studioAccess";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

type RegenerateRequest =
  Readonly<{
    reason?: unknown;
    notes?: unknown;
    quality?: unknown;
  }>;

type GenerateResponse =
  Readonly<{
    ok?: boolean;
    message?: string;
    jobId?: string;
    variants?: ReadonlyArray<
      Readonly<{
        id: string;
      }>
    >;
  }>;

const REGENERATION_REASONS =
  new Set<ReviewAction>([
    "needs_regeneration",
    "wrong_mask",
    "wrong_composition",
    "too_busy",
    "too_literal",
    "too_generic",
  ]);

function normalizeNotes(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(0, 1200)
    : "";
}

function normalizeQuality(
  value: unknown,
  fallback: ImageQuality,
): ImageQuality {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high"
  )
    ? value
    : fallback;
}

function buildVariationDirection(
  input: {
    previousDirection:
      string | null;
    reason:
      ReviewAction;
    notes: string;
  },
) {
  const reasonText =
    getReviewReason(
      input.reason,
    ) ??
    "Another controlled version is required";

  return [
    input.previousDirection,

    `Correction requested: ${reasonText}.`,

    input.notes
      ? `Human review note: ${input.notes}.`
      : "",

    "Preserve the canonical Nobody identity, front-facing composition, body distance, warm restrained background, and text-free clean-artwork output.",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .slice(0, 279);
}

export async function POST(
  request: Request,
  context: Readonly<{
    params: Promise<{
      id: string;
    }>;
  }>,
) {
  const [
    access,
    params,
  ] = await Promise.all([
    getStudioAccess(),
    context.params,
  ]);

  if (
    !access.authenticated
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Please sign in again.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !access.authorized
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This account cannot access the studio.",
      },
      {
        status: 403,
      },
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
          "Reviewer accounts can save decisions, while owners and editors can create another version.",
      },
      {
        status: 403,
      },
    );
  }

  let body:
    RegenerateRequest;

  try {
    body =
      (await request.json()) as
        RegenerateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The regeneration request is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !isReviewAction(
      body.reason,
    ) ||
    !REGENERATION_REASONS.has(
      body.reason,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Choose a valid regeneration reason.",
      },
      {
        status: 400,
      },
    );
  }

  const reason =
    body.reason;

  const notes =
    normalizeNotes(
      body.notes,
    );

  const supabase =
    createSupabaseAdminClient();

  const {
    data: variant,
    error:
      variantError,
  } = await supabase
    .from(
      "artwork_variants",
    )
    .select(
      "id,job_id,status,generation_attempt",
    )
    .eq(
      "id",
      params.id,
    )
    .maybeSingle();

  if (
    variantError ||
    !variant
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The artwork could not be found.",
      },
      {
        status: 404,
      },
    );
  }

  const {
    data: job,
    error:
      jobError,
  } = await supabase
    .from(
      "generation_jobs",
    )
    .select(
      "archetype_slug,clothing_notes,mood_notes,background_variant,prop,variation_direction,quality",
    )
    .eq(
      "id",
      variant.job_id,
    )
    .maybeSingle();

  if (
    jobError ||
    !job
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The source generation job is unavailable.",
      },
      {
        status: 409,
      },
    );
  }

  const quality =
    normalizeQuality(
      body.quality,
      job.quality as ImageQuality,
    );

  const variationDirection =
    buildVariationDirection({
      previousDirection:
        job.variation_direction,

      reason,

      notes,
    });

  const origin =
    new URL(
      request.url,
    ).origin;

  const cookie =
    request.headers.get(
      "cookie",
    ) ?? "";

  const generationResponse =
    await fetch(
      `${origin}/api/studio/generate`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          cookie,
        },

        body:
          JSON.stringify({
            archetype:
              job.archetype_slug,

            clothingNotes:
              job.clothing_notes ??
              "",

            moodNotes:
              job.mood_notes ??
              "",

            backgroundVariant:
              job.background_variant,

            prop:
              job.prop,

            variationDirection,

            quality,

            numberOfVariations:
              1,
          }),

        cache: "no-store",

        signal:
          AbortSignal.timeout(
            295_000,
          ),
      },
    );

  const generationPayload =
    (await generationResponse.json()) as
      GenerateResponse;

  if (
    !generationResponse.ok ||
    !generationPayload.ok ||
    !generationPayload
      .variants?.length
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          generationPayload.message ||
          "The replacement artwork could not be generated.",
      },
      {
        status:
          generationResponse.status ||
          500,
      },
    );
  }

  const newVariantIds =
    generationPayload.variants.map(
      (item) => item.id,
    );

  const nextAttempt =
    Math.max(
      1,
      variant.generation_attempt ??
        1,
    ) + 1;

  const [
    parentUpdate,
    childUpdate,
  ] = await Promise.all([
    supabase
      .from(
        "artwork_variants",
      )
      .update({
        status: reason,

        human_notes:
          notes || null,

        rejection_reason:
          getReviewReason(
            reason,
          ),

        approved_by:
          null,

        approved_at:
          null,
      })
      .eq(
        "id",
        variant.id,
      ),

    supabase
      .from(
        "artwork_variants",
      )
      .update({
        parent_variant_id:
          variant.id,

        generation_attempt:
          nextAttempt,
      })
      .in(
        "id",
        newVariantIds,
      ),
  ]);

  if (
    parentUpdate.error ||
    childUpdate.error
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          parentUpdate.error
            ?.message ||
          childUpdate.error
            ?.message ||
          "The regeneration lineage could not be saved.",
      },
      {
        status: 500,
      },
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
        "artwork.regenerated",

      entity_type:
        "artwork_variant",

      entity_id:
        variant.id,

      details: {
        reason,

        notes:
          notes || null,

        source_job_id:
          variant.job_id,

        replacement_job_id:
          generationPayload.jobId ??
          null,

        replacement_variant_ids:
          newVariantIds,

        generation_attempt:
          nextAttempt,

        quality,
      },
    });

  return NextResponse.json({
    ok: true,

    sourceVariantId:
      variant.id,

    replacementJobId:
      generationPayload.jobId ??
      null,

    replacementVariantIds:
      newVariantIds,
  });
}