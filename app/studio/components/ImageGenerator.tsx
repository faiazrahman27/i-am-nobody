"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  NOBODY_ARCHETYPES,
  NOBODY_BACKGROUND_VARIANTS,
  NOBODY_BRAND,
  getArtworkStatusLabel,
} from "@/lib/nobody";
import type {
  ArchetypeSlug,
  BackgroundVariantSlug,
  ImageQuality,
} from "@/lib/nobody";
import styles from "./image-generator.module.css";

type GeneratedVariant =
  Readonly<{
    id: string;
    artworkCode: string;
    status: string;
    imageUrl: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    sha256: string;
    visualScore:
      number | null;
    reviewSummary:
      string | null;
  }>;

type GenerateSuccess =
  Readonly<{
    ok: true;
    jobId: string;
    model: string;
    quality: ImageQuality;
    canonicalSize: string;
    referenceId: string;
    referenceSha256: string;
    variants:
      readonly GeneratedVariant[];
  }>;

type GenerateFailure =
  Readonly<{
    ok: false;
    error: string;
    message?: string;
    issues?: ReadonlyArray<
      Readonly<{
        message: string;
      }>
    >;
  }>;

export default function ImageGenerator({
  canGenerate,
  generationEnabled,
}: Readonly<{
  canGenerate: boolean;
  generationEnabled: boolean;
}>) {
  const router = useRouter();

  const [
    archetype,
    setArchetype,
  ] = useState<ArchetypeSlug>(
    "nobody-classic",
  );

  const [
    backgroundVariant,
    setBackgroundVariant,
  ] =
    useState<BackgroundVariantSlug>(
      "canonical-taupe",
    );

  const [
    clothingNotes,
    setClothingNotes,
  ] = useState("");

  const [
    moodNotes,
    setMoodNotes,
  ] = useState("");

  const [
    creativeNote,
    setCreativeNote,
  ] = useState("");

  const [prop, setProp] =
    useState("");

  const [
    quality,
    setQuality,
  ] = useState<ImageQuality>(
    "low",
  );

  const [
    numberOfVariations,
    setNumberOfVariations,
  ] = useState(1);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<GenerateSuccess | null>(
      null,
    );

  const selectedArchetype =
    useMemo(
      () =>
        NOBODY_ARCHETYPES.find(
          (item) =>
            item.slug === archetype,
        ) ??
        NOBODY_ARCHETYPES[0],
      [archetype],
    );

  function handleArchetypeChange(
    value: ArchetypeSlug,
  ) {
    setArchetype(value);
    setProp("");
    setError("");
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !canGenerate ||
      !generationEnabled ||
      isGenerating
    ) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/studio/generate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              archetype,
              backgroundVariant,
              clothingNotes,
              moodNotes,
              variationDirection:
                creativeNote,
              prop:
                prop || null,
              quality,
              numberOfVariations,
            }),
          },
        );

      const payload =
        (await response.json()) as
          | GenerateSuccess
          | GenerateFailure;

      if (
        !response.ok ||
        !payload.ok
      ) {
        const issueText =
          !payload.ok &&
          payload.issues?.length
            ? payload.issues
                .map(
                  (issue) =>
                    issue.message,
                )
                .join(" ")
            : "";

        throw new Error(
          (!payload.ok &&
            payload.message) ||
            issueText ||
            "The artwork could not be created.",
        );
      }

      setResult(payload);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The artwork could not be created.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const disabled =
    !canGenerate ||
    !generationEnabled ||
    isGenerating;

  return (
    <section
      aria-labelledby="generator-title"
      className={styles.section}
    >
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>
            New artwork
          </p>

          <h2 id="generator-title">
            Create the next mask
          </h2>
        </div>

        <div className={styles.scopeLock}>
          <span>
            Original cover ratio
          </span>

          <strong>
            {
              NOBODY_BRAND
                .generationCanvas
                .size
            }
          </strong>
        </div>
      </div>

      <div className={styles.scopeNotice}>
        The original book cover guides the composition, posture, mask, light,
        and atmosphere of every generation. Each result begins as an artwork
        without text. After approval, this studio can create the finished book
        cover, social, story, poster, and gallery versions.
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
      >
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Archetype</span>

            <select
              disabled={isGenerating}
              onChange={(event) =>
                handleArchetypeChange(
                  event.target
                    .value as ArchetypeSlug,
                )
              }
              value={archetype}
            >
              {NOBODY_ARCHETYPES
                .filter(
                  (item) =>
                    item.active,
                )
                .map((item) => (
                  <option
                    key={item.slug}
                    value={item.slug}
                  >
                    {item.title.en}
                  </option>
                ))}
            </select>

            <small>
              {
                selectedArchetype
                  .description.en
              }
            </small>
          </label>

          <label className={styles.field}>
            <span>Background</span>

            <select
              disabled={isGenerating}
              onChange={(event) =>
                setBackgroundVariant(
                  event.target
                    .value as BackgroundVariantSlug,
                )
              }
              value={
                backgroundVariant
              }
            >
              {Object.values(
                NOBODY_BACKGROUND_VARIANTS,
              ).map((item) => (
                <option
                  key={item.slug}
                  value={item.slug}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <small>
              Warm, neutral studio backgrounds that remain faithful to the visual universe.
            </small>
          </label>

          <label className={styles.field}>
            <span>
              Optional object
            </span>

            <select
              disabled={
                isGenerating ||
                selectedArchetype
                  .permittedProps
                  .length === 0
              }
              onChange={(event) =>
                setProp(
                  event.target.value,
                )
              }
              value={prop}
            >
              <option value="">
                None
              </option>

              {selectedArchetype
                .permittedProps
                .map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
            </select>

            <small>
              Use no more than one subtle symbolic object.
            </small>
          </label>

          <label className={styles.field}>
            <span>Image quality</span>

            <select
              disabled={isGenerating}
              onChange={(event) =>
                setQuality(
                  event.target
                    .value as ImageQuality,
                )
              }
              value={quality}
            >
              <option value="low">
                Exploration
              </option>
              <option value="medium">
                Refined
              </option>
              <option value="high">
                Final
              </option>
            </select>

            <small>
              Use Exploration for first ideas, Refined for stronger versions, and Final for approved directions.
            </small>
          </label>

          <label className={styles.fieldWide}>
            <span>
              Clothing notes
            </span>

            <textarea
              disabled={isGenerating}
              maxLength={279}
              onChange={(event) =>
                setClothingNotes(
                  event.target.value,
                )
              }
              placeholder="Optional: refined fabric, tailoring detail, or restrained colour direction."
              rows={3}
              value={clothingNotes}
            />

            <small>
              {clothingNotes.length}/279
            </small>
          </label>

          <label className={styles.fieldWide}>
            <span>Mood note</span>

            <textarea
              disabled={isGenerating}
              maxLength={279}
              onChange={(event) =>
                setMoodNotes(
                  event.target.value,
                )
              }
              placeholder="Optional: quieter, warmer, more sculptural, or more formal—without changing the brand grammar."
              rows={3}
              value={moodNotes}
            />

            <small>
              {moodNotes.length}/279
            </small>
          </label>

          <label className={styles.fieldWide}>
            <span>
              Creative direction
            </span>

            <textarea
              disabled={isGenerating}
              maxLength={279}
              onChange={(event) =>
                setCreativeNote(
                  event.target.value,
                )
              }
              placeholder="Optional: describe a specific styling, material, silhouette, or atmosphere for this artwork."
              rows={3}
              value={creativeNote}
            />

            <small>
              {creativeNote.length}/279
            </small>
          </label>

          <label className={styles.field}>
            <span>
              Number of options
            </span>

            <select
              disabled={isGenerating}
              onChange={(event) =>
                setNumberOfVariations(
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
              value={
                numberOfVariations
              }
            >
              <option value={1}>
                1 option
              </option>
              <option value={2}>
                2 options
              </option>
              <option value={3}>
                3 options
              </option>
              <option value={4}>
                4 options
              </option>
            </select>

            <small>
              Each option becomes its own artwork and is reviewed separately.
            </small>
          </label>
        </div>

        {!generationEnabled ? (
          <p className={styles.reviewerNotice}>
            Artwork creation is currently unavailable. You can continue reviewing and preparing existing artworks.
          </p>
        ) : null}

        {!canGenerate ? (
          <p className={styles.reviewerNotice}>
            This account can review artworks but cannot create new versions.
          </p>
        ) : null}

        {error ? (
          <p
            className={styles.error}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            disabled={disabled}
            type="submit"
          >
            {isGenerating
              ? "Generating and reviewing…"
              : "Create artwork"}
          </button>

          <p>
            Every result enters the artwork archive for review. Nothing appears in the public gallery until you choose to publish it.
          </p>
        </div>
      </form>

      {result ? (
        <div className={styles.results}>
          <div className={styles.resultHeader}>
            <div>
              <p className={styles.eyebrow}>
                Artwork created
              </p>

              <h3>
                {result.variants.length}{" "}
                {result.variants.length === 1
                  ? "new artwork"
                  : "new artworks"}
              </h3>
            </div>

            <Link href="/studio/artworks">
              Open review library
            </Link>
          </div>

          <div className={styles.resultGrid}>
            {result.variants.map(
              (variant) => (
                <article
                  className={
                    styles.resultCard
                  }
                  key={variant.id}
                >
                  <Link
                    href={`/studio/artworks/${variant.id}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${selectedArchetype.title.en} artwork`}
                      src={
                        variant.thumbnailUrl
                      }
                    />
                  </Link>

                  <div>
                    <strong>
                      {
                        selectedArchetype
                          .title.en
                      }
                    </strong>

                    <span>
                      {getArtworkStatusLabel(
                        variant.status,
                      )}
                    </span>

                    {variant.visualScore !==
                    null ? (
                      <small>
                        Visual score:{" "}
                        {
                          variant.visualScore
                        }
                        /100
                      </small>
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
