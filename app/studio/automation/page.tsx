import Link from "next/link";
import { getRomeDateParts } from "@/lib/nobody/dailyAutomation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import AutomationControls from "./AutomationControls";
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

export default async function AutomationPage() {
  const admin = await requireStudioAdmin();
  const supabase = createSupabaseAdminClient();
  const today = getRomeDateParts(new Date()).localDate;

  const [{ data: configData }, { data: batchData }] = await Promise.all([
    supabase
      .from("daily_artwork_automation")
      .select(
        "is_enabled,timezone,local_hour,daily_count,quality,background_variant,planner_model,last_batch_date",
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
  const batches = (batchData ?? []) as BatchRow[];
  const todayBatch =
    batches.find((batch) => batch.local_date === today) ?? null;

  let items: ItemRow[] = [];

  if (todayBatch) {
    const { data } = await supabase
      .from("daily_artwork_items")
      .select(
        "id,position,role_title,role_family,life_context,threshold_name,book_theme,concept_question,status,artwork_variant_id,error_message",
      )
      .eq("batch_id", todayBatch.id)
      .order("position");

    items = (data ?? []) as ItemRow[];
  }

  const cards = await Promise.all(
    items.map(async (item) => {
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

  const completed = todayBatch?.completed_count ?? 0;
  const failed = todayBatch?.failed_count ?? 0;
  const remaining = Math.max(
    (todayBatch?.requested_count ?? config?.daily_count ?? 10) -
      completed -
      failed,
    0,
  );

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Autonomous daily studio</p>
          <h1>Ten new artworks. Every morning.</h1>
          <p>
            At 10:00 in Rome, AI studies the book context, the four thresholds,
            the 25 Keys, and recent Studio history. It then creates ten new
            human roles and life situations, writes the complete creative
            direction, generates every artwork inside the fixed visual system,
            evaluates the results, and places them in your private review queue.
          </p>
        </div>

        <aside className={styles.scheduleCard}>
          <span>Daily schedule</span>
          <strong>
            {String(config?.local_hour ?? 10).padStart(2, "0")}:00
          </strong>
          <small>
            {config?.timezone ?? "Europe/Rome"} · {config?.daily_count ?? 10}{" "}
            artworks
          </small>
          <em className={config?.is_enabled ? styles.live : styles.paused}>
            {config?.is_enabled ? "Active" : "Paused"}
          </em>
        </aside>
      </section>

      <AutomationControls
        canManage={admin.role !== "reviewer"}
        enabled={config?.is_enabled ?? false}
      />

      <section className={styles.metrics} aria-label="Today’s progress">
        <article>
          <span>Planned</span>
          <strong>{items.length}</strong>
        </article>
        <article>
          <span>Ready for review</span>
          <strong>{completed}</strong>
        </article>
        <article>
          <span>Still processing</span>
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
                    {item.status.replaceAll("_", " ")}
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
            batches.map((batch) => (
              <div key={batch.id}>
                <strong>{formatDate(batch.local_date)}</strong>
                <span>{batch.status.replaceAll("_", " ")}</span>
                <small>
                  {batch.completed_count}/{batch.requested_count} ready
                </small>
                <small>{batch.collection_title || "Morning collection"}</small>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
