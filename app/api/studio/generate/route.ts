import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildNobodyArtworkPrompt,
  isNobodyArchetypeSlug,
  NOBODY_BRAND,
} from "@/lib/nobody";
import {
  generateNobodyArtworks,
  loadCanonicalReferenceAssets,
} from "@/lib/nobody/imagePipeline";
import { reviewNobodyArtwork } from "@/lib/nobody/visualReview";
import type {
  ArchetypeSlug,
  BackgroundVariantSlug,
  ImageQuality,
  DailyCreativeBrief,
  NobodyThreshold,
} from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";
import type { StudioAdmin } from "@/lib/supabase/studioAccess";
import {
  isAuthorizedCronRequest,
  isAuthorizedInternalGenerationRequest,
} from "@/lib/cronAuth";
import { assertNobodyRuntimeReady } from "@/lib/nobody/runtimeConfig";

export const dynamic = "force-dynamic";
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
  automationItemId?: unknown;
  generationSource?: unknown;
  creativeBrief?: unknown;
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

type ExistingVariantRow = Readonly<{
  id: string;
  artwork_code: string;
  status: string;
  width: number;
  height: number;
  sha256: string;
  visual_score: number | null;
  rejection_reason: string | null;
}>;

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isImageQuality(value: unknown): value is ImageQuality {
  return value === "low" || value === "medium" || value === "high";
}



const NOBODY_THRESHOLDS: readonly NobodyThreshold[] = [
  "Nobody",
  "Somebody",
  "Anybody",
  "Infinite",
];

const HUMAN_REVIEW_READY_STATUSES = new Set([
  "ready_for_review",
  "approved_artwork",
  "approved_for_template",
  "published",
]);

const ACTIVE_VARIANT_STATUSES = new Set(["candidate", "reviewing"]);
const ACTIVE_GENERATION_STALE_AFTER_MS = 8 * 60 * 1000;

function normalizeBriefField(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeDailyCreativeBrief(
  value: unknown,
): DailyCreativeBrief | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  const threshold = NOBODY_THRESHOLDS.includes(row.threshold as NobodyThreshold)
    ? (row.threshold as NobodyThreshold)
    : null;

  const brief: DailyCreativeBrief = {
    roleTitle: normalizeBriefField(row.roleTitle, 80),
    roleFamily: normalizeBriefField(row.roleFamily, 60),
    lifeContext: normalizeBriefField(row.lifeContext, 220),
    threshold: threshold ?? "Nobody",
    bookTheme: normalizeBriefField(row.bookTheme, 180),
    conceptQuestion: normalizeBriefField(row.conceptQuestion, 220),
    visualStory: normalizeBriefField(row.visualStory, 320),
    clothingDirection: normalizeBriefField(row.clothingDirection, 420),
    moodDirection: normalizeBriefField(row.moodDirection, 240),
    bodyDirection: normalizeBriefField(row.bodyDirection, 220),
    objectDirection: normalizeBriefField(row.objectDirection, 140) || "none",
    creativeDirection: normalizeBriefField(row.creativeDirection, 420),
  };

  if (
    !threshold ||
    brief.roleTitle.length < 3 ||
    brief.roleFamily.length < 3 ||
    brief.lifeContext.length < 20 ||
    brief.bookTheme.length < 12 ||
    brief.conceptQuestion.length < 12 ||
    brief.visualStory.length < 30 ||
    brief.clothingDirection.length < 30 ||
    brief.moodDirection.length < 12 ||
    brief.bodyDirection.length < 12 ||
    brief.creativeDirection.length < 30
  ) {
    return undefined;
  }

  return brief;
}

function isGenerationLimitError(message: string) {
  return /limit|already running|safety policy|please wait|cost guard|at most|generation is currently disabled/i.test(
    message,
  );
}

function getRetryAfter(message: string) {
  const match = message.match(/wait\s+(\d+)\s+second/i);
  return match ? Math.max(1, Number(match[1])) : 60;
}

function makeArtworkCode(archetypeCode: string, variantIndex: number) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  const entropy = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();

  return `NBD-${archetypeCode}-${date}-${entropy}-V${String(
    variantIndex,
  ).padStart(2, "0")}`;
}

async function signedUrl(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  path: string,
  expiresIn = 60 * 60,
) {
  const { data, error } = await supabase.storage
    .from("nobody-private")
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message || "The artwork preview could not be prepared.",
    );
  }

  return data.signedUrl;
}

async function removePrivateObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  paths: readonly string[],
) {
  const uniquePaths = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path))),
  );

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from("nobody-private")
    .remove(uniquePaths);

  if (error) {
    console.error(
      "[I AM NOBODY] Could not clean up incomplete storage objects.",
      error,
    );
  }
}

export async function POST(request: Request) {
  let body: GenerateRequest;

  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "The request is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    assertNobodyRuntimeReady();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "RUNTIME_CONFIGURATION_INVALID",
        message:
          error instanceof Error
            ? error.message
            : "The Studio runtime configuration is invalid.",
      },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const cronAuthorized = isAuthorizedCronRequest(request);
  const internalAuthorized = isAuthorizedInternalGenerationRequest(request);

  let actor: StudioAdmin;
  let generationSource: "daily_automation" | "regeneration";
  let automationItemId: string | null = null;
  let creativeBrief: DailyCreativeBrief | undefined;

  if (cronAuthorized) {
    automationItemId =
      typeof body.automationItemId === "string" ? body.automationItemId : null;

    if (!automationItemId) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATION_ITEM_REQUIRED",
          message: "The scheduled artwork item is missing.",
        },
        { status: 400 },
      );
    }

    const [itemResult, configResult, existingJobResult] = await Promise.all([
      supabase
        .from("daily_artwork_items")
        .select(
          "id,status,base_archetype_slug,role_title,role_family,life_context,threshold_name,book_theme,concept_question,visual_story,clothing_direction,mood_direction,body_direction,object_direction,quality,background_variant,prop,creative_direction",
        )
        .eq("id", automationItemId)
        .maybeSingle(),

      supabase
        .from("daily_artwork_automation")
        .select("actor_user_id")
        .eq("singleton", true)
        .maybeSingle(),

      supabase
        .from("generation_jobs")
        .select("id,status,created_at")
        .eq("automation_item_id", automationItemId)
        .maybeSingle(),
    ]);

    if (existingJobResult.data) {
      const { data: existingVariants, error: existingVariantsError } =
        await supabase
          .from("artwork_variants")
          .select(
            "id,artwork_code,status,width,height,sha256,visual_score,rejection_reason",
          )
          .eq("job_id", existingJobResult.data.id)
          .order("variant_index");

      if (existingVariantsError) {
        return NextResponse.json(
          {
            ok: false,
            error: "AUTOMATION_RETRY_LOOKUP_FAILED",
            message: existingVariantsError.message,
          },
          { status: 500 },
        );
      }

      const previousVariants = (existingVariants ?? []) as ExistingVariantRow[];
      const readyVariants = previousVariants.filter((variant) =>
        HUMAN_REVIEW_READY_STATUSES.has(variant.status),
      );

      if (readyVariants.length > 0) {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          jobId: existingJobResult.data.id,
          variants: readyVariants.map((variant) => ({
            ...variant,
            reviewSummary: variant.rejection_reason ?? null,
          })),
        });
      }

      const createdAt = Date.parse(existingJobResult.data.created_at);
      const isFreshActiveAttempt =
        Number.isFinite(createdAt) &&
        Date.now() - createdAt < ACTIVE_GENERATION_STALE_AFTER_MS &&
        (["queued", "generating"].includes(existingJobResult.data.status) ||
          previousVariants.some((variant) =>
            ACTIVE_VARIANT_STATUSES.has(variant.status),
          ));

      if (isFreshActiveAttempt) {
        return NextResponse.json(
          {
            ok: false,
            error: "GENERATION_ALREADY_RUNNING",
            message:
              "This artwork is already being generated or visually checked by another worker.",
          },
          { status: 409 },
        );
      }

      const activeVariantIds = previousVariants
        .filter((variant) => ACTIVE_VARIANT_STATUSES.has(variant.status))
        .map((variant) => variant.id);

      if (activeVariantIds.length > 0) {
        const { error: staleVariantError } = await supabase
          .from("artwork_variants")
          .update({
            status: "auto_review_failed",
            automated_review_status: "error",
            automated_reviewed_at: new Date().toISOString(),
            rejection_reason:
              "The previous generation or visual review did not finish within the production lease and was superseded by a fresh attempt.",
          })
          .in("id", activeVariantIds);

        if (staleVariantError) {
          return NextResponse.json(
            {
              ok: false,
              error: "AUTOMATION_STALE_VARIANT_RELEASE_FAILED",
              message: staleVariantError.message,
            },
            { status: 500 },
          );
        }
      }

      /*
       * A rejected, failed, or stale attempt must not become the permanent
       * idempotent result for a daily queue item. Keep the historical job and
       * variants, but detach the item so its next lease creates a fresh image.
       */
      const { error: releaseError } = await supabase
        .from("generation_jobs")
        .update({
          automation_item_id: null,
          status: "failed",
          error_code: "AUTOMATION_ATTEMPT_SUPERSEDED",
          error_message:
            "A fresh scheduled attempt replaced a rejected, failed, or stale generation.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", existingJobResult.data.id)
        .eq("automation_item_id", automationItemId);

      if (releaseError) {
        return NextResponse.json(
          {
            ok: false,
            error: "AUTOMATION_RETRY_BLOCKED",
            message:
              "The previous scheduled attempt could not be released for a fresh retry.",
          },
          { status: 409 },
        );
      }
    }

    const item = itemResult.data;
    const actorUserId = configResult.data?.actor_user_id;

    if (itemResult.error || !item || item.status !== "processing") {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATION_ITEM_NOT_READY",
          message: "The scheduled artwork item is not ready for processing.",
        },
        { status: 409 },
      );
    }

    if (!actorUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATION_ACTOR_MISSING",
          message: "The daily studio automation has no active owner or editor.",
        },
        { status: 503 },
      );
    }

    const { data: actorRow } = await supabase
      .from("studio_admins")
      .select("user_id,email,display_name,role,is_active")
      .eq("user_id", actorUserId)
      .eq("is_active", true)
      .in("role", ["owner", "editor"])
      .maybeSingle();

    if (
      !actorRow ||
      (actorRow.role !== "owner" && actorRow.role !== "editor")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATION_ACTOR_INVALID",
          message: "The daily studio automation owner is unavailable.",
        },
        { status: 503 },
      );
    }

    actor = {
      userId: actorRow.user_id,
      email: actorRow.email,
      displayName: actorRow.display_name,
      role: actorRow.role,
    };

    creativeBrief = normalizeDailyCreativeBrief({
      roleTitle: item.role_title,
      roleFamily: item.role_family,
      lifeContext: item.life_context,
      threshold: item.threshold_name,
      bookTheme: item.book_theme,
      conceptQuestion: item.concept_question,
      visualStory: item.visual_story,
      clothingDirection: item.clothing_direction,
      moodDirection: item.mood_direction,
      bodyDirection: item.body_direction,
      objectDirection: item.object_direction,
      creativeDirection: item.creative_direction,
    });

    if (!creativeBrief) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATION_BRIEF_INVALID",
          message: "The scheduled artwork direction is incomplete.",
        },
        { status: 409 },
      );
    }

    body = {
      archetype: item.base_archetype_slug || "nobody-classic",
      clothingNotes: creativeBrief.clothingDirection,
      moodNotes: creativeBrief.moodDirection,
      backgroundVariant: NOBODY_BRAND.defaultBackgroundVariant,
      prop: item.prop,
      variationDirection: creativeBrief.creativeDirection,
      quality: item.quality,
      numberOfVariations: 1,
      automationItemId,
      generationSource: "daily_automation",
      creativeBrief,
    };

    generationSource = "daily_automation";
  } else {
    if (!internalAuthorized || body.generationSource !== "regeneration") {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTOMATED_WORKFLOW_ONLY",
          message:
            "New artwork generation is automated. Request corrected versions from an artwork review page.",
        },
        { status: 403 },
      );
    }

    const access = await getStudioAccess();

    if (!access.authenticated) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNAUTHENTICATED",
          message: "Please sign in again.",
        },
        { status: 401 },
      );
    }

    if (!access.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error: "NOT_AUTHORIZED",
          message: "This account cannot access the studio.",
        },
        { status: 403 },
      );
    }

    if (access.admin.role === "reviewer") {
      return NextResponse.json(
        {
          ok: false,
          error: "REVIEWER_CANNOT_GENERATE",
          message: "Reviewer accounts cannot create new artworks.",
        },
        { status: 403 },
      );
    }

    actor = access.admin;
    generationSource = "regeneration";

    creativeBrief = normalizeDailyCreativeBrief(body.creativeBrief);

    if (body.creativeBrief && !creativeBrief) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_CREATIVE_BRIEF",
          message: "The saved artwork direction is incomplete.",
        },
        { status: 400 },
      );
    }
  }

  if (!isNobodyArchetypeSlug(body.archetype)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_ARCHETYPE",
        message: "Choose an I AM NOBODY archetype.",
      },
      { status: 400 },
    );
  }

  const archetype = body.archetype as ArchetypeSlug;

  const quality: ImageQuality = isImageQuality(body.quality)
    ? body.quality
    : generationSource === "daily_automation"
      ? "high"
      : "medium";

  const numberOfVariations = 1;

  const backgroundVariant: BackgroundVariantSlug =
    NOBODY_BRAND.defaultBackgroundVariant;

  const clothingNotes = normalizeOptionalText(body.clothingNotes);

  const moodNotes = normalizeOptionalText(body.moodNotes);

  const prop = normalizeOptionalText(body.prop) || null;

  const variationDirection = normalizeOptionalText(body.variationDirection);

  const promptResult = buildNobodyArtworkPrompt({
    archetype,
    clothingNotes,
    moodNotes,
    prop,
    variationDirection,
    backgroundVariant,
    quality,
    outputFormat: "png",
    creativeBrief,
  });

  if (!promptResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "PROMPT_VALIDATION_FAILED",
        issues: promptResult.issues,
      },
      { status: 400 },
    );
  }

  const archetypeDefinition = promptResult.archetype;

  const [{ data: reference, error: referenceError }, { data: policy }] =
    await Promise.all([
      supabase
        .from("brand_references")
        .select("id,version,sha256,width,height,public_path")
        .eq("reference_code", NOBODY_BRAND.canonicalReference.id)
        .eq("is_active", true)
        .single(),

      supabase
        .from("image_generation_policy")
        .select("automated_review_enabled,automated_review_threshold")
        .eq("singleton", true)
        .maybeSingle(),
    ]);

  if (referenceError || !reference) {
    return NextResponse.json(
      {
        ok: false,
        error: "CANONICAL_REFERENCE_MISSING",
        message:
          "The approved book-cover reference record is unavailable.",
      },
      { status: 503 },
    );
  }

  if (
    reference.sha256 !== NOBODY_BRAND.canonicalReference.sha256 ||
    reference.width !== NOBODY_BRAND.canonicalReference.width ||
    reference.height !== NOBODY_BRAND.canonicalReference.height
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "CANONICAL_REFERENCE_MISMATCH",
        message:
          "The original book cover could not be verified. Restore the approved cover before creating artwork.",
      },
      { status: 503 },
    );
  }

  const automatedReviewEnabled = policy?.automated_review_enabled !== false;

  const automatedReviewThreshold = Math.max(
    88,
    typeof policy?.automated_review_threshold === "number"
      ? policy.automated_review_threshold
      : 88,
  );

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      archetype_slug: archetype,

      reference_id: reference.id,

      description: archetypeDefinition.description.en,

      clothing_notes: creativeBrief?.clothingDirection || clothingNotes || null,

      mood_notes: creativeBrief?.moodDirection || moodNotes || null,

      background_variant: backgroundVariant,

      prop,

      variation_direction:
        creativeBrief?.creativeDirection || variationDirection || null,

      output_format: "png",

      output_width: NOBODY_BRAND.generationCanvas.width,

      output_height: NOBODY_BRAND.generationCanvas.height,

      quality,

      number_of_variations: numberOfVariations,

      status: "generating",

      brand_version: promptResult.brandVersion,

      prompt_version: promptResult.promptVersion,

      compiled_prompt: promptResult.prompt,

      negative_prompt: promptResult.negativePrompt,

      generation_mode: "clean_artwork",

      output_kind: "clean_master",

      reference_sha256: NOBODY_BRAND.canonicalReference.sha256,

      reference_version: reference.version,

      max_retries: 1,

      source: generationSource,

      automation_item_id: automationItemId,

      requested_by: actor.userId,

      started_at: new Date().toISOString(),

      metadata: {
        canonical_output: NOBODY_BRAND.generationCanvas.size,

        model_canvas: NOBODY_BRAND.modelCanvas.size,

        reference_policy: "server-attached-canonical-cover-and-mask-detail",

        typography_policy: "separate-template-layer",

        storage_bucket: "nobody-private",

        crop_policy: "no-destructive-crop",

        automated_review_enabled: automatedReviewEnabled,

        generation_source: generationSource,

        automation_item_id: automationItemId,

        role_title: creativeBrief?.roleTitle ?? archetypeDefinition.title.en,

        role_family: creativeBrief?.roleFamily ?? "curated archetype",

        life_context: creativeBrief?.lifeContext ?? null,

        threshold_name: creativeBrief?.threshold ?? null,

        book_theme: creativeBrief?.bookTheme ?? null,

        concept_question: creativeBrief?.conceptQuestion ?? null,

        visual_story: creativeBrief?.visualStory ?? null,

        clothing_direction: creativeBrief?.clothingDirection ?? null,

        mood_direction: creativeBrief?.moodDirection ?? null,

        body_direction: creativeBrief?.bodyDirection ?? null,

        object_direction: creativeBrief?.objectDirection ?? null,

        creative_brief: creativeBrief ?? null,
      },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    const message = jobError?.message || "The artwork could not be started.";
    const rateLimited = isGenerationLimitError(message);
    const retryAfter = rateLimited ? getRetryAfter(message) : null;

    return NextResponse.json(
      {
        ok: false,
        error: rateLimited ? "GENERATION_RATE_LIMITED" : "JOB_CREATION_FAILED",
        message,
        retryAfter,
      },
      {
        status: rateLimited ? 429 : 500,
        headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
      },
    );
  }

  try {
    const generation = await generateNobodyArtworks({
      prompt: promptResult.prompt,

      negativePrompt: promptResult.negativePrompt,

      quality,

      variations: numberOfVariations,
    });

    const referenceAssets = automatedReviewEnabled
      ? await loadCanonicalReferenceAssets()
      : null;

    const createdVariants = await Promise.all(
      generation.results.map(
        async (result, zeroBasedIndex): Promise<SavedVariant> => {
          const variantIndex = zeroBasedIndex + 1;

          const artworkCode = makeArtworkCode(
            promptResult.archetype.code,
            variantIndex,
          );

          const rawPath = `jobs/${job.id}/${artworkCode}/raw-model.png`;

          const artworkPath = `artworks/${artworkCode}/clean-906x1280.png`;

          const thumbnailPath = `artworks/${artworkCode}/thumbnail-453x640.webp`;

          const uploadResults = await Promise.all([
            supabase.storage
              .from("nobody-private")
              .upload(rawPath, result.rawModelImage, {
                contentType: "image/png",
                upsert: false,
              }),

            supabase.storage
              .from("nobody-private")
              .upload(artworkPath, result.cleanArtworkImage, {
                contentType: "image/png",
                upsert: false,
              }),

            supabase.storage
              .from("nobody-private")
              .upload(thumbnailPath, result.thumbnailImage, {
                contentType: "image/webp",
                upsert: false,
              }),
          ]);

          const uploadError = uploadResults.find((item) => item.error)?.error;

          if (uploadError) {
            await removePrivateObjects(supabase, [
              rawPath,
              artworkPath,
              thumbnailPath,
            ]);

            throw new Error(uploadError.message);
          }

          const initialStatus = automatedReviewEnabled
            ? "reviewing"
            : "ready_for_review";

          const initialReviewStatus = automatedReviewEnabled
            ? "running"
            : "skipped";

          const { data: variant, error: variantError } = await supabase
            .from("artwork_variants")
            .insert({
              artwork_code: artworkCode,

              job_id: job.id,

              variant_index: variantIndex,

              storage_bucket: "nobody-private",

              storage_path: artworkPath,

              thumbnail_storage_path: thumbnailPath,

              raw_storage_path: rawPath,

              mime_type: "image/png",

              width: NOBODY_BRAND.generationCanvas.width,

              height: NOBODY_BRAND.generationCanvas.height,

              sha256: result.sha256,

              image_model: generation.model,

              image_model_snapshot: generation.model,

              provider_request_id: generation.requestId,

              reference_sha256: generation.referenceSha256,

              reference_version: reference.version,

              technical_validation: result.technicalValidation,

              prompt: promptResult.prompt,

              negative_prompt: promptResult.negativePrompt,

              status: initialStatus,

              automated_review_status: initialReviewStatus,

              metadata: {
                output_kind: "clean_master",

                model_canvas: generation.modelSize,

                canonical_canvas: NOBODY_BRAND.generationCanvas.size,

                typography_present_by_design: false,

                template_applied: false,

                crop_policy: "no-destructive-crop",

                role_title:
                  creativeBrief?.roleTitle ?? archetypeDefinition.title.en,

                role_family: creativeBrief?.roleFamily ?? "curated archetype",

                threshold_name: creativeBrief?.threshold ?? null,

                concept_question: creativeBrief?.conceptQuestion ?? null,

                creative_brief: creativeBrief ?? null,

                canonical_helmet_id: "IAMN-HELMET-CANONICAL-001",

                canonical_helmet_sha256: generation.helmetSha256,

                canonical_helmet_applied: true,

                canonical_background_id: "IAMN-BACKGROUND-CANONICAL-001",

                canonical_background_sha256: generation.backgroundSha256,

                canonical_background_applied: true,

                subject_matte_sha256: generation.subjectMatteSha256,
              },
            })
            .select("id,artwork_code,status")
            .single();

          if (variantError || !variant) {
            await removePrivateObjects(supabase, [
              rawPath,
              artworkPath,
              thumbnailPath,
            ]);

            throw new Error(
              variantError?.message || "Could not save an artwork variant.",
            );
          }

          let finalStatus = initialStatus;

          let visualScore: number | null = null;

          let reviewSummary: string | null = null;

          if (automatedReviewEnabled && referenceAssets) {
            try {
              const automatedReview = await reviewNobodyArtwork({
                canonicalCover: referenceAssets.originalCover,

                canonicalHelmet: referenceAssets.helmetOverlay,

                canonicalBackground: referenceAssets.canonicalBackground,

                artwork: result.cleanArtworkImage,

                archetype: archetypeDefinition,

                threshold: automatedReviewThreshold,
              });

              visualScore = automatedReview.result.score;

              reviewSummary = automatedReview.result.summary;

              finalStatus = automatedReview.result.approvedForHumanReview
                ? "ready_for_review"
                : "auto_rejected";

              const { error: reviewInsertError } = await supabase
                .from("quality_reviews")
                .insert({
                  artwork_variant_id: variant.id,

                  reviewer_model: automatedReview.model,

                  reviewer_model_snapshot: automatedReview.model,

                  review_version: automatedReview.reviewVersion,

                  score: automatedReview.result.score,

                  approved_for_review:
                    automatedReview.result.approvedForHumanReview,

                  hard_blockers: automatedReview.result.hardBlockers,

                  category_scores: automatedReview.result.categoryScores,

                  checklist: automatedReview.result.checklist,

                  issues: automatedReview.result.issues,

                  recommendation: automatedReview.result.recommendation,

                  summary: automatedReview.result.summary,

                  provider_request_id: automatedReview.requestId,

                  provider_response_id: automatedReview.responseId,

                  usage: automatedReview.usage ?? {},

                  raw_response: automatedReview.rawResponse,
                });

              if (reviewInsertError) {
                throw new Error(reviewInsertError.message);
              }

              const { error: reviewUpdateError } = await supabase
                .from("artwork_variants")
                .update({
                  status: finalStatus,

                  visual_score: automatedReview.result.score,

                  automated_review_status: automatedReview.result
                    .approvedForHumanReview
                    ? "passed"
                    : "failed",

                  automated_review_model: automatedReview.model,

                  automated_reviewed_at: new Date().toISOString(),

                  rejection_reason: automatedReview.result
                    .approvedForHumanReview
                    ? null
                    : automatedReview.result.summary,
                })
                .eq("id", variant.id);

              if (reviewUpdateError) {
                throw new Error(reviewUpdateError.message);
              }
            } catch (reviewError) {
              finalStatus = "auto_review_failed";

              console.error("[I AM NOBODY] Visual review failed.", reviewError);

              reviewSummary =
                "Visual review could not be completed. This result will not enter the human-review queue; a fresh generation attempt is required.";

              await supabase
                .from("artwork_variants")
                .update({
                  status: finalStatus,

                  automated_review_status: "error",

                  automated_reviewed_at: new Date().toISOString(),

                  rejection_reason: reviewSummary,
                })
                .eq("id", variant.id);
            }
          }

          const [imageUrl, thumbnailUrl] = await Promise.all([
            signedUrl(supabase, artworkPath),

            signedUrl(supabase, thumbnailPath),
          ]);

          return {
            id: variant.id,
            artworkCode,
            status: finalStatus,
            imageUrl,
            thumbnailUrl,
            width: NOBODY_BRAND.generationCanvas.width,
            height: NOBODY_BRAND.generationCanvas.height,
            sha256: result.sha256,
            visualScore,
            reviewSummary,
          };
        },
      ),
    );

    const hasReviewErrors = createdVariants.some(
      (variant) => !HUMAN_REVIEW_READY_STATUSES.has(variant.status),
    );

    await Promise.all([
      supabase
        .from("generation_jobs")
        .update({
          status: hasReviewErrors ? "partially_failed" : "completed",

          image_model: generation.model,

          image_model_snapshot: generation.model,

          provider_request_id: generation.requestId,

          completed_at: new Date().toISOString(),

          metadata: {
            canonical_output: NOBODY_BRAND.generationCanvas.size,

            model_canvas: generation.modelSize,

            reference_policy: "server-attached-canonical-cover-and-mask-detail",

            reference_sha256: generation.referenceSha256,

            canonical_helmet_sha256: generation.helmetSha256,

            canonical_helmet_applied: true,

            canonical_background_sha256: generation.backgroundSha256,

            canonical_background_applied: true,

            subject_matte_sha256: generation.subjectMatteSha256,

            typography_policy: "separate-template-layer",

            storage_bucket: "nobody-private",

            crop_policy: "no-destructive-crop",

            automated_review_enabled: automatedReviewEnabled,

            generation_source: generationSource,

            automation_item_id: automationItemId,

            role_title:
              creativeBrief?.roleTitle ?? archetypeDefinition.title.en,

            role_family: creativeBrief?.roleFamily ?? "curated archetype",

            life_context: creativeBrief?.lifeContext ?? null,

            threshold_name: creativeBrief?.threshold ?? null,

            book_theme: creativeBrief?.bookTheme ?? null,

            concept_question: creativeBrief?.conceptQuestion ?? null,

            visual_story: creativeBrief?.visualStory ?? null,

            clothing_direction: creativeBrief?.clothingDirection ?? null,

            mood_direction: creativeBrief?.moodDirection ?? null,

            body_direction: creativeBrief?.bodyDirection ?? null,

            object_direction: creativeBrief?.objectDirection ?? null,

            creative_brief: creativeBrief ?? null,

            usage: generation.usage,
          },
        })
        .eq("id", job.id),

      supabase.from("studio_audit_log").insert({
        actor_user_id: actor.userId,

        action: "generation.completed",

        entity_type: "generation_job",

        entity_id: job.id,

        details: {
          archetype,

          variations: createdVariants.length,

          model: generation.model,

          quality,

          generation_source: generationSource,

          automation_item_id: automationItemId,

          reference_sha256: generation.referenceSha256,

          canonical_helmet_sha256: generation.helmetSha256,

          canonical_helmet_applied: true,

          canonical_background_sha256: generation.backgroundSha256,

          canonical_background_applied: true,

          subject_matte_sha256: generation.subjectMatteSha256,

          automated_review_enabled: automatedReviewEnabled,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      model: generation.model,
      quality,

      canonicalSize: NOBODY_BRAND.generationCanvas.size,

      referenceId: NOBODY_BRAND.canonicalReference.id,

      referenceSha256: generation.referenceSha256,

      helmetSha256: generation.helmetSha256,

      backgroundSha256: generation.backgroundSha256,

      subjectMatteSha256: generation.subjectMatteSha256,

      roleTitle: archetypeDefinition.title.en,

      variants: createdVariants,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation failure.";

    await Promise.all([
      supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_code: "GENERATION_FAILED",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id),

      supabase.from("studio_audit_log").insert({
        actor_user_id: actor.userId,
        action: "generation.failed",
        entity_type: "generation_job",
        entity_id: job.id,
        details: {
          archetype,
          message,
          generation_source: generationSource,
          automation_item_id: automationItemId,
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: false,
        error: "GENERATION_FAILED",
        message,
      },
      { status: 500 },
    );
  }
}
