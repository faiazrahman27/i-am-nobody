import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getArtworkStatusLabel,
  getNobodyArchetype,
  isNobodyArchetypeSlug,
  NOBODY_BRAND,
} from "@/lib/nobody";
import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import {
  requireStudioAdmin,
} from "@/lib/supabase/studioAccess";
import SignOutButton from "../../components/SignOutButton";
import studioStyles from "../../studio.module.css";
import styles from "../artworks.module.css";
import workflowStyles from "./workflow.module.css";
import ProductionActions from "./ProductionActions";
import ReviewActions from "./ReviewActions";

export const dynamic =
  "force-dynamic";

type VariantRow = Readonly<{
  id: string;
  artwork_code: string;
  job_id: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
  width: number;
  height: number;
  sha256: string | null;
  reference_sha256:
    string | null;
  image_model: string;
  visual_score:
    number | null;
  automated_review_status:
    string;
  automated_review_model:
    string | null;
  automated_reviewed_at:
    string | null;
  human_notes:
    string | null;
  rejection_reason:
    string | null;
  parent_variant_id:
    string | null;
  generation_attempt: number;
  created_at: string;
}>;

type JobRow = Readonly<{
  archetype_slug: string;
  quality: string;
  clothing_notes:
    string | null;
  mood_notes:
    string | null;
  prop: string | null;
  variation_direction:
    string | null;
  background_variant:
    string;
  compiled_prompt:
    string | null;
  metadata: Record<string, unknown> | null;
}>;

type QualityReviewRow =
  Readonly<{
    score: number;
    approved_for_review:
      boolean;
    hard_blockers:
      string[];
    category_scores:
      Record<
        string,
        number
      >;
    checklist: Array<{
      rule: string;
      passed: boolean;
      score: number;
      note: string;
    }>;
    issues: string[];
    recommendation:
      string;
    summary:
      string | null;
    reviewer_model:
      string;
    created_at: string;
  }>;

type RenderRow = Readonly<{
  id: string;
  template_type: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  mime_type: string;
  created_at: string;
}>;

type LineageRow = Readonly<{
  id: string;
  artwork_code: string;
  generation_attempt: number;
}>;

type GalleryRow = Readonly<{
  id: string;
  slug: string;
  status: string;
  visibility: string;
  primary_render_id:
    string | null;
}>;

type CertificateRow = Readonly<{
  certificate_code: string;
  status: string;
  issued_at: string;
  verification_hash: string;
}>;

const REVIEWABLE_STATUSES =
  new Set([
    "candidate",
    "reviewing",
    "auto_rejected",
    "auto_review_failed",
    "ready_for_review",
      "needs_regeneration",
    "wrong_mask",
    "wrong_composition",
    "too_busy",
    "too_literal",
    "too_generic",
  ]);

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function getStatusClass(
  status: string,
) {
  if (
    [
          "approved_for_template",
      "published",
    ].includes(status)
  ) {
    return styles.approved;
  }

  if (
    [
      "candidate",
      "reviewing",
      "auto_review_failed",
      "ready_for_review",
    ].includes(status)
  ) {
    return styles.review;
  }

  return styles.changes;
}



function getQualityLabel(
  value: string | undefined,
) {
  if (value === "low") return "Exploration";
  if (value === "medium") return "Refined";
  if (value === "high") return "Final";
  return "—";
}

function getReviewStatusLabel(
  value: string,
) {
  if (value === "passed") return "Ready for review";
  if (value === "failed") return "Another version recommended";
  if (value === "running") return "Reviewing";
  if (value === "error") return "Review unavailable";
  if (value === "skipped") return "Not reviewed";
  return "Waiting";
}

function humanizeKey(
  value: string,
) {
  return value
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2",
    )
    .replaceAll("_", " ")
    .replace(
      /^./,
      (character) =>
        character.toUpperCase(),
    );
}

export default async function ArtworkReviewPage({
  params,
}: Readonly<{
  params: Promise<{
    id: string;
  }>;
}>) {
  const [
    admin,
    resolvedParams,
  ] = await Promise.all([
    requireStudioAdmin(),
    params,
  ]);

  const supabase =
    createSupabaseAdminClient();

  const {
    data: variantData,
    error: variantError,
  } = await supabase
    .from("artwork_variants")
    .select(
      "id,artwork_code,job_id,status,storage_bucket,storage_path,width,height,sha256,reference_sha256,image_model,visual_score,automated_review_status,automated_review_model,automated_reviewed_at,human_notes,rejection_reason,parent_variant_id,generation_attempt,created_at",
    )
    .eq(
      "id",
      resolvedParams.id,
    )
    .maybeSingle();

  if (
    variantError ||
    !variantData
  ) {
    notFound();
  }

  const variant =
    variantData as VariantRow;

  const [
    { data: jobData },
    { data: reviewData },
    { data: renderData },
    { data: galleryData },
    { data: certificateData },
  ] = await Promise.all([
    supabase
      .from("generation_jobs")
      .select(
        "archetype_slug,quality,clothing_notes,mood_notes,prop,variation_direction,background_variant,compiled_prompt,metadata",
      )
      .eq(
        "id",
        variant.job_id,
      )
      .maybeSingle(),

    supabase
      .from("quality_reviews")
      .select(
        "score,approved_for_review,hard_blockers,category_scores,checklist,issues,recommendation,summary,reviewer_model,created_at",
      )
      .eq(
        "artwork_variant_id",
        variant.id,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("template_renders")
      .select(
        "id,template_type,status,storage_bucket,storage_path,width,height,mime_type,created_at",
      )
      .eq(
        "artwork_variant_id",
        variant.id,
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("gallery_entries")
      .select(
        "id,slug,status,visibility,primary_render_id",
      )
      .eq(
        "artwork_variant_id",
        variant.id,
      )
      .maybeSingle(),

    supabase
      .from("artwork_certificates")
      .select(
        "certificate_code,status,issued_at,verification_hash",
      )
      .eq(
        "artwork_variant_id",
        variant.id,
      )
      .maybeSingle(),
  ]);

  const job =
    jobData as JobRow | null;

  const review =
    reviewData as
      | QualityReviewRow
      | null;

  const renders =
    (renderData ?? []) as
      RenderRow[];

  const gallery =
    galleryData as
      | GalleryRow
      | null;

  const certificate =
    certificateData as
      | CertificateRow
      | null;

  const [
    { data: parentData },
    { data: childData },
  ] = await Promise.all([
    variant.parent_variant_id
      ? supabase
          .from("artwork_variants")
          .select("id,artwork_code,generation_attempt")
          .eq("id", variant.parent_variant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    supabase
      .from("artwork_variants")
      .select("id,artwork_code,generation_attempt")
      .eq("parent_variant_id", variant.id)
      .order("generation_attempt", {
        ascending: true,
      }),
  ]);

  const parentVariant =
    parentData as LineageRow | null;

  const childVariants =
    (childData ?? []) as LineageRow[];

  const archetype =
    job &&
    isNobodyArchetypeSlug(
      job.archetype_slug,
    )
      ? getNobodyArchetype(
          job.archetype_slug,
        )
      : null;

  const jobMetadata =
    job?.metadata && typeof job.metadata === "object"
      ? job.metadata
      : {};

  const metadataText = (key: string) =>
    typeof jobMetadata[key] === "string"
      ? (jobMetadata[key] as string).trim()
      : "";

  const title =
    metadataText("role_title") || archetype?.title.en || "Nobody";

  const roleFamily = metadataText("role_family");
  const lifeContext = metadataText("life_context");
  const thresholdName = metadataText("threshold_name");
  const bookTheme = metadataText("book_theme");
  const conceptQuestion = metadataText("concept_question");
  const visualStory = metadataText("visual_story");

  const [
    previewResult,
    downloadResult,
    renderPreviews,
  ] = await Promise.all([
    supabase.storage
      .from(
        variant.storage_bucket,
      )
      .createSignedUrl(
        variant.storage_path,
        60 * 60,
      ),

    supabase.storage
      .from(
        variant.storage_bucket,
      )
      .createSignedUrl(
        variant.storage_path,
        60 * 15,
        {
          download:
            `${variant.artwork_code.toLowerCase()}-clean.png`,
        },
      ),

    Promise.all(
      renders.map(
        async (render) => {
          const filename =
            render.storage_path
              .split("/")
              .pop() ||
            `${variant.artwork_code.toLowerCase()}-${render.template_type}`;

          const [preview, download] =
            await Promise.all([
              supabase.storage
                .from(render.storage_bucket)
                .createSignedUrl(
                  render.storage_path,
                  60 * 30,
                ),

              supabase.storage
                .from(render.storage_bucket)
                .createSignedUrl(
                  render.storage_path,
                  60 * 15,
                  { download: filename },
                ),
            ]);

          return {
            ...render,
            previewUrl:
              preview.data?.signedUrl ?? null,
            downloadUrl:
              download.data?.signedUrl ?? null,
          };
        },
      ),
    ),
  ]);

  return (
    <main className={styles.page}>
      <header
        className={
          studioStyles.header
        }
      >
        <div>
          <p
            className={
              studioStyles.eyebrow
            }
          >
            IMAGE STUDIO
          </p>

          <h1>I AM NOBODY</h1>
        </div>

        <div
          className={
            studioStyles.account
          }
        >
          <Link
            className={
              studioStyles.signOut
            }
            href="/studio"
          >
            Create
          </Link>

          <Link
            className={
              studioStyles.signOut
            }
            href="/studio/artworks"
          >
            Review
          </Link>

          <Link
            className={
              studioStyles.signOut
            }
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

      <div className={styles.backRow}>
        <Link href="/studio/artworks">
          ← All artworks
        </Link>
      </div>

      <section
        className={
          styles.reviewLayout
        }
      >
        <div
          className={
            styles.previewColumn
          }
        >
          <div
            className={
              workflowStyles.comparisonGrid
            }
          >
            <figure>
              <div
                className={
                  styles.largePreview
                }
              >
                <Image
                  alt="Original I AM NOBODY book cover"
                  height={
                    NOBODY_BRAND
                      .canonicalReference
                      .height
                  }
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
              </div>

              <figcaption>
                Original cover
              </figcaption>
            </figure>

            <figure>
              <div
                className={
                  styles.largePreview
                }
              >
                {previewResult.data
                  ?.signedUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    alt={`${title} cover preview`}
                    src={`/api/studio/artworks/${variant.id}/preview-cover`}
                  />
                ) : (
                  <p>
                    Preview unavailable.
                  </p>
                )}
              </div>

              <figcaption>
                Cover preview with the fixed title and layout
              </figcaption>
            </figure>
          </div>

          {downloadResult.data
            ?.signedUrl ? (
            <a
              className={
                styles.download
              }
              href={
                downloadResult
                  .data
                  .signedUrl
              }
            >
              Download artwork PNG
            </a>
          ) : null}

          {renderPreviews.length >
          0 ? (
            <section
              className={
                workflowStyles.renderLibrary
              }
            >
              <p
                className={
                  styles.eyebrow
                }
              >
                Final formats
              </p>

              <div
                className={
                  workflowStyles.renderGrid
                }
              >
                {renderPreviews.map(
                  (render) => (
                    <article
                      key={render.id}
                    >
                      {render.previewUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={humanizeKey(
                            render.template_type,
                          )}
                          src={
                            render.previewUrl
                          }
                        />
                      ) : null}

                      <div>
                        <strong>
                          {humanizeKey(
                            render.template_type,
                          )}
                        </strong>

                        <small>
                          {render.width ?? "—"} × {render.height ?? "—"}
                        </small>

                        {render.downloadUrl ? (
                          <a href={render.downloadUrl}>
                            Download
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div
          className={
            styles.detailsColumn
          }
        >
          <section
            className={
              styles.detailsPanel
            }
          >
            <div
              className={
                styles.titleRow
              }
            >
              <div>
                <p
                  className={
                    styles.eyebrow
                  }
                >
                  I AM NOBODY
                </p>

                <h2>{title}</h2>
              </div>

              <span
                className={getStatusClass(
                  variant.status,
                )}
              >
                {getArtworkStatusLabel(
                  variant.status,
                )}
              </span>
            </div>

            <dl>
              <div>
                <dt>Artwork ID</dt>
                <dd>
                  {
                    variant.artwork_code
                  }
                </dd>
              </div>

              <div>
                <dt>Created</dt>
                <dd>
                  {formatDate(
                    variant.created_at,
                  )}
                </dd>
              </div>

              <div>
                <dt>Size</dt>
                <dd>
                  {variant.width} ×{" "}
                  {variant.height}
                </dd>
              </div>

              <div>
                <dt>Version</dt>
                <dd>
                  V{String(variant.generation_attempt).padStart(2, "0")}
                </dd>
              </div>

              <div>
                <dt>Quality</dt>
                <dd>
                  {getQualityLabel(
                    job?.quality,
                  )}
                </dd>
              </div>

              <div>
                <dt>Background</dt>
                <dd>
                  {job?.background_variant
                    ? humanizeKey(job.background_variant)
                    : "—"}
                </dd>
              </div>

              {roleFamily ? (
                <div>
                  <dt>Human context</dt>
                  <dd>{roleFamily}</dd>
                </div>
              ) : null}

              {thresholdName ? (
                <div>
                  <dt>Book threshold</dt>
                  <dd>{thresholdName}</dd>
                </div>
              ) : null}

              <div>
                <dt>Created from</dt>
                <dd>
                  {parentVariant ? (
                    <Link href={`/studio/artworks/${parentVariant.id}`}>
                      {parentVariant.artwork_code}
                    </Link>
                  ) : (
                    "New artwork"
                  )}
                </dd>
              </div>

              <div>
                <dt>Guided by</dt>
                <dd>Original book cover</dd>
              </div>
            </dl>

            {parentVariant || childVariants.length > 0 ? (
              <div className={styles.brief}>
                <h3>Version history</h3>

                {parentVariant ? (
                  <p>
                    Previous version:{" "}
                    <Link href={`/studio/artworks/${parentVariant.id}`}>
                      {parentVariant.artwork_code}
                    </Link>
                  </p>
                ) : null}

                {childVariants.map((child) => (
                  <p key={child.id}>
                    Next version:{" "}
                    <Link href={`/studio/artworks/${child.id}`}>
                      {child.artwork_code}
                    </Link>
                  </p>
                ))}
              </div>
            ) : null}

            {conceptQuestion || bookTheme || lifeContext || visualStory ? (
              <div className={styles.brief}>
                <h3>AI creative direction</h3>

                {conceptQuestion ? (
                  <p>Question: {conceptQuestion}</p>
                ) : null}

                {bookTheme ? <p>Theme: {bookTheme}</p> : null}

                {lifeContext ? <p>Context: {lifeContext}</p> : null}

                {visualStory ? <p>Visual story: {visualStory}</p> : null}
              </div>
            ) : null}

            {job?.clothing_notes ||
            job?.mood_notes ||
            job?.variation_direction ||
            job?.prop ? (
              <div
                className={
                  styles.brief
                }
              >
                <h3>
                  Creative input
                </h3>

                {job.clothing_notes ? (
                  <p>
                    Clothing:{" "}
                    {
                      job.clothing_notes
                    }
                  </p>
                ) : null}

                {job.mood_notes ? (
                  <p>
                    Mood:{" "}
                    {job.mood_notes}
                  </p>
                ) : null}

                {job.variation_direction ? (
                  <p>
                    Direction:{" "}
                    {
                      job.variation_direction
                    }
                  </p>
                ) : null}

                {job.prop ? (
                  <p>
                    Prop: {job.prop}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {certificate ? (
            <section className={workflowStyles.certificatePanel}>
              <div>
                <p className={styles.eyebrow}>Official certificate</p>
                <h2>Certified artwork</h2>
              </div>

              <div className={workflowStyles.certificateCode}>
                <span>Certificate code</span>
                <strong>{certificate.certificate_code}</strong>
              </div>

              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{certificate.status}</dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{formatDate(certificate.issued_at)}</dd>
                </div>
              </dl>

              <Link
                className={workflowStyles.verifyLink}
                href={`/verify/${certificate.certificate_code}`}
                target="_blank"
              >
                Open public verification →
              </Link>
            </section>
          ) : null}

          <section
            className={
              workflowStyles.qualityPanel
            }
          >
            <div
              className={
                workflowStyles.qualityHeader
              }
            >
              <div>
                <p
                  className={
                    styles.eyebrow
                  }
                >
                  Visual review
                </p>

                <h2>
                  {review
                    ? `${review.score}/100`
                    : "No score"}
                </h2>
              </div>

              <span
                className={
                  review
                    ?.approved_for_review
                    ? styles.approved
                    : styles.changes
                }
              >
                {getReviewStatusLabel(
                  variant.automated_review_status,
                )}
              </span>
            </div>

            <p
              className={
                workflowStyles.mutedCopy
              }
            >
              {review?.summary ||
                variant.rejection_reason ||
                "Visual review is not available yet."}
            </p>

            {review ? (
              <>
                <div
                  className={
                    workflowStyles.scoreGrid
                  }
                >
                  {Object.entries(
                    review.category_scores,
                  ).map(
                    ([
                      name,
                      score,
                    ]) => (
                      <div key={name}>
                        <span>
                          {humanizeKey(
                            name,
                          )}
                        </span>

                        <strong>
                          {score}
                        </strong>
                      </div>
                    ),
                  )}
                </div>

                {review.hard_blockers
                  .length > 0 ? (
                  <div
                    className={
                      workflowStyles.issueBox
                    }
                  >
                    <h3>
                      Main issues
                    </h3>

                    <ul>
                      {review.hard_blockers.map(
                        (item) => (
                          <li key={item}>
                            {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}

                <details
                  className={
                    workflowStyles.checklist
                  }
                >
                  <summary>
                    View full review
                  </summary>

                  <ol>
                    {review.checklist.map(
                      (
                        item,
                        index,
                      ) => (
                        <li
                          key={`${index}-${item.rule}`}
                        >
                          <strong>
                            {item.passed
                              ? "Pass"
                              : "Fail"}{" "}
                            · {item.score}
                            /100
                          </strong>

                          <span>
                            {item.rule}
                          </span>

                          {item.note ? (
                            <small>
                              {
                                item.note
                              }
                            </small>
                          ) : null}
                        </li>
                      ),
                    )}
                  </ol>
                </details>
              </>
            ) : null}
          </section>

          {REVIEWABLE_STATUSES.has(
            variant.status,
          ) ? (
            <ReviewActions
              artworkId={
                variant.id
              }
              initialNotes={
                variant.human_notes ??
                ""
              }
              canRegenerate={
                admin.role !==
                "reviewer"
              }  
            />
          ) : null}

          <ProductionActions
            artworkId={variant.id}
            artworkStatus={
              variant.status
            }
            canProduce={
              admin.role !==
              "reviewer"
            }
            gallery={gallery}
          />
        </div>
      </section>
    </main>
  );
}