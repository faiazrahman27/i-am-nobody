"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateType } from "@/lib/nobody";
import styles from "../artworks.module.css";
import workflowStyles from "./workflow.module.css";

const TEMPLATE_OPTIONS: ReadonlyArray<
  Readonly<{ value: TemplateType; label: string }>
> = [
  {
    value: "book_cover",
    label: "Book cover — 906 × 1280",
  },
  {
    value: "social_4x5",
    label: "Social portrait — 1080 × 1350",
  },
  {
    value: "social_square",
    label: "Social square — 1080 × 1080",
  },
  {
    value: "story_9x16",
    label: "Story — 1080 × 1920",
  },
  {
    value: "poster",
    label: "Poster — 1359 × 1920",
  },
  {
    value: "gallery_thumbnail",
    label: "Gallery thumbnail — 453 × 640",
  },
  {
    value: "collectible_card",
    label: "Certificate card — 1359 × 1920",
  },
  {
    value: "clean_artwork",
    label: "Artwork PNG — 906 × 1280",
  },
];

type GalleryState =
  | Readonly<{
      id: string;
      slug: string;
      status: string;
      visibility: string;
      primary_render_id: string | null;
    }>
  | null;

export default function ProductionActions({
  artworkId,
  artworkStatus,
  canProduce,
  gallery,
}: Readonly<{
  artworkId: string;
  artworkStatus: string;
  canProduce: boolean;
  gallery: GalleryState;
}>) {
  const router = useRouter();

  const [templateType, setTemplateType] =
    useState<TemplateType>("book_cover");

  const [pending, setPending] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  const canRender = [
    "approved_artwork",
    "approved_for_template",
    "published",
  ].includes(artworkStatus);

  const hasDraft = Boolean(gallery);
  const isPublished =
    gallery?.status === "published";

  async function run(
    action: string,
    callback: () => Promise<Response>,
  ) {
    if (pending) {
      return;
    }

    setPending(action);
    setMessage("");
    setIsError(false);

    try {
      const response =
        await callback();

      const payload =
        (await response.json()) as Readonly<{
          ok?: boolean;
          message?: string;
        }>;

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.message ||
            "The action could not be completed.",
        );
      }

      setMessage(
        action === "render"
          ? "Format created."
          : action === "create_draft"
            ? "Gallery entry prepared."
            : action === "publish"
              ? "Artwork published."
              : "Artwork removed from the public gallery.",
      );

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    } finally {
      setPending(null);
    }
  }

  if (!canProduce) {
    return (
      <section
        className={
          workflowStyles.productionPanel
        }
      >
        <p className={styles.eyebrow}>
          Formats & publication
        </p>

        <h2>
          Finish & publish
        </h2>

        <p
          className={
            workflowStyles.mutedCopy
          }
        >
          Approval automatically prepares the certificate, book cover, gallery image, and certificate card. Owners and editors can create additional formats and manage publication.
        </p>
      </section>
    );
  }

  return (
    <section
      className={
        workflowStyles.productionPanel
      }
    >
      <p className={styles.eyebrow}>
        Final formats
      </p>

      <h2>
        Finish & publish
      </h2>

      <div
        className={
          workflowStyles.productionBlock
        }
      >
        <label
          className={
            workflowStyles.productionField
          }
        >
          <span>
            Choose a format
          </span>

          <select
            disabled={
              !canRender ||
              pending !== null
            }
            onChange={(event) =>
              setTemplateType(
                event.target
                  .value as TemplateType,
              )
            }
            value={templateType}
          >
            {TEMPLATE_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          className={
            workflowStyles.productionButton
          }
          disabled={
            !canRender ||
            pending !== null
          }
          onClick={() =>
            run(
              "render",
              () =>
                fetch(
                  `/api/studio/artworks/${artworkId}/render`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                    body:
                      JSON.stringify({
                        templateType,
                        locale: null,
                      }),
                  },
                ),
            )
          }
          type="button"
        >
          {pending === "render"
            ? "Creating…"
            : "Create format"}
        </button>

        {!canRender ? (
          <small>
            Approve the artwork before creating final formats.
          </small>
        ) : null}
      </div>

      <div
        className={
          workflowStyles.productionBlock
        }
      >
        {!hasDraft ? (
          <button
            className={
              workflowStyles.productionButtonSecondary
            }
            disabled={
              artworkStatus !==
                "approved_for_template" ||
              pending !== null
            }
            onClick={() =>
              run(
                "create_draft",
                () =>
                  fetch(
                    `/api/studio/artworks/${artworkId}/gallery`,
                    {
                      method:
                        "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body:
                        JSON.stringify({
                          action:
                            "create_draft",
                        }),
                    },
                  ),
              )
            }
            type="button"
          >
            {pending ===
            "create_draft"
              ? "Creating…"
              : "Prepare gallery entry"}
          </button>
        ) : isPublished ? (
          <button
            className={
              workflowStyles.productionButtonDanger
            }
            disabled={
              pending !== null
            }
            onClick={() =>
              run(
                "unpublish",
                () =>
                  fetch(
                    `/api/studio/artworks/${artworkId}/gallery`,
                    {
                      method:
                        "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body:
                        JSON.stringify({
                          action:
                            "unpublish",
                        }),
                    },
                  ),
              )
            }
            type="button"
          >
            {pending ===
            "unpublish"
              ? "Unpublishing…"
              : "Unpublish"}
          </button>
        ) : (
          <button
            className={
              workflowStyles.productionButton
            }
            disabled={
              pending !== null
            }
            onClick={() =>
              run(
                "publish",
                () =>
                  fetch(
                    `/api/studio/artworks/${artworkId}/gallery`,
                    {
                      method:
                        "POST",
                      headers: {
                        "Content-Type":
                          "application/json",
                      },
                      body:
                        JSON.stringify({
                          action:
                            "publish",
                        }),
                    },
                  ),
              )
            }
            type="button"
          >
            {pending === "publish"
              ? "Publishing…"
              : "Publish to gallery"}
          </button>
        )}

        {gallery ? (
          <small>
            Gallery entry: {gallery.slug}
          </small>
        ) : (
          <small>
            Create the Book cover format first, then prepare the gallery entry.
          </small>
        )}
      </div>

      {message ? (
        <p
          className={
            isError
              ? styles.messageError
              : styles.messageSuccess
          }
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}