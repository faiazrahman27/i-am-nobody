import Link from "next/link";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import styles from "./gallery.module.css";
import CertificateLookup from "./CertificateLookup";

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
  artwork_variant_id: string;
  certificateCode?: string | null;
}>;

export default async function GalleryPage() {
  const supabase =
    createSupabaseAdminClient();

  const { data } = await supabase
    .from("gallery_entries")
    .select(
      "id,slug,title_en,title_it,description_en,description_it,archetype_slug,featured,published_at,artwork_variant_id",
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

  const rawEntries =
    (data ?? []) as GalleryEntry[];

  const artworkIds = rawEntries.map(
    (entry) => entry.artwork_variant_id,
  );

  let certificateByArtwork = new Map<string, string>();

  if (artworkIds.length > 0) {
    const { data: certificates } = await supabase
      .from("artwork_certificates")
      .select("artwork_variant_id,certificate_code")
      .eq("status", "valid")
      .in("artwork_variant_id", artworkIds);

    certificateByArtwork = new Map(
      (certificates ?? []).map((certificate) => [
        certificate.artwork_variant_id,
        certificate.certificate_code,
      ]),
    );
  }

  const entries = rawEntries
    .map((entry) => ({
      ...entry,
      certificateCode:
        certificateByArtwork.get(entry.artwork_variant_id) ?? null,
    }))
    .filter((entry) => Boolean(entry.certificateCode));

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

      <section className={styles.verification} id="verify">
        <div>
          <p>Official verification</p>
          <h2>Verify an artwork.</h2>
        </div>
        <div>
          <p>
            Every approved I AM NOBODY artwork receives a permanent certificate.
            Enter its code to confirm the approved file, canonical origin, and
            certificate status.
          </p>
          <CertificateLookup />
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

                  {entry.certificateCode ? (
                    <Link
                      className={styles.certificateLink}
                      href={`/verify/${entry.certificateCode}`}
                    >
                      <span>Certificate</span>
                      <strong>{entry.certificateCode}</strong>
                    </Link>
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