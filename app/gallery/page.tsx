import Link from "next/link";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import styles from "./gallery.module.css";

export const dynamic =
  "force-dynamic";

type GalleryEntry = Readonly<{
  id: string;
  slug: string;
  title_en: string;
  title_it: string;
  description_en:
    string | null;
  description_it:
    string | null;
  archetype_slug: string;
  featured: boolean;
  published_at: string;
}>;

export default async function GalleryPage() {
  const supabase =
    createSupabaseAdminClient();

  const { data } = await supabase
    .from("gallery_entries")
    .select(
      "id,slug,title_en,title_it,description_en,description_it,archetype_slug,featured,published_at",
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .not(
      "published_at",
      "is",
      null,
    )
    .order("featured", {
      ascending: false,
    })
    .order("display_order", {
      ascending: true,
    })
    .order("published_at", {
      ascending: false,
    });

  const entries =
    (data ?? []) as GalleryEntry[];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">
          I AM NOBODY
        </Link>

        <span>
          OFFICIAL GALLERY
        </span>
      </header>

      <section className={styles.hero}>
        <p>
          Who are you when nobody is
          watching?
        </p>

        <h1>THE MASKS</h1>

        <div>
          Each image begins with the same
          anonymous presence. Clothing
          changes. The role changes.
          Nobody remains.
        </div>
      </section>

      {entries.length === 0 ? (
        <section className={styles.empty}>
          <h2>
            The gallery is being
            composed.
          </h2>

          <p>
            Approved artworks will appear
            here only after human
            publication.
          </p>
        </section>
      ) : (
        <section className={styles.grid}>
          {entries.map(
            (entry, index) => (
              <article
                className={styles.card}
                key={entry.id}
              >
                <div
                  className={
                    styles.imageFrame
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={entry.title_en}
                    loading={
                      index < 4
                        ? "eager"
                        : "lazy"
                    }
                    src={`/api/gallery/image/${entry.slug}`}
                  />
                </div>

                <div
                  className={
                    styles.cardText
                  }
                >
                  <span>
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}
                  </span>

                  <h2>
                    {entry.title_en}
                  </h2>

                  {entry.description_en ? (
                    <p>
                      {
                        entry.description_en
                      }
                    </p>
                  ) : null}
                </div>
              </article>
            ),
          )}
        </section>
      )}

      <footer className={styles.footer}>
        <span>I AM NOBODY</span>

        <span>
          The artwork is the image.
          Certification remains a
          separate layer.
        </span>
      </footer>
    </main>
  );
}