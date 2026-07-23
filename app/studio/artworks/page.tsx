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

type ArtworkFilter = "all" | "review" | "approved" | "changes" | "published";

type VariantRow = Readonly<{
  id: string;
  job_id: string;
  status: string;
  storage_path: string;
  thumbnail_storage_path: string | null;
  width: number;
  height: number;
  visual_score: number | null;
  automated_review_status: string;
  created_at: string;
}>;

type JobRow = Readonly<{
  id: string;
  archetype_slug: string;
  metadata: Record<string, unknown> | null;
}>;

const FILTERS: ReadonlyArray<
  Readonly<{
    value: ArtworkFilter;
    label: string;
  }>
> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "review",
    label: "Human review",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "changes",
    label: "Needs changes",
  },
  {
    value: "published",
    label: "Published",
  },
];

function normalizeFilter(value: string | undefined): ArtworkFilter {
  if (
    value === "review" ||
    value === "approved" ||
    value === "changes" ||
    value === "published"
  ) {
    return value;
  }

  return "all";
}

function statusMatchesFilter(status: string, filter: ArtworkFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "review") {
    return [
      "candidate",
      "reviewing",
      "auto_rejected",
      "auto_review_failed",
      "ready_for_review",
    ].includes(status);
  }

  if (filter === "approved") {
    return ["approved_artwork", "approved_for_template"].includes(status);
  }

  if (filter === "published") {
    return status === "published";
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
  if (
    ["approved_artwork", "approved_for_template", "published"].includes(status)
  ) {
    return styles.approved;
  }

  if (
    [
      "candidate",
      "reviewing",
      "auto_rejected",
      "auto_review_failed",
      "ready_for_review",
    ].includes(status)
  ) {
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
      "id,job_id,status,storage_path,thumbnail_storage_path,width,height,visual_score,automated_review_status,created_at",
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
      .select("id,archetype_slug,metadata")
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

      const metadata =
        job?.metadata && typeof job.metadata === "object" ? job.metadata : {};

      const plannedTitle =
        typeof metadata.role_title === "string"
          ? metadata.role_title.trim()
          : "";

      const title =
        plannedTitle ||
        (job && isNobodyArchetypeSlug(job.archetype_slug)
          ? getNobodyArchetype(job.archetype_slug).title.en
          : "Nobody");

      const previewPath =
        variant.thumbnail_storage_path || variant.storage_path;

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

          <Link className={studioStyles.signOut} href="/gallery">
            Gallery
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

          <h2>Review the artworks</h2>

          <p>
            Review each artwork, approve the strongest version, create the final
            formats you need, and choose when it is ready for the public
            gallery.
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
            className={
              activeFilter === filter.value ? styles.activeFilter : undefined
            }
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
          <h2>The artwork library is not available.</h2>
          <p>
            The studio archive could not be loaded. Please check the studio
            setup and try again.
          </p>
        </section>
      ) : cards.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No artworks in this view.</h2>
          <p>New artworks will appear here after creation and visual review.</p>
        </section>
      ) : (
        <section aria-label="Saved artworks" className={styles.grid}>
          {cards.map((card) => (
            <article className={styles.card} key={card.id}>
              <Link
                className={styles.imageFrame}
                href={`/studio/artworks/${card.id}`}
              >
                {card.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img alt={card.title} src={card.imageUrl} />
                ) : (
                  <span>Preview unavailable</span>
                )}
              </Link>

              <div className={styles.cardBody}>
                <div>
                  <h3>{card.title}</h3>

                  <p>{formatDate(card.created_at)}</p>

                  {card.visual_score !== null ? (
                    <p>
                      Visual score {card.visual_score}
                      /100
                    </p>
                  ) : null}
                </div>

                <span className={getStatusClass(card.status)}>
                  {getArtworkStatusLabel(card.status)}
                </span>
              </div>

              <div className={styles.cardFooter}>
                <small>
                  {card.width} × {card.height} · artwork
                </small>

                <Link href={`/studio/artworks/${card.id}`}>Open</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
