"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NOBODY_ARCHETYPES,
  NOBODY_BRAND,
  getArtworkStatusLabel,
} from "@/lib/nobody";
import type { ArchetypeSlug, ImageQuality } from "@/lib/nobody";
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
  issues?: ReadonlyArray<Readonly<{ message: string }>>;
}>;

export default function ImageGenerator({
  canGenerate,
  generationEnabled,
}: Readonly<{
  canGenerate: boolean;
  generationEnabled: boolean;
}>) {
  const router = useRouter();

  const [archetype, setArchetype] = useState<ArchetypeSlug>("nobody-classic");
  const [clothingNotes, setClothingNotes] = useState("");
  const [creativeNote, setCreativeNote] = useState("");
  const [prop, setProp] = useState("");
  const [quality, setQuality] = useState<ImageQuality>("low");
  const [numberOfVariations, setNumberOfVariations] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateSuccess | null>(null);

  const selectedArchetype = useMemo(
    () =>
      NOBODY_ARCHETYPES.find((item) => item.slug === archetype) ??
      NOBODY_ARCHETYPES[0],
    [archetype],
  );

  function handleArchetypeChange(value: ArchetypeSlug) {
    setArchetype(value);
    setProp("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canGenerate || !generationEnabled || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          archetype,
          clothingNotes,
          variationDirection: creativeNote,
          prop: prop || null,
          quality,
          numberOfVariations,
        }),
      });

      const payload = (await response.json()) as GenerateSuccess | GenerateFailure;

      if (!response.ok || !payload.ok) {
        const issueText =
          !payload.ok && payload.issues?.length
            ? payload.issues.map((issue) => issue.message).join(" ")
            : "";

        throw new Error(
          (!payload.ok && payload.message) ||
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

  const disabled = !canGenerate || !generationEnabled || isGenerating;

  return (
    <section aria-labelledby="generator-title" className={styles.section}>
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>New artwork</p>
          <h2 id="generator-title">Choose the next mask</h2>
        </div>

        <div className={styles.scopeLock}>
          <span>Cover format</span>
          <strong>{NOBODY_BRAND.generationCanvas.size}</strong>
        </div>
      </div>

      <div className={styles.scopeNotice}>
        The original cover design and all text stay unchanged. Only the
        anonymous character changes through clothing, role, and one restrained
        detail when needed.
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Archetype</span>

            <select
              disabled={isGenerating}
              onChange={(event) =>
                handleArchetypeChange(event.target.value as ArchetypeSlug)
              }
              value={archetype}
            >
              {NOBODY_ARCHETYPES.filter((item) => item.active).map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title.en}
                </option>
              ))}
            </select>

            <small>{selectedArchetype.description.en}</small>
          </label>

          <label className={styles.field}>
            <span>Optional object</span>

            <select
              disabled={
                isGenerating || selectedArchetype.permittedProps.length === 0
              }
              onChange={(event) => setProp(event.target.value)}
              value={prop}
            >
              <option value="">None</option>

              {selectedArchetype.permittedProps.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <small>At most one quiet, symbolic object.</small>
          </label>

          <label className={styles.fieldWide}>
            <span>Clothing notes</span>

            <textarea
              disabled={isGenerating}
              maxLength={279}
              onChange={(event) => setClothingNotes(event.target.value)}
              placeholder="Optional: describe a refined fabric, tailoring detail, or restrained colour direction."
              rows={3}
              value={clothingNotes}
            />

            <small>{clothingNotes.length}/279</small>
          </label>

          <label className={styles.fieldWide}>
            <span>Creative note</span>

            <textarea
              disabled={isGenerating}
              maxLength={279}
              onChange={(event) => setCreativeNote(event.target.value)}
              placeholder="Optional: add one subtle direction, such as softer tailoring or a warmer presence."
              rows={3}
              value={creativeNote}
            />

            <small>{creativeNote.length}/279</small>
          </label>

          <label className={styles.field}>
            <span>Finish</span>

            <select
              disabled={isGenerating}
              onChange={(event) => setQuality(event.target.value as ImageQuality)}
              value={quality}
            >
              <option value="low">Draft</option>
              <option value="medium">Standard</option>
              <option value="high">Final</option>
            </select>

            <small>
              Use Draft while exploring. Use Final only for a selected idea.
            </small>
          </label>

          <label className={styles.field}>
            <span>Number of options</span>

            <select
              disabled={isGenerating}
              onChange={(event) => setNumberOfVariations(Number(event.target.value))}
              value={numberOfVariations}
            >
              <option value={1}>1 option</option>
              <option value={2}>2 options</option>
              <option value={3}>3 options</option>
              <option value={4}>4 options</option>
            </select>

            <small>Every option is saved privately in Review.</small>
          </label>
        </div>

        {!generationEnabled ? (
          <p className={styles.reviewerNotice}>
            Artwork generation is paused for now. The studio and review library
            can be completed first, then the image service can be connected.
          </p>
        ) : null}

        {!canGenerate ? (
          <p className={styles.reviewerNotice}>
            This account can review artworks but cannot create new ones.
          </p>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button disabled={disabled} type="submit">
            {isGenerating ? "Creating artwork…" : "Create artwork"}
          </button>

          <p>
            Nothing is published automatically. Every image remains private
            until it is reviewed and approved.
          </p>
        </div>
      </form>

      {result ? (
        <div className={styles.results}>
          <div className={styles.resultHeader}>
            <div>
              <p className={styles.eyebrow}>Created</p>
              <h3>{result.variants.length} new option(s)</h3>
            </div>

            <Link href="/studio/artworks">Review all artworks</Link>
          </div>

          <div className={styles.resultGrid}>
            {result.variants.map((variant) => (
              <article className={styles.resultCard} key={variant.id}>
                <Link href={`/studio/artworks/${variant.id}`}>
                  {/* Signed Storage URLs are temporary. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${selectedArchetype.title.en} artwork`}
                    src={variant.thumbnailUrl}
                  />
                </Link>

                <div>
                  <strong>{selectedArchetype.title.en}</strong>
                  <span>{getArtworkStatusLabel(variant.status)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
