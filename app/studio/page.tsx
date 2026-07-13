import Image from "next/image";
import Link from "next/link";
import {
  NOBODY_BRAND,
} from "@/lib/nobody";
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
import SignOutButton from "./components/SignOutButton";
import styles from "./studio.module.css";

export const dynamic =
  "force-dynamic";

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

  let query = supabase
    .from(table)
    .select("*", {
      count: "exact",
      head: true,
    });

  if (statuses?.length) {
    query = query.in(
      "status",
      statuses,
    );
  }

  const { count, error } =
    await query;

  return {
    count: count ?? 0,
    error:
      error?.message ?? null,
  };
}

export default async function StudioHomePage() {
  const admin =
    await requireStudioAdmin();

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
    countRows(
      "generation_jobs",
    ),

    countRows(
      "artwork_variants",
      [
        "candidate",
        "reviewing",
        "auto_review_failed",
        "ready_for_review",
      ],
    ),

    countRows(
      "artwork_variants",
      [
        "approved_artwork",
        "approved_for_template",
        "published",
      ],
    ),

    countRows(
      "gallery_entries",
      ["published"],
    ),

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
  ].every(
    (result) =>
      !result.error,
  );

  const storageReady =
    Boolean(privateBucket.data) &&
    !privateBucket.error;

  const obsoleteBucketRemoved =
    !publicBucket.data;

  const referenceReady =
    referenceIntegrity &&
    referenceRow.data
      ?.is_active === true &&
    referenceRow.data?.sha256 ===
      NOBODY_BRAND
        .canonicalReference
        .sha256 &&
    referenceRow.data?.version ===
      "2.0.0";

  const studioReady =
    databaseReady &&
    storageReady &&
    obsoleteBucketRemoved &&
    referenceReady;

  const generationEnabled =
    Boolean(
      process.env.OPENAI_API_KEY
        ?.trim(),
    );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            IMAGE STUDIO
          </p>

          <h1>I AM NOBODY</h1>
        </div>

        <div className={styles.account}>
          <Link
            className={styles.signOut}
            href="/studio"
          >
            Create
          </Link>

          <Link
            className={styles.signOut}
            href="/studio/artworks"
          >
            Review
          </Link>

          <Link
            className={styles.signOut}
            href="/gallery"
          >
            Gallery
          </Link>

          <div>
            <span>
              {admin.displayName ||
                admin.email}
            </span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            Canonical artwork system
          </p>

          <h2>
            One identity. Many masks.
          </h2>

          <p>
            Generate clean official
            artworks from the verified
            original cover, score them
            against the visual grammar,
            approve them manually, then
            create deterministic cover,
            social, poster, and gallery
            versions.
          </p>

          <div className={styles.statusLine}>
            <span
              aria-hidden="true"
              className={
                studioReady
                  ? styles.readyDot
                  : styles.errorDot
              }
            />

            <strong>
              {studioReady
                ? generationEnabled
                  ? "Canonical reference verified. Generation and review are ready."
                  : "Platform complete. Add the OpenAI server key for live generation."
                : "Run migrations 006 through 009 and verify the canonical cover."}
            </strong>
          </div>
        </div>

        <div className={styles.coverCard}>
          <Image
            alt="Original I AM NOBODY canonical book cover"
            className={styles.cover}
            height={
              NOBODY_BRAND
                .canonicalReference
                .height
            }
            priority
            src={
              NOBODY_BRAND
                .canonicalReference
                .publicPath
            }
            width={
              NOBODY_BRAND
                .canonicalReference
                .width
            }
          />

          <div className={styles.coverMeta}>
            <span>
              Permanent canonical reference
            </span>

            <strong>
              {
                NOBODY_BRAND
                  .canonicalReference
                  .id
              }{" "}
              · 906 × 1280
            </strong>

            <small>
              SHA-256{" "}
              {NOBODY_BRAND
                .canonicalReference
                .sha256.slice(
                  0,
                  16,
                )}
              … · automatically attached
              server-side
            </small>
          </div>
        </div>
      </section>

      <section
        aria-label="Studio overview"
        className={styles.metrics}
      >
        <article>
          <span>Generations</span>
          <strong>
            {generations.count}
          </strong>
        </article>

        <article>
          <span>Human review</span>
          <strong>
            {toReview.count}
          </strong>
        </article>

        <article>
          <span>Approved</span>
          <strong>
            {approved.count}
          </strong>
        </article>

        <article>
          <span>Published</span>
          <strong>
            {published.count}
          </strong>
        </article>
      </section>

      {!studioReady ? (
        <section className={styles.warning}>
          <h3>
            Production foundation is incomplete
          </h3>

          <p>
            Run migrations{" "}
            <code>
              006_single_private_storage.sql
            </code>{" "}
            through
            <code>
              {" "}
              009_template_and_gallery_workflow.sql
            </code>{" "}
            in order. Keep migrations
            001–005. Migration 006 removes
            the empty obsolete
            <code>
              {" "}
              nobody-public
            </code>{" "}
            bucket and leaves one private
            bucket.
          </p>
        </section>
      ) : null}

      {studioReady ? (
        <ImageGenerator
          canGenerate={
            admin.role !== "reviewer"
          }
          generationEnabled={
            generationEnabled
          }
        />
      ) : null}

      <section className={styles.modules}>
        <article className={styles.moduleCard}>
          <span>01</span>
          <h3>Artwork</h3>
          <p>
            Generate a text-free clean
            master from the permanent
            canonical reference.
          </p>
          <strong className={styles.complete}>
            Controlled
          </strong>
        </article>

        <article className={styles.moduleCard}>
          <span>02</span>
          <h3>Quality</h3>
          <p>
            Run automated visual scoring,
            then preserve the human
            creative decision.
          </p>
          <strong className={styles.complete}>
            Two-stage review
          </strong>
        </article>

        <article className={styles.moduleCard}>
          <span>03</span>
          <h3>Template</h3>
          <p>
            Add typography and output
            formats only after the clean
            artwork is approved.
          </p>
          <strong className={styles.complete}>
            Deterministic
          </strong>
        </article>

        <article className={styles.moduleCard}>
          <span>04</span>
          <h3>Gallery</h3>
          <p>
            Create a private draft,
            inspect it, and publish through
            the server-controlled route.
          </p>
          <Link
            className={styles.pending}
            href="/studio/artworks"
          >
            Open workflow
          </Link>
        </article>
      </section>
    </main>
  );
}
