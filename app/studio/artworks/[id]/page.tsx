import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getArtworkStatusLabel,
  getNobodyArchetype,
  isNobodyArchetypeSlug,
} from "@/lib/nobody";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStudioAdmin } from "@/lib/supabase/studioAccess";
import SignOutButton from "../../components/SignOutButton";
import studioStyles from "../../studio.module.css";
import styles from "../artworks.module.css";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

type VariantRow = Readonly<{
  id: string;
  job_id: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
  width: number;
  height: number;
  human_notes: string | null;
  created_at: string;
}>;

type JobRow = Readonly<{
  archetype_slug: string;
  quality: string;
  clothing_notes: string | null;
  prop: string | null;
  variation_direction: string | null;
}>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export default async function ArtworkReviewPage({
  params,
}: Readonly<{
  params: Promise<{
    id: string;
  }>;
}>) {
  const [admin, resolvedParams] = await Promise.all([requireStudioAdmin(), params]);
  const supabase = createSupabaseAdminClient();

  const { data: variantData, error: variantError } = await supabase
    .from("artwork_variants")
    .select(
      "id,job_id,status,storage_bucket,storage_path,width,height,human_notes,created_at",
    )
    .eq("id", resolvedParams.id)
    .maybeSingle();

  if (variantError || !variantData) {
    notFound();
  }

  const variant = variantData as VariantRow;

  const { data: jobData } = await supabase
    .from("generation_jobs")
    .select("archetype_slug,quality,clothing_notes,prop,variation_direction")
    .eq("id", variant.job_id)
    .maybeSingle();

  const job = jobData as JobRow | null;

  const title =
    job && isNobodyArchetypeSlug(job.archetype_slug)
      ? getNobodyArchetype(job.archetype_slug).title.en
      : "Nobody";

  const [previewResult, downloadResult] = await Promise.all([
    supabase.storage
      .from(variant.storage_bucket)
      .createSignedUrl(variant.storage_path, 60 * 60),

    supabase.storage
      .from(variant.storage_bucket)
      .createSignedUrl(variant.storage_path, 60 * 15, {
        download: `${title.replaceAll(" ", "-").toLowerCase()}.png`,
      }),
  ]);

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

      <div className={styles.backRow}>
        <Link href="/studio/artworks">← All artworks</Link>
      </div>

      <section className={styles.reviewLayout}>
        <div className={styles.previewColumn}>
          <div className={styles.largePreview}>
            {previewResult.data?.signedUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={title} src={previewResult.data.signedUrl} />
              </>
            ) : (
              <p>Preview unavailable.</p>
            )}
          </div>

          {downloadResult.data?.signedUrl ? (
            <a className={styles.download} href={downloadResult.data.signedUrl}>
              Download full-size PNG
            </a>
          ) : null}
        </div>

        <div className={styles.detailsColumn}>
          <section className={styles.detailsPanel}>
            <div className={styles.titleRow}>
              <div>
                <p className={styles.eyebrow}>I AM NOBODY</p>
                <h2>{title}</h2>
              </div>

              <span className={getStatusClass(variant.status)}>
                {getArtworkStatusLabel(variant.status)}
              </span>
            </div>

            <dl>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(variant.created_at)}</dd>
              </div>

              <div>
                <dt>Size</dt>
                <dd>
                  {variant.width} × {variant.height}
                </dd>
              </div>

              {job?.quality ? (
                <div>
                  <dt>Finish</dt>
                  <dd>
                    {job.quality === "high"
                      ? "Final"
                      : job.quality === "medium"
                        ? "Standard"
                        : "Draft"}
                  </dd>
                </div>
              ) : null}

              {job?.prop ? (
                <div>
                  <dt>Detail</dt>
                  <dd>{job.prop}</dd>
                </div>
              ) : null}
            </dl>

            {job?.clothing_notes || job?.variation_direction ? (
              <div className={styles.brief}>
                <h3>Creative notes</h3>

                {job.clothing_notes ? <p>{job.clothing_notes}</p> : null}
                {job.variation_direction ? <p>{job.variation_direction}</p> : null}
              </div>
            ) : null}
          </section>

          <ReviewActions artworkId={variant.id} initialNotes={variant.human_notes ?? ""} />
        </div>
      </section>
    </main>
  );
}
