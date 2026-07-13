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

type GalleryRow = Readonly<{
  id: string;
  slug: string;
  status: string;
  visibility: string;
  primary_render_id:
    string | null;
}>;

const REVIEWABLE_STATUSES =
  new Set([
    "candidate",
    "reviewing",
    "auto_rejected",
    "auto_review_failed",
    "ready_for_review",
    "approved_artwork",
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
      "approved_artwork",
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
      "id,artwork_code,job_id,status,storage_bucket,storage_path,width,height,sha256,reference_sha256,image_model,visual_score,automated_review_status,automated_review_model,automated_reviewed_at,human_notes,rejection_reason,created_at",
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
  ] = await Promise.all([
    supabase
      .from("generation_jobs")
      .select(
        "archetype_slug,quality,clothing_notes,mood_notes,prop,variation_direction,background_variant,compiled_prompt",
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

  const archetype =
    job &&
    isNobodyArchetypeSlug(
      job.archetype_slug,
    )
      ? getNobodyArchetype(
          job.archetype_slug,
        )
      : null;

  const title =
    archetype?.title.en ??
    "Nobody";

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
          const { data } =
            await supabase.storage
              .from(
                render.storage_bucket,
              )
              .createSignedUrl(
                render.storage_path,
                60 * 30,
              );

          return {
            ...render,
            previewUrl:
              data?.signedUrl ??
              null,
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
                  alt="Canonical I AM NOBODY book cover"
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
                Canonical reference
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
                    alt={`${title} clean artwork`}
                    src={
                      previewResult
                        .data
                        .signedUrl
                    }
                  />
                ) : (
                  <p>
                    Preview unavailable.
                  </p>
                )}
              </div>

              <figcaption>
                Generated clean master
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
              Download clean master PNG
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
                Controlled derivatives
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
                          {render.width ??
                            "—"}{" "}
                          ×{" "}
                          {render.height ??
                            "—"}{" "}
                          · {render.status}
                        </small>
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
                <dt>Clean master</dt>
                <dd>
                  {variant.width} ×{" "}
                  {variant.height}
                </dd>
              </div>

              <div>
                <dt>Model</dt>
                <dd>
                  {variant.image_model}
                </dd>
              </div>

              <div>
                <dt>Finish</dt>
                <dd>
                  {job?.quality ??
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Background</dt>
                <dd>
                  {job
                    ?.background_variant ??
                    "—"}
                </dd>
              </div>

              <div>
                <dt>
                  Reference integrity
                </dt>

                <dd>
                  {variant.reference_sha256 ===
                  NOBODY_BRAND
                    .canonicalReference
                    .sha256
                    ? "Verified"
                    : "Mismatch"}
                </dd>
              </div>

              <div>
                <dt>Master hash</dt>

                <dd>
                  {variant.sha256
                    ? `${variant.sha256.slice(
                        0,
                        16,
                      )}…`
                    : "—"}
                </dd>
              </div>
            </dl>

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
                    Variation:{" "}
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
                  Automated quality
                  control
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
                {
                  variant.automated_review_status
                }
              </span>
            </div>

            <p
              className={
                workflowStyles.mutedCopy
              }
            >
              {review?.summary ||
                variant.rejection_reason ||
                "The automated reviewer did not return a report."}
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
                      Hard blockers
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
                    Open full quality
                    checklist
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