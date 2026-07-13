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
    ? "Artwork creation is temporarily unavailable. Please check the studio configuration."
    : generationEnabled
      ? "Artwork creation and review are ready."
      : "The studio is ready. Artwork creation is currently unavailable.";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            Private image studio
          </p>

          <h1>
            Give form to the
            <span>next mask.</span>
          </h1>

          <p className={styles.heroLead}>
            Create official I AM NOBODY artworks, compare them with the original cover, and prepare only the strongest images for publication.
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
              Create a new artwork
              <span aria-hidden="true">↘</span>
            </Link>

            <Link
              className={styles.secondaryAction}
              href="/studio/artworks?filter=review"
            >
              Review existing artworks
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
                  ? "Studio ready"
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
            <span>Original book cover</span>
            <strong>Active</strong>
          </div>

          <div className={styles.coverStage}>
            <Image
              alt="Original I AM NOBODY book cover"
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
              <span>Primary reference</span>

              <strong>
                Original I AM NOBODY cover
              </strong>
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
                <dd>
                  {referenceReady
                    ? "Ready"
                    : "Unavailable"}
                </dd>
              </div>
            </dl>


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
            <small>Created sessions</small>
            <strong>{generations.count}</strong>
          </div>

          <p>
            Every artwork creation session in the studio.
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
            Artworks waiting for your creative decision.
          </p>
        </article>

        <article>
          <span className={styles.metricIndex}>
            03
          </span>

          <div>
            <small>Approved artworks</small>
            <strong>{approved.count}</strong>
          </div>

          <p>
            Artworks approved for final formats and publication.
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
            Artworks currently visible in the public gallery.
          </p>
        </article>
      </section>

      {!studioReady ? (
        <section className={styles.warning}>
          <div aria-hidden="true">!</div>

          <div>
            <h2>
              The studio needs attention
            </h2>

            <p>
              Artwork creation is unavailable right now. Check the studio configuration and try again.
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
              Artwork workflow
            </p>

            <h2>From artwork to publication.</h2>
          </div>

          <p>
            Create the artwork first, approve it, prepare the formats you need, and decide when it is ready for the public gallery.
          </p>
        </div>

        <div className={styles.modules}>
          <article className={styles.moduleCard}>
            <span>01</span>
            <h3>Create</h3>

            <p>
              Create a text-free artwork guided by the original cover and the I AM NOBODY visual identity.
            </p>

            <strong className={styles.complete}>
              Original cover applied
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>02</span>
            <h3>Validate</h3>

            <p>
              Review composition, anonymity, mask proportion, restraint, and editorial quality before approval.
            </p>

            <strong className={styles.complete}>
              Visual review
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>03</span>
            <h3>Compose</h3>

            <p>
              Create the book cover, social, story, poster, and gallery versions after the artwork is approved.
            </p>

            <strong className={styles.complete}>
              Formats ready
            </strong>
          </article>

          <article className={styles.moduleCard}>
            <span>04</span>
            <h3>Release</h3>

            <p>
              Prepare the gallery entry, inspect the finished artwork, and publish or remove it whenever needed.
            </p>

            <Link
              className={styles.pending}
              href="/studio/artworks"
            >
              Open the artwork archive
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}