import Image from "next/image";
import { NOBODY_BRAND } from "@/lib/nobody";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import SignOutButton from "./components/SignOutButton";
import styles from "./studio.module.css";

export const dynamic = "force-dynamic";

type CountResult = Readonly<{
  count: number;
  error: string | null;
}>;

async function countRows(table: string): Promise<CountResult> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  return {
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

async function countApprovedArtworks(): Promise<CountResult> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("artwork_variants")
    .select("*", { count: "exact", head: true })
    .in("status", [
      "approved_artwork",
      "approved_for_template",
      "published",
    ]);

  return {
    count: count ?? 0,
    error: error?.message ?? null,
  };
}

export default async function StudioHomePage() {
  const admin = await requireStudioAdmin();

  const [jobs, variants, approved, gallery] = await Promise.all([
    countRows("generation_jobs"),
    countRows("artwork_variants"),
    countApprovedArtworks(),
    countRows("gallery_entries"),
  ]);

  const databaseReady = [jobs, variants, approved, gallery].every(
    (result) => !result.error,
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PRIVATE IMAGE STUDIO</p>
          <h1>I AM NOBODY</h1>
        </div>

        <div className={styles.account}>
          <div>
            <span>{admin.displayName || admin.email}</span>
            <small>{admin.role}</small>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Foundation status</p>
          <h2>Same Nobody. Different social mask.</h2>
          <p>
            The canonical cover is locked, the controlled archetype system is
            installed, and the private studio database is connected. The next
            module will add prompt preview and image-generation jobs without
            changing the public website.
          </p>

          <div className={styles.statusLine}>
            <span
              className={databaseReady ? styles.readyDot : styles.errorDot}
              aria-hidden="true"
            />
            <strong>
              {databaseReady
                ? "Database and row-level security are reachable"
                : "Database migration or environment configuration is incomplete"}
            </strong>
          </div>
        </div>

        <div className={styles.coverCard}>
          <Image
            alt="Canonical I AM NOBODY book cover"
            className={styles.cover}
            height={NOBODY_BRAND.canonicalReference.height}
            priority
            src={NOBODY_BRAND.canonicalReference.publicPath}
            width={NOBODY_BRAND.canonicalReference.width}
          />
          <div className={styles.coverMeta}>
            <span>Canonical reference</span>
            <strong>{NOBODY_BRAND.canonicalReference.id}</strong>
            <small>
              {NOBODY_BRAND.canonicalReference.width} ×{" "}
              {NOBODY_BRAND.canonicalReference.height}
            </small>
          </div>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Studio metrics">
        <article>
          <span>Generation jobs</span>
          <strong>{jobs.count}</strong>
        </article>
        <article>
          <span>Artwork variants</span>
          <strong>{variants.count}</strong>
        </article>
        <article>
          <span>Approved artworks</span>
          <strong>{approved.count}</strong>
        </article>
        <article>
          <span>Gallery entries</span>
          <strong>{gallery.count}</strong>
        </article>
      </section>

      {!databaseReady ? (
        <section className={styles.warning}>
          <h3>Setup required</h3>
          <p>
            Run the first Supabase migration, create the private admin user,
            insert that user into <code>studio_admins</code>, and add the three
            Supabase environment variables locally and in Vercel.
          </p>
        </section>
      ) : null}

      <section className={styles.modules}>
        <article className={styles.moduleCard}>
          <span>01</span>
          <h3>Brand control</h3>
          <p>
            Canonical cover checksum, ratio, composition, mask rules,
            archetypes, and rejection criteria.
          </p>
          <strong className={styles.complete}>Installed</strong>
        </article>

        <article className={styles.moduleCard}>
          <span>02</span>
          <h3>Secure foundation</h3>
          <p>
            Private authentication, admin roles, database tables, storage
            buckets, and row-level security.
          </p>
          <strong className={databaseReady ? styles.complete : styles.pending}>
            {databaseReady ? "Installed" : "Awaiting setup"}
          </strong>
        </article>

        <article className={styles.moduleCard}>
          <span>03</span>
          <h3>Prompt and generation</h3>
          <p>
            Controlled job creation, prompt preview, reference-image input,
            model calls, cost limits, and raw output storage.
          </p>
          <strong className={styles.pending}>Next</strong>
        </article>

        <article className={styles.moduleCard}>
          <span>04</span>
          <h3>Review and publication</h3>
          <p>
            Automated visual checks, human approval, deterministic templates,
            and public gallery publishing.
          </p>
          <strong className={styles.pending}>Planned</strong>
        </article>
      </section>
    </main>
  );
}