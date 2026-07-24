import Image from "next/image";
import Link from "next/link";
import { getNobodyRuntimeReadiness, NOBODY_BRAND } from "@/lib/nobody";
import { loadCanonicalReferenceAssets } from "@/lib/nobody/imagePipeline";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import styles from "./studio.module.css";

export const dynamic = "force-dynamic";

type CountResult = Readonly<{
  count: number;
  error: string | null;
}>;

async function countRows(
  table: string,
  statuses?: readonly string[],
): Promise<CountResult> {
  const supabase = createSupabaseAdminClient();

  let query = supabase.from(table).select("*", {
    count: "exact",
    head: true,
  });

  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const { count, error } = await query;

  return {
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

export default async function StudioHomePage() {
  await requireStudioAdmin();
  const supabase = createSupabaseAdminClient();

  const [
    generations,
    toReview,
    approved,
    published,
    privateBucket,
    publicBucket,
    referenceRow,
    referenceIntegrity,
    automationConfig,
  ] = await Promise.all([
    countRows("generation_jobs"),

    countRows("artwork_variants", [
      "candidate",
      "reviewing",
      "auto_rejected",
      "auto_review_failed",
      "ready_for_review",
    ]),

    countRows("artwork_variants", [
      "approved_artwork",
      "approved_for_template",
      "published",
    ]),

    countRows("gallery_entries", ["published"]),

    supabase.storage.getBucket("nobody-private"),

    supabase.storage.getBucket("nobody-public"),

    supabase
      .from("brand_references")
      .select("reference_code,version,sha256,width,height,is_active")
      .eq("reference_code", NOBODY_BRAND.canonicalReference.id)
      .maybeSingle(),

    loadCanonicalReferenceAssets()
      .then(() => true)
      .catch(() => false),

    supabase
      .from("daily_artwork_automation")
      .select("is_enabled,daily_count,local_hour,timezone")
      .eq("singleton", true)
      .maybeSingle(),
  ]);

  const databaseReady = [generations, toReview, approved, published].every(
    (result) => !result.error,
  );

  const storageReady = Boolean(privateBucket.data) && !privateBucket.error;

  const obsoleteBucketRemoved = !publicBucket.data;

  const referenceReady =
    referenceIntegrity &&
    referenceRow.data?.is_active === true &&
    referenceRow.data?.sha256 === NOBODY_BRAND.canonicalReference.sha256 &&
    referenceRow.data?.version === "2.0.0";

  const studioReady =
    databaseReady && storageReady && obsoleteBucketRemoved && referenceReady;

  const runtimeReadiness = getNobodyRuntimeReadiness();

  const automationReady =
    Boolean(automationConfig.data) && !automationConfig.error;

  const systemMessage = !studioReady
    ? "Database, storage, or canonical asset validation failed."
    : !automationReady
      ? "The daily automation configuration is unavailable."
      : runtimeReadiness.ready
        ? "Daily planning, generation, AI review, certification, and verification are active."
        : "Add the required server environment variables and redeploy to activate AI production.";

  const systemTitle =
    studioReady && automationReady && runtimeReadiness.ready
      ? "Production system active"
      : studioReady && automationReady
        ? "API configuration required"
        : "Configuration error";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Private image studio</p>

          <h1>
            Ten new artworks.
            <span>Every morning.</span>
          </h1>

          <p className={styles.heroLead}>
            Every morning, AI develops ten new I AM NOBODY concepts from the
            book and recent Studio history, creates them inside the fixed visual
            system, evaluates the results, and places them in your private review queue. You decide
            what changes, what is approved, and what is published.
          </p>

          <blockquote className={styles.manifesto}>
            “The role changes. The posture changes. Nobody remains.”
          </blockquote>

          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/studio/automation">
              Open the daily studio
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              className={styles.secondaryAction}
              href="/studio/artworks?filter=review"
            >
              Review today’s artworks
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div
            className={`${styles.systemStatus} ${
              studioReady && automationReady && runtimeReadiness.ready
                ? styles.systemStatusReady
                : styles.systemStatusError
            }`}
          >
            <span aria-hidden="true" />

            <div>
              <strong>
                {systemTitle}
              </strong>

              <p>{systemMessage}</p>
            </div>
          </div>
        </div>

        <aside className={styles.referenceCard}>
          <div aria-hidden="true" className={styles.referenceGlow} />

          <div className={styles.referenceTopline}>
            <span>Original book cover</span>
            <strong>{referenceReady ? "Active" : "Unavailable"}</strong>
          </div>

          <div className={styles.coverStage}>
            <Image
              alt="Original I AM NOBODY book cover"
              className={styles.cover}
              height={NOBODY_BRAND.canonicalReference.height}
              priority
              src={NOBODY_BRAND.canonicalReference.publicPath}
              width={NOBODY_BRAND.canonicalReference.width}
            />
          </div>

          <div className={styles.coverMeta}>
            <div>
              <span>Primary reference</span>

              <strong>Original I AM NOBODY cover</strong>
            </div>

            <dl>
              <div>
                <dt>Artwork size</dt>
                <dd>906 × 1280</dd>
              </div>

              <div>
                <dt>Used for</dt>
                <dd>Every generation</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>{referenceReady ? "Ready" : "Unavailable"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>

      <section aria-label="Studio overview" className={styles.metrics}>
        <article>
          <span className={styles.metricIndex}>01</span>

          <div>
            <small>Created sessions</small>
            <strong>{generations.count}</strong>
          </div>

          <p>Every artwork creation session in the studio.</p>
        </article>

        <article>
          <span className={styles.metricIndex}>02</span>

          <div>
            <small>Awaiting human review</small>
            <strong>{toReview.count}</strong>
          </div>

          <p>Artworks waiting for your creative decision.</p>
        </article>

        <article>
          <span className={styles.metricIndex}>03</span>

          <div>
            <small>Approved artworks</small>
            <strong>{approved.count}</strong>
          </div>

          <p>Artworks approved for final formats and publication.</p>
        </article>

        <article>
          <span className={styles.metricIndex}>04</span>

          <div>
            <small>Released to gallery</small>
            <strong>{published.count}</strong>
          </div>

          <p>Artworks currently visible in the public gallery.</p>
        </article>
      </section>

      {!studioReady ? (
        <section className={styles.warning}>
          <div aria-hidden="true">!</div>

          <div>
            <h2>Studio configuration error</h2>

            <p>
              Verify the database migration, private storage bucket, and canonical assets.
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.processSection}>
        <div className={styles.processHeading}>
          <div>
            <p className={styles.eyebrow}>Artwork workflow</p>

            <h2>From morning generation to verification.</h2>
          </div>

          <p>
            The automated studio creates and evaluates the work. A person
            approves, guides corrections, and decides what enters the official
            gallery.
          </p>
        </div>

        <div className={styles.modules}>
          <article className={styles.moduleCard}>
            <span>01</span>
            <h3>Generate</h3>

            <p>
              AI creates ten new roles and life situations from the book every
              morning, then produces them within the established visual system.
            </p>

            <strong className={styles.complete}>Daily at 08:00 Rome</strong>
          </article>

          <article className={styles.moduleCard}>
            <span>02</span>
            <h3>Evaluate</h3>

            <p>
              Each image is checked for composition, anonymity, consistency,
              restraint, and editorial quality before it reaches you.
            </p>

            <strong className={styles.complete}>
              AI review completed first
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>03</span>
            <h3>Approve</h3>

            <p>
              You approve the artwork or request a corrected version with your
              own direction. Approval creates its certificate and required
              formats.
            </p>

            <strong className={styles.complete}>Human decision required</strong>
          </article>

          <article className={styles.moduleCard}>
            <span>04</span>
            <h3>Publish</h3>

            <p>
              The certified artwork is prepared as a private gallery entry.
              Publication requires your decision, and visitors can verify its
              certificate.
            </p>

            <Link className={styles.pending} href="/studio/artworks">
              Open the artwork archive
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
