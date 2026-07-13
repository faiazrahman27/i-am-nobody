import Image from "next/image";
import Link from "next/link";
import { NOBODY_BRAND } from "@/lib/nobody";
import {
  loadCanonicalReferenceAssets,
} from "@/lib/nobody/imagePipeline";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import {
  requireStudioAdmin,
} from "@/lib/supabase/studioAccess";
import ImageGenerator from "./components/ImageGenerator";
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
  const supabase =
    createSupabaseAdminClient();

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
  const admin = await requireStudioAdmin();
  const supabase =
    createSupabaseAdminClient();

  const [
    generations,
    toReview,
    approved,
    published,
    privateBucket,
    publicBucket,
    referenceRow,
    referenceIntegrity,
  ] = await Promise.all([
    countRows("generation_jobs"),

    countRows("artwork_variants", [
      "candidate",
      "reviewing",
      "auto_review_failed",
      "ready_for_review",
    ]),

    countRows("artwork_variants", [
      "approved_artwork",
      "approved_for_template",
      "published",
    ]),

    countRows("gallery_entries", [
      "published",
    ]),

    supabase.storage.getBucket(
      "nobody-private",
    ),

    supabase.storage.getBucket(
      "nobody-public",
    ),

    supabase
      .from("brand_references")
      .select(
        "reference_code,version,sha256,width,height,is_active",
      )
      .eq(
        "reference_code",
        NOBODY_BRAND
          .canonicalReference.id,
      )
      .maybeSingle(),

    loadCanonicalReferenceAssets()
      .then(() => true)
      .catch(() => false),
  ]);

  const databaseReady = [
    generations,
    toReview,
    approved,
    published,
  ].every((result) => !result.error);

  const storageReady =
    Boolean(privateBucket.data) &&
    !privateBucket.error;

  const obsoleteBucketRemoved =
    !publicBucket.data;

  const referenceReady =
    referenceIntegrity &&
    referenceRow.data?.is_active === true &&
    referenceRow.data?.sha256 ===
      NOBODY_BRAND.canonicalReference.sha256 &&
    referenceRow.data?.version === "2.0.0";

  const studioReady =
    databaseReady &&
    storageReady &&
    obsoleteBucketRemoved &&
    referenceReady;

  const generationEnabled = Boolean(
    process.env.OPENAI_API_KEY?.trim(),
  );

  const systemMessage = !studioReady
    ? "The studio foundation still needs attention."
    : generationEnabled
      ? "The canonical reference is verified. Live generation and review are available."
      : "The studio is complete. Live generation remains intentionally locked until the server key is added.";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            Private visual laboratory
          </p>

          <h1>
            Give form to the
            <span>next mask.</span>
          </h1>

          <p className={styles.heroLead}>
            A controlled workspace for creating
            official I AM NOBODY artworks, testing
            them against the canonical visual
            grammar, and preparing only the strongest
            images for release.
          </p>

          <blockquote className={styles.manifesto}>
            “The role changes. The posture changes.
            Nobody remains.”
          </blockquote>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryAction}
              href="#generator-title"
            >
              Start a private generation
              <span aria-hidden="true">↘</span>
            </Link>

            <Link
              className={styles.secondaryAction}
              href="/studio/artworks?filter=review"
            >
              Open the review queue
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div
            className={`${styles.systemStatus} ${
              studioReady
                ? styles.systemStatusReady
                : styles.systemStatusError
            }`}
          >
            <span aria-hidden="true" />

            <div>
              <strong>
                {studioReady
                  ? "Studio integrity confirmed"
                  : "Setup incomplete"}
              </strong>

              <p>{systemMessage}</p>
            </div>
          </div>
        </div>

        <aside className={styles.referenceCard}>
          <div
            aria-hidden="true"
            className={styles.referenceGlow}
          />

          <div className={styles.referenceTopline}>
            <span>Canonical reference</span>
            <strong>Locked</strong>
          </div>

          <div className={styles.coverStage}>
            <Image
              alt="Original I AM NOBODY canonical book cover"
              className={styles.cover}
              height={
                NOBODY_BRAND
                  .canonicalReference.height
              }
              priority
              src={
                NOBODY_BRAND
                  .canonicalReference.publicPath
              }
              width={
                NOBODY_BRAND
                  .canonicalReference.width
              }
            />
          </div>

          <div className={styles.coverMeta}>
            <div>
              <span>Visual authority</span>

              <strong>
                {
                  NOBODY_BRAND
                    .canonicalReference.id
                }
              </strong>
            </div>

            <dl>
              <div>
                <dt>Master</dt>
                <dd>906 × 1280</dd>
              </div>

              <div>
                <dt>Reference</dt>
                <dd>Server-attached</dd>
              </div>

              <div>
                <dt>Integrity</dt>
                <dd>
                  {referenceReady
                    ? "Verified"
                    : "Check required"}
                </dd>
              </div>
            </dl>

            <small>
              SHA-256{" "}
              {NOBODY_BRAND
                .canonicalReference.sha256.slice(
                  0,
                  16,
                )}
              …
            </small>
          </div>
        </aside>
      </section>

      <section
        aria-label="Studio overview"
        className={styles.metrics}
      >
        <article>
          <span className={styles.metricIndex}>
            01
          </span>

          <div>
            <small>Generation sessions</small>
            <strong>{generations.count}</strong>
          </div>

          <p>
            Every private image request recorded in
            the studio.
          </p>
        </article>

        <article>
          <span className={styles.metricIndex}>
            02
          </span>

          <div>
            <small>Awaiting human review</small>
            <strong>{toReview.count}</strong>
          </div>

          <p>
            Automated guidance is ready; the creative
            decision is still human.
          </p>
        </article>

        <article>
          <span className={styles.metricIndex}>
            03
          </span>

          <div>
            <small>Approved masters</small>
            <strong>{approved.count}</strong>
          </div>

          <p>
            Clean artworks protected as immutable
            official candidates.
          </p>
        </article>

        <article>
          <span className={styles.metricIndex}>
            04
          </span>

          <div>
            <small>Released to gallery</small>
            <strong>{published.count}</strong>
          </div>

          <p>
            Works deliberately published after the
            complete approval path.
          </p>
        </article>
      </section>

      {!studioReady ? (
        <section className={styles.warning}>
          <div aria-hidden="true">!</div>

          <div>
            <h2>
              The production foundation is incomplete
            </h2>

            <p>
              Verify migrations <code>006</code>{" "}
              through <code>010</code>, confirm that{" "}
              <code>nobody-private</code> is the only
              I AM NOBODY storage bucket, and restore
              the approved canonical cover if its
              integrity check fails.
            </p>
          </div>
        </section>
      ) : null}

      {studioReady ? (
        <ImageGenerator
          canGenerate={admin.role !== "reviewer"}
          generationEnabled={generationEnabled}
        />
      ) : null}

      <section className={styles.processSection}>
        <div className={styles.processHeading}>
          <div>
            <p className={styles.eyebrow}>
              Controlled production path
            </p>

            <h2>From mask to release.</h2>
          </div>

          <p>
            The artwork remains pure. Typography,
            formats, publication, and all future
            certification layers are handled
            separately and deliberately.
          </p>
        </div>

        <div className={styles.modules}>
          <article className={styles.moduleCard}>
            <span>01</span>
            <h3>Create</h3>

            <p>
              Generate a clean, text-free artwork from
              the permanent canonical cover and mask
              reference.
            </p>

            <strong className={styles.complete}>
              Reference locked
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>02</span>
            <h3>Validate</h3>

            <p>
              Compare composition, anonymity, mask
              proportion, restraint, and editorial
              quality before a human sees the result.
            </p>

            <strong className={styles.complete}>
              Two-stage review
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>03</span>
            <h3>Compose</h3>

            <p>
              Apply the title, author, social sizes,
              poster layout, or gallery thumbnail only
              after the clean master is approved.
            </p>

            <strong className={styles.complete}>
              Deterministic templates
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>04</span>
            <h3>Release</h3>

            <p>
              Create a private gallery draft, inspect
              the final rendering, and publish or
              withdraw it through a human-controlled
              decision.
            </p>

            <Link
              className={styles.pending}
              href="/studio/artworks"
            >
              Enter the private archive
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}