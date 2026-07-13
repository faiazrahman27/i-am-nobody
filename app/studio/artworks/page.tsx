import Link from "next/link";
import {
  getArtworkStatusLabel,
  getNobodyArchetype,
  isNobodyArchetypeSlug,
} from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import SignOutButton from "../components/SignOutButton";
import studioStyles from "../studio.module.css";
import styles from "./artworks.module.css";

export const dynamic = "force-dynamic";

type ArtworkFilter = "all" | "review" | "approved" | "changes";

type VariantRow = Readonly<{
  id: string;
  job_id: string;
  status: string;
  storage_path: string;
  thumbnail_storage_path: string | null;
  width: number;
  height: number;
  created_at: string;
}>;

type JobRow = Readonly<{
  id: string;
  archetype_slug: string;
}>;

const FILTERS: ReadonlyArray<
  Readonly<{
    value: ArtworkFilter;
    label: string;
  }>
> = [
  { value: "all", label: "All" },
  { value: "review", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "changes", label: "Needs changes" },
];

function normalizeFilter(value: string | undefined): ArtworkFilter {
  if (value === "review" || value === "approved" || value === "changes") {
    return value;
  }

  return "all";
}

function statusMatchesFilter(status: string, filter: ArtworkFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "review") {
    return status === "candidate" || status === "ready_for_review";
  }

  if (filter === "approved") {
    return ["approved_artwork", "approved_for_template", "published"].includes(
      status,
    );
  }

  return [
    "auto_rejected",
    "needs_regeneration",
    "wrong_mask",
    "wrong_composition",
    "too_busy",
    "too_literal",
    "too_generic",
  ].includes(status);
}

function getStatusClass(status: string) {
  if (["approved_artwork", "approved_for_template", "published"].includes(status)) {
    return styles.approved;
  }

  if (status === "candidate" || status === "ready_for_review") {
    return styles.review;
  }

  return styles.changes;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ArtworksPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    filter?: string;
  }>;
}>) {
  const [admin, params] = await Promise.all([
    requireStudioAdmin(),
    searchParams,
  ]);

  const activeFilter = normalizeFilter(params.filter);
  const supabase = createSupabaseAdminClient();

  const { data: variantData, error: variantError } = await supabase
    .from("artwork_variants")
    .select(
      "id,job_id,status,storage_path,thumbnail_storage_path,width,height,created_at",
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  const variants = (variantData ?? []) as VariantRow[];

  const jobIds = Array.from(new Set(variants.map((item) => item.job_id)));

  let jobs: JobRow[] = [];

  if (jobIds.length > 0) {
    const { data: jobData } = await supabase
      .from("generation_jobs")
      .select("id,archetype_slug")
      .in("id", jobIds);

    jobs = (jobData ?? []) as JobRow[];
  }

  const jobsById = new Map(jobs.map((item) => [item.id, item]));

  const filteredVariants = variants.filter((item) =>
    statusMatchesFilter(item.status, activeFilter),
  );

  const cards = await Promise.all(
    filteredVariants.map(async (variant) => {
      const job = jobsById.get(variant.job_id);

      const title =
        job && isNobodyArchetypeSlug(job.archetype_slug)
          ? getNobodyArchetype(job.archetype_slug).title.en
          : "Nobody";

      const previewPath = variant.thumbnail_storage_path || variant.storage_path;

      const { data: signed } = await supabase.storage
        .from("nobody-private")
        .createSignedUrl(previewPath, 60 * 15);

      return {
        ...variant,
        title,
        imageUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return (
    <main className={styles.page}>
      <header className={studioStyles.header}>
        <div>
          <p className={studioStyles.eyebrow}>IMAGE STUDIO</p>
          <h1>I AM NOBODY</h1>
        </div>

        <div className={studioStyles.account}>
          <Link className={studioStyles.signOut} href="/studio">
            Create
          </Link>

          <Link className={studioStyles.signOut} href="/studio/artworks">
            Review
          </Link>

          <div>
            <span>{admin.displayName || admin.email}</span>
          </div>

          <SignOutButton />
        </div>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Artwork selection</p>
          <h2>Review the masks</h2>

          <p>
            Every generated cover stays private here until it is approved. Open
            an artwork to view it at full size, add notes, approve it, or request
            another version.
          </p>
        </div>

        <Link className={styles.primaryLink} href="/studio">
          Create new artwork
        </Link>
      </section>

      <nav aria-label="Artwork filters" className={styles.filters}>
        {FILTERS.map((filter) => (
          <Link
            aria-current={activeFilter === filter.value ? "page" : undefined}
            className={activeFilter === filter.value ? styles.activeFilter : undefined}
            href={
              filter.value === "all"
                ? "/studio/artworks"
                : `/studio/artworks?filter=${filter.value}`
            }
            key={filter.value}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {variantError ? (
        <section className={styles.emptyState}>
          <h2>The artwork library is not available yet.</h2>
          <p>
            The studio could not open the saved artworks. Check the private
            artwork storage setup.
          </p>
        </section>
      ) : cards.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No artworks here yet.</h2>
          <p>
            Generated images will appear here automatically after the image
            service is connected and the first artwork is created.
          </p>
        </section>
      ) : (
        <section aria-label="Saved artworks" className={styles.grid}>
          {cards.map((card) => (
            <article className={styles.card} key={card.id}>
              <Link className={styles.imageFrame} href={`/studio/artworks/${card.id}`}>
                {card.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={card.title} src={card.imageUrl} />
                  </>
                ) : (
                  <span>Preview unavailable</span>
                )}
              </Link>

              <div className={styles.cardBody}>
                <div>
                  <h3>{card.title}</h3>
                  <p>{formatDate(card.created_at)}</p>
                </div>

                <span className={getStatusClass(card.status)}>
                  {getArtworkStatusLabel(card.status)}
                </span>
              </div>

              <div className={styles.cardFooter}>
                <small>
                  {card.width} × {card.height}
                </small>

                <Link href={`/studio/artworks/${card.id}`}>Review</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
