import Link from "next/link";
import { getRomeDateParts } from "@/lib/nobody/dailyAutomation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import AutomationControls from "./AutomationControls";
import AutomationLiveRefresh from "./AutomationLiveRefresh";
import styles from "./automation.module.css";

export const dynamic = "force-dynamic";

type ConfigRow = Readonly<{
  is_enabled: boolean;
  timezone: string;
  local_hour: number;
  daily_count: number;
  quality: string;
  background_variant: string;
  planner_model: string;
  last_batch_date: string | null;
  metadata: Record<string, unknown> | null;
}>;

type BatchRow = Readonly<{
  id: string;
  local_date: string;
  requested_count: number;
  completed_count: number;
  failed_count: number;
  status: string;
  collection_title: string | null;
  collection_note: string | null;
  planner_error: string | null;
  started_at: string | null;
  completed_at: string | null;
}>;

type ItemRow = Readonly<{
  id: string;
  batch_id: string;
  position: number;
  role_title: string;
  role_family: string;
  life_context: string;
  threshold_name: string;
  book_theme: string;
  concept_question: string;
  status: string;
  artwork_variant_id: string | null;
  error_message: string | null;
}>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function labelStatus(value: string) {
  switch (value) {
    case "queued":
      return "Queued";
    case "processing":
      return "Generating";
    case "completed":
      return "Ready for review";
    case "failed":
      return "Needs retry";
    case "planning":
      return "Planning";
    case "planning_failed":
      return "Planning failed";
    default:
      return value.replaceAll("_", " ");
  }
}

function summarizeBatch(batch: BatchRow, items: readonly ItemRow[]) {
  const queued = items.filter((item) => item.status === "queued").length;
  const processing = items.filter((item) => item.status === "processing").length;
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;

  return {
    queued,
    processing,
    completed,
    failed,
    remaining: queued + processing,
  };
}

function buildTodayStatus(input: {
  config: ConfigRow | null;
  todayBatch: BatchRow | null;
  todayItems: readonly ItemRow[];
  nowHour: number;
  schedulerConfigured: boolean;
}) {
  const { config, todayBatch, todayItems, nowHour, schedulerConfigured } = input;
  const scheduleHour = config?.local_hour ?? 8;
  const metrics = summarizeBatch(
    todayBatch ?? {
      id: "",
      local_date: "",
      requested_count: 0,
      completed_count: 0,
      failed_count: 0,
      status: "queued",
      collection_title: null,
      collection_note: null,
      planner_error: null,
      started_at: null,
      completed_at: null,
    },
    todayItems,
  );

  if (!config?.is_enabled) {
    return {
      tone: "paused",
      title: "Daily automation is paused.",
      description:
        "No automatic planning or generation will start until daily automation is resumed.",
    } as const;
  }

  if (!schedulerConfigured) {
    return {
      tone: "error",
      title: "Supabase Cron setup is required.",
      description:
        "Run migration 014, create the two required Vault secrets, and configure the Supabase Cron job before relying on automatic worker waves. Manual controls remain available.",
    } as const;
  }

  if (!todayBatch) {
    if (nowHour < scheduleHour) {
      return {
        tone: "scheduled",
        title: "Today’s collection has not started yet.",
        description: `Supabase Cron checks the worker every ten minutes. Automatic planning becomes eligible at ${String(scheduleHour).padStart(2, "0")}:00 Rome time, and you can also prepare today’s collection manually right now.`,
      } as const;
    }

    return {
      tone: "scheduled",
      title: "Waiting for the next Supabase Cron wave.",
      description:
        "Supabase Cron calls the production worker every ten minutes. If you want to start immediately, use the manual generation controls below.",
    } as const;
  }

  if (todayBatch.planner_error) {
    return {
      tone: "error",
      title: "Today’s collection needs another planning attempt.",
      description: todayBatch.planner_error,
    } as const;
  }

  if (metrics.processing > 0) {
    return {
      tone: "running",
      title: "Generation is currently running.",
      description: `${metrics.processing} artwork${metrics.processing === 1 ? " is" : "s are"} being generated right now. ${metrics.completed} already passed into human review.`,
    } as const;
  }

  if (metrics.remaining > 0) {
    return {
      tone: "waiting",
      title: "Today’s collection is queued for the next Supabase Cron wave.",
      description: `${metrics.remaining} artwork${metrics.remaining === 1 ? " remains" : "s remain"} in the queue. Supabase Cron calls the worker every ten minutes, or you can run a manual generation wave now.`,
    } as const;
  }

  if (metrics.failed > 0) {
    return {
      tone: "warning",
      title: "Some artworks need a manual retry.",
      description: `${metrics.failed} artwork${metrics.failed === 1 ? " has" : "s have"} exhausted the automatic attempts. Use “Retry failed artworks” to return them to the queue.`,
    } as const;
  }

  if (metrics.completed === todayItems.length && todayItems.length > 0) {
    return {
      tone: "success",
      title: "Today’s collection is ready for human review.",
      description: `${metrics.completed}/${todayItems.length} artworks passed the automated production gate and are now ready for review.`,
    } as const;
  }

  return {
    tone: "scheduled",
    title: "Automation is ready.",
    description:
      "The daily system is active and waiting for the next valid planning or generation event.",
  } as const;
}

export default async function AutomationPage() {
  const admin = await requireStudioAdmin();
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const { localDate: today, hour: romeHour } = getRomeDateParts(now);

  const [{ data: configData }, { data: batchData }] = await Promise.all([
    supabase
      .from("daily_artwork_automation")
      .select(
        "is_enabled,timezone,local_hour,daily_count,quality,background_variant,planner_model,last_batch_date,metadata",
      )
      .eq("singleton", true)
      .maybeSingle(),
    supabase
      .from("daily_artwork_batches")
      .select(
        "id,local_date,requested_count,completed_count,failed_count,status,collection_title,collection_note,planner_error,started_at,completed_at",
      )
      .order("local_date", { ascending: false })
      .limit(14),
  ]);

  const config = configData as ConfigRow | null;
  const schedulerConfigured =
    config?.metadata?.scheduler === "supabase-cron";
  const batches = (batchData ?? []) as BatchRow[];
  const todayBatch =
    batches.find((batch) => batch.local_date === today) ?? null;

  const batchIds = batches.map((batch) => batch.id);
  const { data: allItemsData } = batchIds.length
    ? await supabase
        .from("daily_artwork_items")
        .select(
          "id,batch_id,position,role_title,role_family,life_context,threshold_name,book_theme,concept_question,status,artwork_variant_id,error_message",
        )
        .in("batch_id", batchIds)
        .order("batch_id")
        .order("position")
    : { data: [] as ItemRow[] };

  const allItems = (allItemsData ?? []) as ItemRow[];
  const itemsByBatchId = new Map<string, ItemRow[]>();

  for (const item of allItems) {
    const list = itemsByBatchId.get(item.batch_id) ?? [];
    list.push(item);
    itemsByBatchId.set(item.batch_id, list);
  }

  const todayItems = todayBatch ? itemsByBatchId.get(todayBatch.id) ?? [] : [];

  const cards = await Promise.all(
    todayItems.map(async (item) => {
      let previewUrl: string | null = null;

      if (item.artwork_variant_id) {
        const { data: variant } = await supabase
          .from("artwork_variants")
          .select("thumbnail_storage_path,storage_path")
          .eq("id", item.artwork_variant_id)
          .maybeSingle();

        const path = variant?.thumbnail_storage_path || variant?.storage_path;

        if (path) {
          const { data: signed } = await supabase.storage
            .from("nobody-private")
            .createSignedUrl(path, 60 * 30);
          previewUrl = signed?.signedUrl ?? null;
        }
      }

      return { ...item, previewUrl };
    }),
  );

  const completed = todayItems.filter((item) => item.status === "completed").length;
  const failed = todayItems.filter((item) => item.status === "failed").length;
  const processing = todayItems.filter((item) => item.status === "processing").length;
  const queued = todayItems.filter((item) => item.status === "queued").length;
  const remaining = queued + processing;
  const todayStatus = buildTodayStatus({
    config,
    todayBatch,
    todayItems,
    nowHour: romeHour,
    schedulerConfigured,
  });

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Autonomous daily studio</p>
          <h1>Ten new artworks. Daily at 08:00.</h1>
          <p>
            At 08:00 in Rome, AI studies the embedded book context, the four
            thresholds, the 25 Keys, and recent Studio history. It then creates
            ten new human roles and life situations, writes the creative
            direction, generates every artwork inside the fixed visual system,
            evaluates the results, and places them in your private review queue.
            Supabase Cron calls the production worker every ten minutes so delayed
            or remaining items continue automatically.
          </p>
        </div>

        <aside className={styles.scheduleCard}>
          <span>Daily schedule</span>
          <strong>
            {String(config?.local_hour ?? 8).padStart(2, "0")}:00
          </strong>
          <small>
            {config?.timezone ?? "Europe/Rome"} · {config?.daily_count ?? 10}{" "}
            artworks
          </small>
          <small>Image quality · {config?.quality ?? "high"}</small>
          <small>
            Scheduler · {schedulerConfigured ? "Supabase Cron / 10 min" : "Setup required"}
          </small>
          <em className={config?.is_enabled ? styles.live : styles.paused}>
            {config?.is_enabled ? "Active" : "Paused"}
          </em>
        </aside>
      </section>

      <section className={styles.statusPanel}>
        <div>
          <p className={styles.eyebrow}>Live production status</p>
          <h2>{todayStatus.title}</h2>
          <p>{todayStatus.description}</p>
        </div>
        <div className={styles.statusMeta}>
          <div>
            <span>Rome time</span>
            <strong>{String(romeHour).padStart(2, "0")}:00</strong>
          </div>
          <div>
            <span>Today</span>
            <strong>{formatDate(today)}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{todayStatus.tone}</strong>
          </div>
        </div>
      </section>

      <AutomationControls
        canManage={admin.role !== "reviewer"}
        enabled={config?.is_enabled ?? false}
        showPlanningRecovery={!todayBatch || Boolean(todayBatch.planner_error)}
        showGenerationRecovery={
          Boolean(todayBatch) && !todayBatch?.planner_error && remaining > 0
        }
        showFailedRecovery={failed > 0}
      />

      <AutomationLiveRefresh
        enabled={Boolean(todayBatch) && (remaining > 0 || failed > 0)}
      />

      <section className={styles.metrics} aria-label="Today’s progress">
        <article>
          <span>Planned</span>
          <strong>{todayItems.length}</strong>
        </article>
        <article>
          <span>Ready for review</span>
          <strong>{completed}</strong>
        </article>
        <article>
          <span>Queued / generating</span>
          <strong>{remaining}</strong>
        </article>
        <article>
          <span>Needs retry</span>
          <strong>{failed}</strong>
        </article>
      </section>

      <section className={styles.todaySection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Today · {formatDate(today)}</p>
            <h2>
              {todayBatch?.collection_title ||
                (todayBatch ? "Morning collection" : "Not prepared yet")}
            </h2>
            {todayBatch?.collection_note ? (
              <p>{todayBatch.collection_note}</p>
            ) : null}
          </div>
          <Link href="/studio/artworks?filter=review">Open human review →</Link>
        </div>

        {todayBatch?.planner_error ? (
          <div className={styles.emptyState}>
            <h3>The daily direction needs another planning attempt.</h3>
            <p>{todayBatch.planner_error}</p>
          </div>
        ) : cards.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>Today’s AI directions will appear here.</h3>
            <p>
              Preparing the queue asks AI to create ten new concepts from the
              book and recent Studio history. It does not select from a fixed
              list of professions or characters.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {cards.map((item) => (
              <article className={styles.itemCard} key={item.id}>
                <div className={styles.preview}>
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.role_title} src={item.previewUrl} />
                  ) : (
                    <span>{String(item.position).padStart(2, "0")}</span>
                  )}
                </div>
                <div className={styles.itemBody}>
                  <div>
                    <small>
                      {item.threshold_name} · {item.role_family}
                    </small>
                    <h3>{item.role_title}</h3>
                  </div>
                  <span className={styles.status}>
                    {labelStatus(item.status)}
                  </span>
                  <p>{item.concept_question}</p>
                  <small>{item.book_theme}</small>
                  {item.artwork_variant_id ? (
                    <Link href={`/studio/artworks/${item.artwork_variant_id}`}>
                      Review artwork →
                    </Link>
                  ) : null}
                  {item.error_message ? <em>{item.error_message}</em> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.history}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Recent mornings</p>
            <h2>Automation history</h2>
          </div>
        </div>

        <div className={styles.historyTable}>
          {batches.length === 0 ? (
            <p>No daily collections have been prepared yet.</p>
          ) : (
            batches.map((batch) => {
              const batchItems = itemsByBatchId.get(batch.id) ?? [];
              const summary = summarizeBatch(batch, batchItems);

              return (
                <details
                  className={styles.historyDetails}
                  key={batch.id}
                  open={batch.id === todayBatch?.id}
                >
                  <summary className={styles.historySummary}>
                    <strong>{formatDate(batch.local_date)}</strong>
                    <span>{labelStatus(batch.status)}</span>
                    <small>
                      {summary.completed}/{batch.requested_count} ready
                    </small>
                    <small>
                      {batch.collection_title || "Morning collection"}
                    </small>
                  </summary>

                  <div className={styles.historyBody}>
                    <div className={styles.historyMetaGrid}>
                      <article>
                        <span>Started</span>
                        <strong>{formatDateTime(batch.started_at)}</strong>
                      </article>
                      <article>
                        <span>Completed</span>
                        <strong>{formatDateTime(batch.completed_at)}</strong>
                      </article>
                      <article>
                        <span>Queued / generating</span>
                        <strong>{summary.remaining}</strong>
                      </article>
                      <article>
                        <span>Needs retry</span>
                        <strong>{summary.failed}</strong>
                      </article>
                    </div>

                    {batch.collection_note ? (
                      <p className={styles.historyNote}>{batch.collection_note}</p>
                    ) : null}

                    {batch.planner_error ? (
                      <p className={styles.historyError}>{batch.planner_error}</p>
                    ) : null}

                    {batchItems.length > 0 ? (
                      <div className={styles.historyItems}>
                        {batchItems.map((item) => (
                          <div className={styles.historyItemRow} key={item.id}>
                            <div>
                              <small>#{String(item.position).padStart(2, "0")}</small>
                              <strong>{item.role_title}</strong>
                            </div>
                            <span className={styles.status}>{labelStatus(item.status)}</span>
                            <p>{item.concept_question}</p>
                            {item.artwork_variant_id ? (
                              <Link href={`/studio/artworks/${item.artwork_variant_id}`}>
                                Open artwork →
                              </Link>
                            ) : null}
                            {item.error_message ? <em>{item.error_message}</em> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.historyNote}>
                        No artwork items were created for this batch.
                      </p>
                    )}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
