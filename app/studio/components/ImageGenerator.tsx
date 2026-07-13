"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  NOBODY_ARCHETYPES,
  NOBODY_BRAND,
} from "@/lib/nobody";
import type {
  ArchetypeSlug,
  ImageQuality,
} from "@/lib/nobody";
import styles from "./image-generator.module.css";

type GeneratedVariant = Readonly<{
  id: string;
  artworkCode: string;
  status: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sha256: string;
}>;

type GenerateSuccess = Readonly<{
  ok: true;
  jobId: string;
  model: string;
  quality: ImageQuality;
  canonicalSize: string;
  variants: readonly GeneratedVariant[];
}>;

type GenerateFailure = Readonly<{
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
}: Readonly<{
  canGenerate: boolean;
}>) {
  const router = useRouter();

  const [
    archetype,
    setArchetype,
  ] = useState<ArchetypeSlug>(
    "nobody-classic",
  );

  const [
    clothingNotes,
    setClothingNotes,
  ] = useState("");

  const [
    variationDirection,
    setVariationDirection,
  ] = useState("");

  const [prop, setProp] =
    useState("");

  const [
    quality,
    setQuality,
  ] = useState<ImageQuality>("low");

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

  const [
    result,
    setResult,
  ] = useState<GenerateSuccess | null>(
    null,
  );

  const selectedArchetype =
    useMemo(
      () =>
        NOBODY_ARCHETYPES.find(
          (item) =>
            item.slug === archetype,
        )!,
      [archetype],
    );

  const handleArchetypeChange = (
    value: ArchetypeSlug,
  ) => {
    setArchetype(value);
    setProp("");
    setError("");
  };

  const handleSubmit = async (
    event:
      React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !canGenerate ||
      isGenerating
    ) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/studio/generate",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            archetype,
            clothingNotes,
            variationDirection,
            prop: prop || null,
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
            "Image generation failed.",
        );
      }

      setResult(payload);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Image generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      className={styles.section}
      aria-labelledby="generator-title"
    >
      <div
        className={styles.headingRow}
      >
        <div>
          <p
            className={styles.eyebrow}
          >
            Character-only generation
          </p>

          <h2 id="generator-title">
            Create a Nobody variation
          </h2>
        </div>

        <div
          className={styles.scopeLock}
        >
          <span>Locked output</span>

          <strong>
            {
              NOBODY_BRAND
                .generationCanvas.size
            }{" "}
            PNG
          </strong>
        </div>
      </div>

      <div
        className={styles.scopeNotice}
      >
        <strong>Fixed:</strong>{" "}
        cover size, framing,
        background, border, spine,
        title, subtitle, author name,
        and iridescent lines. Only
        the anonymous character is
        editable.
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
      >
        <div
          className={styles.formGrid}
        >
          <label
            className={styles.field}
          >
            <span>Archetype</span>

            <select
              value={archetype}
              onChange={(event) =>
                handleArchetypeChange(
                  event.target
                    .value as ArchetypeSlug,
                )
              }
              disabled={isGenerating}
            >
              {NOBODY_ARCHETYPES.filter(
                (item) => item.active,
              ).map((item) => (
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

          <label
            className={styles.field}
          >
            <span>Approved prop</span>

            <select
              value={prop}
              onChange={(event) =>
                setProp(
                  event.target.value,
                )
              }
              disabled={
                isGenerating ||
                selectedArchetype
                  .permittedProps
                  .length === 0
              }
            >
              <option value="">
                No prop
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
              Maximum one symbolic
              prop.
            </small>
          </label>

          <label
            className={
              styles.fieldWide
            }
          >
            <span>
              Clothing notes
            </span>

            <textarea
              value={clothingNotes}
              onChange={(event) =>
                setClothingNotes(
                  event.target.value,
                )
              }
              maxLength={279}
              rows={3}
              placeholder="Optional restrained clothing detail. No logos, scenes, text, or costume direction."
              disabled={isGenerating}
            />

            <small>
              {clothingNotes.length}
              /279
            </small>
          </label>

          <label
            className={
              styles.fieldWide
            }
          >
            <span>
              Variation direction
            </span>

            <textarea
              value={
                variationDirection
              }
              onChange={(event) =>
                setVariationDirection(
                  event.target.value,
                )
              }
              maxLength={279}
              rows={3}
              placeholder="Optional secondary variation, for example: slightly softer tailoring, restrained matte fabric, warmer human presence."
              disabled={isGenerating}
            />

            <small>
              {
                variationDirection
                  .length
              }
              /279
            </small>
          </label>

          <label
            className={styles.field}
          >
            <span>Quality</span>

            <select
              value={quality}
              onChange={(event) =>
                setQuality(
                  event.target
                    .value as ImageQuality,
                )
              }
              disabled={isGenerating}
            >
              <option value="low">
                Low — draft review
              </option>

              <option value="medium">
                Medium — stronger
                detail
              </option>

              <option value="high">
                High — final candidate
              </option>
            </select>

            <small>
              Start with low. Use high
              only for a final
              candidate.
            </small>
          </label>

          <label
            className={styles.field}
          >
            <span>Variations</span>

            <select
              value={
                numberOfVariations
              }
              onChange={(event) =>
                setNumberOfVariations(
                  Number(
                    event.target.value,
                  ),
                )
              }
              disabled={isGenerating}
            >
              <option value={1}>
                1 variation
              </option>

              <option value={2}>
                2 variations
              </option>

              <option value={3}>
                3 variations
              </option>

              <option value={4}>
                4 variations
              </option>
            </select>

            <small>
              Each variation is stored
              privately for review.
            </small>
          </label>
        </div>

        {error ? (
          <p
            className={styles.error}
          >
            {error}
          </p>
        ) : null}

        {!canGenerate ? (
          <p
            className={
              styles.reviewerNotice
            }
          >
            This account has reviewer
            access. Owner or editor
            access is required to
            generate images.
          </p>
        ) : null}

        <div
          className={styles.actions}
        >
          <button
            type="submit"
            disabled={
              !canGenerate ||
              isGenerating
            }
          >
            {isGenerating
              ? "Generating and restoring the cover…"
              : "Generate character variation"}
          </button>

          <p>
            No public page is changed.
            Results stay in the private
            Supabase bucket with status{" "}
            <code>
              ready_for_review
            </code>
            .
          </p>
        </div>
      </form>

      {result ? (
        <div
          className={styles.results}
        >
          <div
            className={
              styles.resultHeader
            }
          >
            <div>
              <p
                className={
                  styles.eyebrow
                }
              >
                Generation complete
              </p>

              <h3>
                {
                  result.variants
                    .length
                }{" "}
                private candidate(s)
              </h3>
            </div>

            <span>
              {result.model} ·{" "}
              {result.quality} ·{" "}
              {result.canonicalSize}
            </span>
          </div>

          <div
            className={
              styles.resultGrid
            }
          >
            {result.variants.map(
              (variant) => (
                <article
                  className={
                    styles.resultCard
                  }
                  key={variant.id}
                >
                  <a
                    href={
                      variant.imageUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/*
                      Signed Supabase URLs are temporary,
                      so a native image is used intentionally.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        variant.thumbnailUrl
                      }
                      alt={`${selectedArchetype.title.en} — ${variant.artworkCode}`}
                    />
                  </a>

                  <div>
                    <strong>
                      {
                        variant.artworkCode
                      }
                    </strong>

                    <span>
                      {variant.status.replaceAll(
                        "_",
                        " ",
                      )}
                    </span>

                    <small>
                      {variant.width} ×{" "}
                      {variant.height}
                    </small>
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