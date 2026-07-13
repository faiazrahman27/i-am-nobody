import Image from "next/image";
import Link from "next/link";
import { NOBODY_BRAND } from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import ImageGenerator from "./components/ImageGenerator";
import SignOutButton from "./components/SignOutButton";
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

  let query = supabase
    .from(table)
    .select("*", {
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
  const supabase = createSupabaseAdminClient();

  const [generations, toReview, approved, published, privateBucket] =
    await Promise.all([
      countRows("generation_jobs"),
      countRows("artwork_variants", ["candidate", "ready_for_review"]),
      countRows("artwork_variants", [
        "approved_artwork",
        "approved_for_template",
        "published",
      ]),
      countRows("gallery_entries", ["published"]),
      supabase.storage.getBucket("nobody-private"),
    ]);

  const databaseReady = [generations, toReview, approved, published].every(
    (result) => !result.error,
  );

  const storageReady = Boolean(privateBucket.data) && !privateBucket.error;
  const generationEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>IMAGE STUDIO</p>
          <h1>I AM NOBODY</h1>
        </div>

        <div className={styles.account}>
          <Link className={styles.signOut} href="/studio">
            Create
          </Link>

          <Link className={styles.signOut} href="/studio/artworks">
            Review
          </Link>

          <div>
            <span>{admin.displayName || admin.email}</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Official artwork variations</p>

          <h2>One identity. Many masks.</h2>

          <p>
            Create new I AM NOBODY characters while preserving the original
            cover, typography, composition, and visual language.
          </p>

          <div className={styles.statusLine}>
            <span
              aria-hidden="true"
              className={
                databaseReady && storageReady ? styles.readyDot : styles.errorDot
              }
            />

            <strong>
              {databaseReady && storageReady
                ? generationEnabled
                  ? "Ready to create"
                  : "The studio is ready. Image generation will be connected later."
                : "One setup step is still missing."}
            </strong>
          </div>
        </div>

        <div className={styles.coverCard}>
          <Image
            alt="Original I AM NOBODY book cover"
            className={styles.cover}
            height={NOBODY_BRAND.canonicalReference.height}
            priority
            src={NOBODY_BRAND.canonicalReference.publicPath}
            width={NOBODY_BRAND.canonicalReference.width}
          />

          <div className={styles.coverMeta}>
            <span>Original cover</span>
            <strong>906 × 1280</strong>
          </div>
        </div>
      </section>

      <section aria-label="Studio overview" className={styles.metrics}>
        <article>
          <span>Generations</span>
          <strong>{generations.count}</strong>
        </article>

        <article>
          <span>To review</span>
          <strong>{toReview.count}</strong>
        </article>

        <article>
          <span>Approved</span>
          <strong>{approved.count}</strong>
        </article>

        <article>
          <span>Published</span>
          <strong>{published.count}</strong>
        </article>
      </section>

      {!storageReady ? (
        <section className={styles.warning}>
          <h3>Artwork storage is not ready</h3>

          <p>
            Run migration 005 once in Supabase. It creates the private space
            where generated covers are saved and displayed inside this studio.
          </p>
        </section>
      ) : null}

      {databaseReady && storageReady ? (
        <ImageGenerator
          canGenerate={admin.role !== "reviewer"}
          generationEnabled={generationEnabled}
        />
      ) : null}

      <section className={styles.modules}>
        <article className={styles.moduleCard}>
          <span>01</span>
          <h3>Create</h3>
          <p>Choose an archetype, clothing direction, and one subtle detail.</p>
          <strong className={styles.complete}>Available</strong>
        </article>

        <article className={styles.moduleCard}>
          <span>02</span>
          <h3>Review</h3>
          <p>View every saved image at full size and compare the variations.</p>
          <strong className={styles.complete}>Available</strong>
        </article>

        <article className={styles.moduleCard}>
          <span>03</span>
          <h3>Choose</h3>
          <p>Approve an artwork or leave clear notes for another version.</p>
          <strong className={styles.complete}>Available</strong>
        </article>

        <article className={styles.moduleCard}>
          <span>04</span>
          <h3>Publish</h3>
          <p>Only selected artworks will move to the public gallery later.</p>
          <Link className={styles.pending} href="/studio/artworks">
            Open review
          </Link>
        </article>
      </section>
    </main>
  );
}
