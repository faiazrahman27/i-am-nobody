import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildNobodyArtworkPrompt,
  getNobodyArchetype,
  isNobodyArchetypeSlug,
  NOBODY_BRAND,
} from "@/lib/nobody";
import { generateNobodyCovers } from "@/lib/nobody/imagePipeline";
import type {
  ArchetypeSlug,
  ImageQuality,
} from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateRequest = Readonly<{
  archetype?: unknown;
  clothingNotes?: unknown;
  prop?: unknown;
  variationDirection?: unknown;
  quality?: unknown;
  numberOfVariations?: unknown;
}>;

function normalizeOptionalText(value: unknown) {
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

function getVariationCount(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    return 1;
  }

  return Math.max(1, Math.min(4, value));
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

export async function POST(request: Request) {
  const access = await getStudioAccess();

  if (!access.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHENTICATED",
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
        error: "NOT_AUTHORIZED",
      },
      {
        status: 403,
      },
    );
  }

  if (access.admin.role === "reviewer") {
    return NextResponse.json(
      {
        ok: false,
        error: "REVIEWER_CANNOT_GENERATE",
        message:
          "Reviewer accounts cannot create generation jobs.",
      },
      {
        status: 403,
      },
    );
  }

  let body: GenerateRequest;

  try {
    body =
      (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_JSON",
      },
      {
        status: 400,
      },
    );
  }

  if (!isNobodyArchetypeSlug(body.archetype)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_ARCHETYPE",
        message:
          "Choose a controlled I AM NOBODY archetype.",
      },
      {
        status: 400,
      },
    );
  }

  const archetype =
    body.archetype as ArchetypeSlug;

  const quality: ImageQuality =
    isImageQuality(body.quality)
      ? body.quality
      : "low";

  const numberOfVariations =
    getVariationCount(body.numberOfVariations);

  const clothingNotes =
    normalizeOptionalText(body.clothingNotes);

  const prop =
    normalizeOptionalText(body.prop) || null;

  const variationDirection =
    normalizeOptionalText(
      body.variationDirection,
    );

  const promptResult =
    buildNobodyArtworkPrompt({
      archetype,
      clothingNotes,
      prop,
      variationDirection,
      backgroundVariant: "canonical-taupe",
      quality,
      outputFormat: "png",
    });

  if (!promptResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "PROMPT_VALIDATION_FAILED",
        issues: promptResult.issues,
      },
      {
        status: 400,
      },
    );
  }

  const finalPrompt = [
    promptResult.prompt,
    "",
    "STRICT EDIT INSTRUCTION:",
    "Change only the anonymous character inside the supplied editable mask.",
    "The background, frame, spine, border, bottom iridescent line, composition, body distance, posture, and all non-character pixels must remain the same as the canonical cover.",
    "Inside the editable character region, remove any existing front-cover lettering and reconstruct clean clothing beneath it.",
    "Do not generate replacement lettering.",
    "The production pipeline restores the exact original controlled title, subtitle and author text after generation.",
    "Do not move, resize, rotate, zoom, crop, or reframe the character.",
    "The new character must occupy the same visual silhouette, body distance and central alignment as the original.",
    "",
    "STRICT EXCLUSIONS:",
    promptResult.negativePrompt,
  ].join("\n");

  const supabase =
    createSupabaseAdminClient();

  const {
    data: reference,
    error: referenceError,
  } = await supabase
    .from("brand_references")
    .select("id")
    .eq(
      "reference_code",
      NOBODY_BRAND.canonicalReference.id,
    )
    .eq("is_active", true)
    .single();

  if (referenceError || !reference) {
    return NextResponse.json(
      {
        ok: false,
        error: "CANONICAL_REFERENCE_MISSING",
        message:
          "Run the Image Studio Supabase migrations before generating artwork.",
      },
      {
        status: 503,
      },
    );
  }

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("generation_jobs")
    .insert({
      archetype_slug: archetype,
      reference_id: reference.id,
      description:
        getNobodyArchetype(archetype)
          .description.en,
      clothing_notes: clothingNotes || null,
      mood_notes: null,
      background_variant:
        "canonical-taupe",
      prop,
      variation_direction:
        variationDirection || null,
      output_format: "png",
      output_width:
        NOBODY_BRAND.generationCanvas.width,
      output_height:
        NOBODY_BRAND.generationCanvas.height,
      quality,
      number_of_variations:
        numberOfVariations,
      status: "generating",
      brand_version:
        promptResult.brandVersion,
      prompt_version:
        promptResult.promptVersion,
      compiled_prompt: finalPrompt,
      negative_prompt:
        promptResult.negativePrompt,
      max_retries: 1,
      requested_by:
        access.admin.userId,
      started_at: new Date().toISOString(),
      metadata: {
        canonical_output:
          NOBODY_BRAND.generationCanvas.size,
        model_canvas:
          NOBODY_BRAND.modelCanvas.size,
        text_policy:
          "original-controlled-text-restored-after-generation",
        edit_scope: "character-only",
        crop_policy: "no-destructive-crop",
      },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      {
        ok: false,
        error: "JOB_CREATION_FAILED",
        message:
          jobError?.message ||
          "Could not create the generation job.",
      },
      {
        status: 500,
      },
    );
  }

  try {
    const generation =
      await generateNobodyCovers({
        prompt: finalPrompt,
        quality,
        variations:
          numberOfVariations,
      });

    const createdVariants: Array<{
      id: string;
      artworkCode: string;
      status: string;
      imageUrl: string;
      thumbnailUrl: string;
      width: number;
      height: number;
      sha256: string;
    }> = [];

    for (
      const [
        zeroBasedIndex,
        result,
      ] of generation.results.entries()
    ) {
      const variantIndex =
        zeroBasedIndex + 1;

      const artworkCode =
        makeArtworkCode(
          promptResult.archetype.code,
          variantIndex,
        );

      const rootPath =
        `jobs/${job.id}/${artworkCode}`;

      const rawPath =
        `${rootPath}/raw-model.png`;

      const finalPath =
        `${rootPath}/cover-906x1280.png`;

      const thumbnailPath =
        `${rootPath}/thumbnail-453x640.webp`;

      const uploadResults =
        await Promise.all([
          supabase.storage
            .from("nobody-private")
            .upload(
              rawPath,
              result.rawModelImage,
              {
                contentType: "image/png",
                upsert: false,
              },
            ),

          supabase.storage
            .from("nobody-private")
            .upload(
              finalPath,
              result.finalCoverImage,
              {
                contentType: "image/png",
                upsert: false,
              },
            ),

          supabase.storage
            .from("nobody-private")
            .upload(
              thumbnailPath,
              result.thumbnailImage,
              {
                contentType: "image/webp",
                upsert: false,
              },
            ),
        ]);

      const uploadError =
        uploadResults.find(
          (item) => item.error,
        )?.error;

      if (uploadError) {
        throw new Error(
          uploadError.message,
        );
      }

      const {
        data: variant,
        error: variantError,
      } = await supabase
        .from("artwork_variants")
        .insert({
          artwork_code: artworkCode,
          job_id: job.id,
          variant_index: variantIndex,
          storage_bucket:
            "nobody-private",
          storage_path: finalPath,
          thumbnail_storage_path:
            thumbnailPath,
          mime_type: "image/png",
          width:
            NOBODY_BRAND
              .generationCanvas.width,
          height:
            NOBODY_BRAND
              .generationCanvas.height,
          sha256: result.sha256,
          image_model: generation.model,
          image_model_snapshot:
            generation.model,
          prompt: finalPrompt,
          negative_prompt:
            promptResult.negativePrompt,
          status: "ready_for_review",
          metadata: {
            raw_model_storage_path:
              rawPath,
            model_canvas:
              generation.modelSize,
            canonical_canvas:
              NOBODY_BRAND
                .generationCanvas.size,
            original_text_restored:
              true,
            original_non_character_pixels_restored:
              true,
            crop_policy:
              "no-destructive-crop",
          },
        })
        .select(
          "id,artwork_code,status",
        )
        .single();

      if (variantError || !variant) {
        throw new Error(
          variantError?.message ||
            "Could not save an artwork variant.",
        );
      }

      const [
        signedImage,
        signedThumbnail,
      ] = await Promise.all([
        supabase.storage
          .from("nobody-private")
          .createSignedUrl(
            finalPath,
            60 * 60,
          ),

        supabase.storage
          .from("nobody-private")
          .createSignedUrl(
            thumbnailPath,
            60 * 60,
          ),
      ]);

      if (
        signedImage.error ||
        signedThumbnail.error
      ) {
        throw new Error(
          signedImage.error?.message ||
            signedThumbnail.error
              ?.message ||
            "Could not create preview URLs.",
        );
      }

      createdVariants.push({
        id: variant.id,
        artworkCode:
          variant.artwork_code,
        status: variant.status,
        imageUrl:
          signedImage.data.signedUrl,
        thumbnailUrl:
          signedThumbnail.data
            .signedUrl,
        width:
          NOBODY_BRAND
            .generationCanvas.width,
        height:
          NOBODY_BRAND
            .generationCanvas.height,
        sha256: result.sha256,
      });
    }

    await Promise.all([
      supabase
        .from("generation_jobs")
        .update({
          status: "generated",
          image_model:
            generation.model,
          image_model_snapshot:
            generation.model,
          completed_at:
            new Date().toISOString(),
          metadata: {
            canonical_output:
              NOBODY_BRAND
                .generationCanvas.size,
            model_canvas:
              generation.modelSize,
            text_policy:
              "original-controlled-text-restored-after-generation",
            edit_scope:
              "character-only",
            crop_policy:
              "no-destructive-crop",
            usage: generation.usage,
          },
        })
        .eq("id", job.id),

      supabase
        .from("studio_audit_log")
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
              createdVariants.length,
            model:
              generation.model,
            quality,
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
      variants: createdVariants,
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
          error_message: message,
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", job.id),

      supabase
        .from("studio_audit_log")
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
        error: "GENERATION_FAILED",
        message,
      },
      {
        status: 500,
      },
    );
  }
}