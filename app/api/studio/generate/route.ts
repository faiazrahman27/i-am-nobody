import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildNobodyArtworkPrompt,
  getNobodyArchetype,
  isNobodyArchetypeSlug,
  NOBODY_BRAND,
} from "@/lib/nobody";
import {
  generateNobodyArtworks,
  loadCanonicalReferenceAssets,
} from "@/lib/nobody/imagePipeline";
import {
  reviewNobodyArtwork,
} from "@/lib/nobody/visualReview";
import type {
  ArchetypeSlug,
  BackgroundVariantSlug,
  ImageQuality,
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
export const maxDuration = 300;

type GenerateRequest = Readonly<{
  archetype?: unknown;
  clothingNotes?: unknown;
  moodNotes?: unknown;
  backgroundVariant?: unknown;
  prop?: unknown;
  variationDirection?: unknown;
  quality?: unknown;
  numberOfVariations?: unknown;
}>;

type SavedVariant = Readonly<{
  id: string;
  artworkCode: string;
  status: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sha256: string;
  visualScore: number | null;
  reviewSummary: string | null;
}>;

const BACKGROUND_VARIANTS:
  readonly BackgroundVariantSlug[] = [
    "canonical-taupe",
    "warm-beige",
    "soft-umber",
    "deep-warm-brown",
  ];

function normalizeOptionalText(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isImageQuality(
  value: unknown,
): value is ImageQuality {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high"
  );
}

function isBackgroundVariant(
  value: unknown,
): value is BackgroundVariantSlug {
  return (
    typeof value === "string" &&
    BACKGROUND_VARIANTS.includes(
      value as BackgroundVariantSlug,
    )
  );
}

function getVariationCount(
  value: unknown,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(4, value),
  );
}

function makeArtworkCode(
  archetypeCode: string,
  variantIndex: number,
) {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const entropy = randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `NBD-${archetypeCode}-${date}-${entropy}-V${String(
    variantIndex,
  ).padStart(2, "0")}`;
}

async function signedUrl(
  supabase:
    ReturnType<
      typeof createSupabaseAdminClient
    >,
  path: string,
  expiresIn = 60 * 60,
) {
  const { data, error } =
    await supabase.storage
      .from("nobody-private")
      .createSignedUrl(
        path,
        expiresIn,
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    throw new Error(
      error?.message ||
        "The artwork preview could not be prepared.",
    );
  }

  return data.signedUrl;
}

export async function POST(
  request: Request,
) {
  const access =
    await getStudioAccess();

  if (!access.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "UNAUTHENTICATED",
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
        error:
          "NOT_AUTHORIZED",
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
        error:
          "REVIEWER_CANNOT_GENERATE",
        message:
          "Reviewer accounts cannot create new artworks.",
      },
      { status: 403 },
    );
  }

  let body: GenerateRequest;

  try {
    body =
      (await request.json()) as
        GenerateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INVALID_JSON",
        message:
          "The request is invalid.",
      },
      { status: 400 },
    );
  }

  if (
    !isNobodyArchetypeSlug(
      body.archetype,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INVALID_ARCHETYPE",
        message:
          "Choose an I AM NOBODY archetype.",
      },
      { status: 400 },
    );
  }

  const archetype =
    body.archetype as
      ArchetypeSlug;

  const archetypeDefinition =
    getNobodyArchetype(
      archetype,
    );

  const quality:
    ImageQuality =
      isImageQuality(body.quality)
        ? body.quality
        : "low";

  const numberOfVariations =
    getVariationCount(
      body.numberOfVariations,
    );

  const backgroundVariant:
    BackgroundVariantSlug =
      isBackgroundVariant(
        body.backgroundVariant,
      )
        ? body.backgroundVariant
        : "canonical-taupe";

  const clothingNotes =
    normalizeOptionalText(
      body.clothingNotes,
    );

  const moodNotes =
    normalizeOptionalText(
      body.moodNotes,
    );

  const prop =
    normalizeOptionalText(
      body.prop,
    ) || null;

  const variationDirection =
    normalizeOptionalText(
      body.variationDirection,
    );

  const promptResult =
    buildNobodyArtworkPrompt({
      archetype,
      clothingNotes,
      moodNotes,
      prop,
      variationDirection,
      backgroundVariant,
      quality,
      outputFormat: "png",
    });

  if (!promptResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "PROMPT_VALIDATION_FAILED",
        issues:
          promptResult.issues,
      },
      { status: 400 },
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const [
    {
      data: reference,
      error: referenceError,
    },
    { data: policy },
  ] = await Promise.all([
    supabase
      .from("brand_references")
      .select(
        "id,version,sha256,width,height,public_path",
      )
      .eq(
        "reference_code",
        NOBODY_BRAND
          .canonicalReference.id,
      )
      .eq("is_active", true)
      .single(),

    supabase
      .from(
        "image_generation_policy",
      )
      .select(
        "automated_review_enabled,automated_review_threshold",
      )
      .eq("singleton", true)
      .maybeSingle(),
  ]);

  if (
    referenceError ||
    !reference
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CANONICAL_REFERENCE_MISSING",
        message:
          "The original book-cover reference is unavailable. Please complete the studio setup.",
      },
      { status: 503 },
    );
  }

  if (
    reference.sha256 !==
      NOBODY_BRAND
        .canonicalReference
        .sha256 ||
    reference.width !==
      NOBODY_BRAND
        .canonicalReference
        .width ||
    reference.height !==
      NOBODY_BRAND
        .canonicalReference
        .height
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CANONICAL_REFERENCE_MISMATCH",
        message:
          "The original book cover could not be verified. Restore the approved cover before creating artwork.",
      },
      { status: 503 },
    );
  }

  const automatedReviewEnabled =
    policy
      ?.automated_review_enabled !==
    false;

  const automatedReviewThreshold =
    typeof policy?.automated_review_threshold === "number"
      ? policy.automated_review_threshold
      : 75;

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("generation_jobs")
    .insert({
      archetype_slug:
        archetype,

      reference_id:
        reference.id,

      description:
        archetypeDefinition
          .description.en,

      clothing_notes:
        clothingNotes || null,

      mood_notes:
        moodNotes || null,

      background_variant:
        backgroundVariant,

      prop,

      variation_direction:
        variationDirection ||
        null,

      output_format: "png",

      output_width:
        NOBODY_BRAND
          .generationCanvas
          .width,

      output_height:
        NOBODY_BRAND
          .generationCanvas
          .height,

      quality,

      number_of_variations:
        numberOfVariations,

      status: "generating",

      brand_version:
        promptResult.brandVersion,

      prompt_version:
        promptResult.promptVersion,

      compiled_prompt:
        promptResult.prompt,

      negative_prompt:
        promptResult
          .negativePrompt,

      generation_mode:
        "clean_artwork",

      output_kind:
        "clean_master",

      reference_sha256:
        NOBODY_BRAND
          .canonicalReference
          .sha256,

      reference_version:
        reference.version,

      max_retries: 1,

      requested_by:
        access.admin.userId,

      started_at:
        new Date().toISOString(),

      metadata: {
        canonical_output:
          NOBODY_BRAND
            .generationCanvas
            .size,

        model_canvas:
          NOBODY_BRAND
            .modelCanvas.size,

        reference_policy:
          "server-attached-canonical-cover-and-mask-detail",

        typography_policy:
          "separate-template-layer",

        storage_bucket:
          "nobody-private",

        crop_policy:
          "no-destructive-crop",

        automated_review_enabled:
          automatedReviewEnabled,
      },
    })
    .select("id")
    .single();

  if (
    jobError ||
    !job
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "JOB_CREATION_FAILED",
        message:
          jobError?.message ||
          "The artwork could not be started.",
      },
      { status: 500 },
    );
  }

  try {
    const generation =
      await generateNobodyArtworks({
        prompt:
          promptResult.prompt,

        negativePrompt:
          promptResult
            .negativePrompt,

        quality,

        variations:
          numberOfVariations,
      });

    const referenceAssets =
      automatedReviewEnabled
        ? await loadCanonicalReferenceAssets()
        : null;

    const createdVariants =
      await Promise.all(
        generation.results.map(
          async (
            result,
            zeroBasedIndex,
          ): Promise<SavedVariant> => {
            const variantIndex =
              zeroBasedIndex + 1;

            const artworkCode =
              makeArtworkCode(
                promptResult
                  .archetype.code,
                variantIndex,
              );

            const rawPath =
              `jobs/${job.id}/${artworkCode}/raw-model.png`;

            const artworkPath =
              `artworks/${artworkCode}/clean-906x1280.png`;

            const thumbnailPath =
              `artworks/${artworkCode}/thumbnail-453x640.webp`;

            const uploadResults =
              await Promise.all([
                supabase.storage
                  .from(
                    "nobody-private",
                  )
                  .upload(
                    rawPath,
                    result.rawModelImage,
                    {
                      contentType:
                        "image/png",
                      upsert: false,
                    },
                  ),

                supabase.storage
                  .from(
                    "nobody-private",
                  )
                  .upload(
                    artworkPath,
                    result
                      .cleanArtworkImage,
                    {
                      contentType:
                        "image/png",
                      upsert: false,
                    },
                  ),

                supabase.storage
                  .from(
                    "nobody-private",
                  )
                  .upload(
                    thumbnailPath,
                    result.thumbnailImage,
                    {
                      contentType:
                        "image/webp",
                      upsert: false,
                    },
                  ),
              ]);

            const uploadError =
              uploadResults.find(
                (item) =>
                  item.error,
              )?.error;

            if (uploadError) {
              throw new Error(
                uploadError.message,
              );
            }

            const initialStatus =
              automatedReviewEnabled
                ? "reviewing"
                : "ready_for_review";

            const initialReviewStatus =
              automatedReviewEnabled
                ? "running"
                : "skipped";

            const {
              data: variant,
              error: variantError,
            } = await supabase
              .from(
                "artwork_variants",
              )
              .insert({
                artwork_code:
                  artworkCode,

                job_id: job.id,

                variant_index:
                  variantIndex,

                storage_bucket:
                  "nobody-private",

                storage_path:
                  artworkPath,

                thumbnail_storage_path:
                  thumbnailPath,

                raw_storage_path:
                  rawPath,

                mime_type:
                  "image/png",

                width:
                  NOBODY_BRAND
                    .generationCanvas
                    .width,

                height:
                  NOBODY_BRAND
                    .generationCanvas
                    .height,

                sha256:
                  result.sha256,

                image_model:
                  generation.model,

                image_model_snapshot:
                  generation.model,

                provider_request_id:
                  generation.requestId,

                reference_sha256:
                  generation
                    .referenceSha256,

                reference_version:
                  reference.version,

                technical_validation:
                  result
                    .technicalValidation,

                prompt:
                  promptResult.prompt,

                negative_prompt:
                  promptResult
                    .negativePrompt,

                status:
                  initialStatus,

                automated_review_status:
                  initialReviewStatus,

                metadata: {
                  output_kind:
                    "clean_master",

                  model_canvas:
                    generation
                      .modelSize,

                  canonical_canvas:
                    NOBODY_BRAND
                      .generationCanvas
                      .size,

                  typography_present_by_design:
                    false,

                  template_applied:
                    false,

                  crop_policy:
                    "no-destructive-crop",
                },
              })
              .select(
                "id,artwork_code,status",
              )
              .single();

            if (
              variantError ||
              !variant
            ) {
              throw new Error(
                variantError
                  ?.message ||
                  "Could not save an artwork variant.",
              );
            }

            let finalStatus =
              initialStatus;

            let visualScore:
              number | null = null;

            let reviewSummary:
              string | null = null;

            if (
              automatedReviewEnabled &&
              referenceAssets
            ) {
              try {
                const automatedReview =
                  await reviewNobodyArtwork(
                    {
                      canonicalCover:
                        referenceAssets
                          .originalCover,

                      artwork:
                        result
                          .cleanArtworkImage,

                      archetype:
                        archetypeDefinition,

                      threshold:
                        automatedReviewThreshold,
                    },
                  );

                visualScore =
                  automatedReview
                    .result.score;

                reviewSummary =
                  automatedReview
                    .result.summary;

                finalStatus =
                  automatedReview
                    .result
                    .approvedForHumanReview
                    ? "ready_for_review"
                    : "auto_rejected";

                const {
                  error:
                    reviewInsertError,
                } = await supabase
                  .from(
                    "quality_reviews",
                  )
                  .insert({
                    artwork_variant_id:
                      variant.id,

                    reviewer_model:
                      automatedReview
                        .model,

                    reviewer_model_snapshot:
                      automatedReview
                        .model,

                    review_version:
                      automatedReview
                        .reviewVersion,

                    score:
                      automatedReview
                        .result.score,

                    approved_for_review:
                      automatedReview
                        .result
                        .approvedForHumanReview,

                    hard_blockers:
                      automatedReview
                        .result
                        .hardBlockers,

                    category_scores:
                      automatedReview
                        .result
                        .categoryScores,

                    checklist:
                      automatedReview
                        .result
                        .checklist,

                    issues:
                      automatedReview
                        .result
                        .issues,

                    recommendation:
                      automatedReview
                        .result
                        .recommendation,

                    summary:
                      automatedReview
                        .result
                        .summary,

                    provider_request_id:
                      automatedReview
                        .requestId,

                    provider_response_id:
                      automatedReview
                        .responseId,

                    usage:
                      automatedReview
                        .usage ?? {},

                    raw_response:
                      automatedReview
                        .rawResponse,
                  });

                if (
                  reviewInsertError
                ) {
                  throw new Error(
                    reviewInsertError
                      .message,
                  );
                }

                const {
                  error:
                    reviewUpdateError,
                } = await supabase
                  .from(
                    "artwork_variants",
                  )
                  .update({
                    status:
                      finalStatus,

                    visual_score:
                      automatedReview
                        .result.score,

                    automated_review_status:
                      automatedReview
                        .result
                        .approvedForHumanReview
                        ? "passed"
                        : "failed",

                    automated_review_model:
                      automatedReview
                        .model,

                    automated_reviewed_at:
                      new Date()
                        .toISOString(),

                    rejection_reason:
                      automatedReview
                        .result
                        .approvedForHumanReview
                        ? null
                        : automatedReview
                            .result
                            .summary,
                  })
                  .eq(
                    "id",
                    variant.id,
                  );

                if (
                  reviewUpdateError
                ) {
                  throw new Error(
                    reviewUpdateError
                      .message,
                  );
                }
              } catch (
                reviewError
              ) {
                finalStatus =
                  "auto_review_failed";

                console.error(
                  "[I AM NOBODY] Visual review failed.",
                  reviewError,
                );

                reviewSummary =
                  "Visual review could not be completed. The artwork is still available for manual review.";

                await supabase
                  .from(
                    "artwork_variants",
                  )
                  .update({
                    status:
                      finalStatus,

                    automated_review_status:
                      "error",

                    automated_reviewed_at:
                      new Date()
                        .toISOString(),

                    rejection_reason:
                      reviewSummary,
                  })
                  .eq(
                    "id",
                    variant.id,
                  );
              }
            }

            const [
              imageUrl,
              thumbnailUrl,
            ] = await Promise.all([
              signedUrl(
                supabase,
                artworkPath,
              ),

              signedUrl(
                supabase,
                thumbnailPath,
              ),
            ]);

            return {
              id: variant.id,
              artworkCode,
              status:
                finalStatus,
              imageUrl,
              thumbnailUrl,
              width:
                NOBODY_BRAND
                  .generationCanvas
                  .width,
              height:
                NOBODY_BRAND
                  .generationCanvas
                  .height,
              sha256:
                result.sha256,
              visualScore,
              reviewSummary,
            };
          },
        ),
      );

    const hasReviewErrors =
      createdVariants.some(
        (variant) =>
          variant.status ===
          "auto_review_failed",
      );

    await Promise.all([
      supabase
        .from("generation_jobs")
        .update({
          status:
            hasReviewErrors
              ? "partially_failed"
              : "completed",

          image_model:
            generation.model,

          image_model_snapshot:
            generation.model,

          provider_request_id:
            generation.requestId,

          completed_at:
            new Date().toISOString(),

          metadata: {
            canonical_output:
              NOBODY_BRAND
                .generationCanvas
                .size,

            model_canvas:
              generation.modelSize,

            reference_policy:
              "server-attached-canonical-cover-and-mask-detail",

            reference_sha256:
              generation
                .referenceSha256,

            typography_policy:
              "separate-template-layer",

            storage_bucket:
              "nobody-private",

            crop_policy:
              "no-destructive-crop",

            automated_review_enabled:
              automatedReviewEnabled,

            usage:
              generation.usage,
          },
        })
        .eq("id", job.id),

      supabase
        .from(
          "studio_audit_log",
        )
        .insert({
          actor_user_id:
            access.admin.userId,

          action:
            "generation.completed",

          entity_type:
            "generation_job",

          entity_id: job.id,

          details: {
            archetype,

            variations:
              createdVariants
                .length,

            model:
              generation.model,

            quality,

            reference_sha256:
              generation
                .referenceSha256,

            automated_review_enabled:
              automatedReviewEnabled,
          },
        }),
    ]);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      model: generation.model,
      quality,

      canonicalSize:
        NOBODY_BRAND
          .generationCanvas.size,

      referenceId:
        NOBODY_BRAND
          .canonicalReference.id,

      referenceSha256:
        generation.referenceSha256,

      variants:
        createdVariants,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown generation failure.";

    await Promise.all([
      supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code:
            "GENERATION_FAILED",
          error_message:
            message,
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", job.id),

      supabase
        .from(
          "studio_audit_log",
        )
        .insert({
          actor_user_id:
            access.admin.userId,
          action:
            "generation.failed",
          entity_type:
            "generation_job",
          entity_id: job.id,
          details: {
            archetype,
            message,
          },
        }),
    ]);

    return NextResponse.json(
      {
        ok: false,
        error:
          "GENERATION_FAILED",
        message,
      },
      { status: 500 },
    );
  }
}
