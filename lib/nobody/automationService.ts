import "server-only";

import {
  createConceptFingerprint,
  NOBODY_DAILY_PLANNER_VERSION,
  planDailyNobodyArtworks,
} from "./dailyPlanner";
import { getRomeDateParts } from "./dailyAutomation";
import type { BackgroundVariantSlug, ImageQuality } from "./types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PLANNING_LEASE_MS = 5 * 60 * 1000;

export type AutomationConfigRow = Readonly<{
  is_enabled: boolean;
  timezone: string;
  local_hour: number;
  daily_count: number;
  quality: ImageQuality;
  background_variant: BackgroundVariantSlug;
  actor_user_id: string | null;
  planner_model: string;
  planner_prompt_version: string;
  planner_history_limit: number;
  last_batch_date: string | null;
}>;

type BatchRow = Readonly<{
  id: string;
  status: string;
  requested_count: number;
  planner_attempt_count: number;
  planner_started_at: string | null;
}>;

export type ClaimedAutomationItem = Readonly<{
  itemId: string;
  batchId: string;
  roleTitle: string;
}>;

export async function getDailyAutomationConfig() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("daily_artwork_automation")
    .select(
      "is_enabled,timezone,local_hour,daily_count,quality,background_variant,actor_user_id,planner_model,planner_prompt_version,planner_history_limit,last_batch_date",
    )
    .eq("singleton", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "The daily artwork automation configuration is unavailable.",
    );
  }

  return data as AutomationConfigRow;
}

async function getRecentConcepts(limit: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ai_artwork_concepts")
    .select(
      "role_title,role_family,threshold_name,concept_question,book_theme,last_used_on",
    )
    .order("last_used_on", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(Math.max(20, Math.min(300, limit)));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => ({
    roleTitle: item.role_title as string,
    roleFamily: item.role_family as string,
    threshold: item.threshold_name as string,
    conceptQuestion: item.concept_question as string,
    bookTheme: item.book_theme as string,
    usedOn: item.last_used_on as string,
  }));
}

async function planBatch(input: {
  batch: BatchRow;
  localDate: string;
  config: AutomationConfigRow;
}) {
  const supabase = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const nextAttempt = Math.min(5, input.batch.planner_attempt_count + 1);

  const { data: claimed, error: claimError } = await supabase
    .from("daily_artwork_batches")
    .update({
      status: "planning",
      planner_started_at: startedAt,
      planner_attempt_count: nextAttempt,
      planner_error: null,
    })
    .eq("id", input.batch.id)
    .in("status", ["planning", "planning_failed", "queued"])
    .select(
      "id,status,requested_count,planner_attempt_count,planner_started_at",
    )
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!claimed) {
    return {
      created: false,
      batchId: input.batch.id,
      localDate: input.localDate,
      reason: "planning-or-ready" as const,
    };
  }

  try {
    const recentConcepts = await getRecentConcepts(
      input.config.planner_history_limit,
    );

    const plan = await planDailyNobodyArtworks({
      localDate: input.localDate,
      count: input.config.daily_count,
      quality: input.config.quality,
      backgroundVariant: input.config.background_variant,
      recentConcepts,
    });

    const fingerprints = plan.items.map(createConceptFingerprint);
    const { data: existingConceptData, error: existingConceptError } =
      await supabase
        .from("ai_artwork_concepts")
        .select("id,fingerprint,use_count,first_used_on")
        .in("fingerprint", fingerprints);

    if (existingConceptError) {
      throw new Error(existingConceptError.message);
    }

    const existingByFingerprint = new Map(
      (existingConceptData ?? []).map((item) => [
        item.fingerprint as string,
        item,
      ]),
    );

    const conceptRows = plan.items.map((item, index) => {
      const fingerprint = fingerprints[index];
      const existing = existingByFingerprint.get(fingerprint);

      return {
        fingerprint,
        role_title: item.roleTitle,
        role_family: item.roleFamily,
        life_context: item.lifeContext,
        threshold_name: item.threshold,
        book_theme: item.bookTheme,
        concept_question: item.conceptQuestion,
        visual_story: item.visualStory,
        clothing_direction: item.clothingDirection,
        mood_direction: item.moodDirection,
        body_direction: item.bodyDirection,
        object_direction: item.objectDirection,
        creative_direction: item.creativeDirection,
        planner_model: plan.model,
        planner_version: NOBODY_DAILY_PLANNER_VERSION,
        first_used_on: existing?.first_used_on ?? input.localDate,
        last_used_on: input.localDate,
        use_count: Number(existing?.use_count ?? 0) + 1,
        metadata: {
          collection_title: plan.collectionTitle,
          collection_note: plan.collectionNote,
          planner_response_id: plan.responseId,
        },
      };
    });

    const { data: savedConcepts, error: conceptsError } = await supabase
      .from("ai_artwork_concepts")
      .upsert(conceptRows, { onConflict: "fingerprint" })
      .select("id,fingerprint");

    if (conceptsError || !savedConcepts) {
      throw new Error(
        conceptsError?.message ||
          "The AI concept library could not be updated.",
      );
    }

    const conceptIdByFingerprint = new Map(
      savedConcepts.map((item) => [
        item.fingerprint as string,
        item.id as string,
      ]),
    );

    const { error: deleteOldItemsError } = await supabase
      .from("daily_artwork_items")
      .delete()
      .eq("batch_id", input.batch.id)
      .in("status", ["queued", "failed", "cancelled"]);

    if (deleteOldItemsError) {
      throw new Error(deleteOldItemsError.message);
    }

    const { error: itemsError } = await supabase
      .from("daily_artwork_items")
      .insert(
        plan.items.map((item, index) => {
          const fingerprint = fingerprints[index];

          return {
            batch_id: input.batch.id,
            concept_id: conceptIdByFingerprint.get(fingerprint),
            position: item.position,
            base_archetype_slug: "nobody-classic",
            role_title: item.roleTitle,
            role_family: item.roleFamily,
            life_context: item.lifeContext,
            threshold_name: item.threshold,
            book_theme: item.bookTheme,
            concept_question: item.conceptQuestion,
            visual_story: item.visualStory,
            clothing_direction: item.clothingDirection,
            mood_direction: item.moodDirection,
            body_direction: item.bodyDirection,
            object_direction: item.objectDirection,
            creative_direction: item.creativeDirection,
            quality: input.config.quality,
            background_variant: input.config.background_variant,
            prop:
              item.objectDirection.toLowerCase() === "none"
                ? null
                : item.objectDirection,
            status: "queued",
            metadata: {
              local_date: input.localDate,
              source: "ai_daily_planner",
              concept_fingerprint: fingerprint,
              planner_model: plan.model,
              planner_version: NOBODY_DAILY_PLANNER_VERSION,
            },
          };
        }),
      );

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const now = new Date().toISOString();
    const [{ error: batchUpdateError }, { error: configUpdateError }] =
      await Promise.all([
        supabase
          .from("daily_artwork_batches")
          .update({
            status: "queued",
            requested_count: plan.items.length,
            planner_model: plan.model,
            planner_response_id: plan.responseId,
            planner_request_id: plan.requestId,
            planner_prompt_version: NOBODY_DAILY_PLANNER_VERSION,
            planner_completed_at: now,
            planner_error: null,
            collection_title: plan.collectionTitle,
            collection_note: plan.collectionNote,
            metadata: {
              source: "ai_daily_planner",
              quality: input.config.quality,
              background_variant: input.config.background_variant,
              planner_usage: plan.usage,
            },
          })
          .eq("id", input.batch.id),
        supabase
          .from("daily_artwork_automation")
          .update({
            last_batch_date: input.localDate,
            planner_model: plan.model,
            planner_prompt_version: NOBODY_DAILY_PLANNER_VERSION,
          })
          .eq("singleton", true),
      ]);

    if (batchUpdateError) {
      throw new Error(batchUpdateError.message);
    }

    if (configUpdateError) {
      throw new Error(configUpdateError.message);
    }

    await supabase.from("studio_audit_log").insert({
      actor_user_id: input.config.actor_user_id,
      action: "automation.ai_collection_planned",
      entity_type: "daily_artwork_batch",
      entity_id: input.batch.id,
      details: {
        local_date: input.localDate,
        count: plan.items.length,
        planner_model: plan.model,
        collection_title: plan.collectionTitle,
        roles: plan.items.map((item) => item.roleTitle),
      },
    });

    return {
      created: true,
      batchId: input.batch.id,
      localDate: input.localDate,
      reason: "ai-plan-created" as const,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The AI daily collection could not be planned.";

    await supabase
      .from("daily_artwork_batches")
      .update({
        status: "planning_failed",
        planner_error: message.slice(0, 1800),
        planner_completed_at: new Date().toISOString(),
      })
      .eq("id", input.batch.id);

    throw new Error(message);
  }
}

export async function ensureDailyAutomationBatch(input?: {
  now?: Date;
  force?: boolean;
}) {
  const now = input?.now ?? new Date();
  const { localDate, hour } = getRomeDateParts(now);
  const config = await getDailyAutomationConfig();

  if (!config.is_enabled && !input?.force) {
    return {
      created: false,
      batchId: null,
      localDate,
      reason: "disabled" as const,
    };
  }

  if (!config.actor_user_id) {
    throw new Error(
      "Choose an active owner or editor for the daily artwork automation.",
    );
  }

  const canCreate =
    input?.force === true ||
    (hour >= config.local_hour && hour <= config.local_hour + 3);

  if (!canCreate) {
    return {
      created: false,
      batchId: null,
      localDate,
      reason: "outside-window" as const,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingData, error: existingError } = await supabase
    .from("daily_artwork_batches")
    .select(
      "id,status,requested_count,planner_attempt_count,planner_started_at",
    )
    .eq("local_date", localDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  let batch = existingData as BatchRow | null;
  let createdNow = false;

  if (!batch) {
    const scheduledFor = new Date(now);
    scheduledFor.setSeconds(0, 0);

    const { data, error } = await supabase
      .from("daily_artwork_batches")
      .insert({
        local_date: localDate,
        timezone: config.timezone,
        scheduled_for: scheduledFor.toISOString(),
        requested_count: config.daily_count,
        status: "planning_failed",
        planner_model: config.planner_model,
        planner_prompt_version: NOBODY_DAILY_PLANNER_VERSION,
        planner_attempt_count: 0,
        planner_started_at: null,
        metadata: {
          local_hour: config.local_hour,
          source: "ai_daily_planner",
        },
      })
      .select(
        "id,status,requested_count,planner_attempt_count,planner_started_at",
      )
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        const { data: concurrentBatch, error: concurrentError } = await supabase
          .from("daily_artwork_batches")
          .select(
            "id,status,requested_count,planner_attempt_count,planner_started_at",
          )
          .eq("local_date", localDate)
          .single();

        if (concurrentError || !concurrentBatch) {
          throw new Error(
            concurrentError?.message ||
              "The daily artwork batch could not be found.",
          );
        }

        batch = concurrentBatch as BatchRow;
      } else {
        throw new Error(
          error?.message || "The daily artwork batch could not be created.",
        );
      }
    } else {
      batch = data as BatchRow;
      createdNow = true;
    }
  }

  const { count: itemCount, error: itemCountError } = await supabase
    .from("daily_artwork_items")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id);

  if (itemCountError) {
    throw new Error(itemCountError.message);
  }

  if ((itemCount ?? 0) > 0) {
    return {
      created: false,
      batchId: batch.id,
      localDate,
      reason: "existing" as const,
    };
  }

  const planningLeaseActive =
    !createdNow &&
    batch.status === "planning" &&
    Boolean(batch.planner_started_at) &&
    Date.now() - new Date(batch.planner_started_at as string).getTime() <
      PLANNING_LEASE_MS;

  if (planningLeaseActive) {
    return {
      created: false,
      batchId: batch.id,
      localDate,
      reason: "planning" as const,
    };
  }

  if (batch.planner_attempt_count >= 5) {
    throw new Error(
      "The AI daily collection could not be planned after five attempts. Review the planner configuration and retry from the Daily Studio.",
    );
  }

  return planBatch({ batch, localDate, config });
}

export async function claimNextDailyAutomationItem(): Promise<ClaimedAutomationItem | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_next_daily_artwork_item");

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (!row) {
    return null;
  }

  return {
    itemId: row.item_id as string,
    batchId: row.batch_id as string,
    roleTitle: row.role_title as string,
  };
}

export async function completeDailyAutomationItem(input: {
  itemId: string;
  batchId: string;
  generationJobId: string;
  artworkVariantId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("daily_artwork_items")
    .update({
      status: "completed",
      generation_job_id: input.generationJobId,
      artwork_variant_id: input.artworkVariantId,
      locked_at: null,
      lease_expires_at: null,
      error_message: null,
    })
    .eq("id", input.itemId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.rpc("refresh_daily_artwork_batch", {
    p_batch_id: input.batchId,
  });
}

export async function failDailyAutomationItem(input: {
  itemId: string;
  batchId: string;
  message: string;
  retryable?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: item } = await supabase
    .from("daily_artwork_items")
    .select("attempt_count")
    .eq("id", input.itemId)
    .maybeSingle();

  const attempts = Number(item?.attempt_count ?? 1);
  const shouldRetry = input.retryable !== false && attempts < 3;

  await supabase
    .from("daily_artwork_items")
    .update({
      status: shouldRetry ? "queued" : "failed",
      locked_at: null,
      lease_expires_at: null,
      error_message: input.message.slice(0, 1600),
    })
    .eq("id", input.itemId);

  await supabase.rpc("refresh_daily_artwork_batch", {
    p_batch_id: input.batchId,
  });
}
