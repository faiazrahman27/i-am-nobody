import Link from "next/link";
import { getCertificateVerification } from "@/lib/nobody/certificateService";
import styles from "./verify.module.css";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function shorten(value: string | null) {
  return value ? `${value.slice(0, 18)}…${value.slice(-10)}` : "—";
}

export default async function VerifyArtworkPage({
  params,
}: Readonly<{ params: Promise<{ code: string }> }>) {
  const { code } = await params;
  const verification = await getCertificateVerification(code);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">I AM NOBODY</Link>
        <Link href="/gallery">Official gallery</Link>
      </header>

      <section className={styles.hero}>
        <p>Artwork certification</p>
        <h1>
          {verification.valid
            ? "VERIFIED"
            : verification.found
              ? "NOT VALID"
              : "NOT FOUND"}
        </h1>
        <div
          className={verification.valid ? styles.validMark : styles.invalidMark}
        >
          <span aria-hidden="true">{verification.valid ? "✓" : "×"}</span>
          <strong>
            {verification.valid
              ? "This is an authentic I AM NOBODY artwork."
              : verification.status === "revoked"
                ? "This certificate has been revoked."
                : verification.found
                  ? "The certificate exists, but its integrity check did not pass."
                  : "No I AM NOBODY certificate matches this code."}
          </strong>
        </div>
      </section>

      {verification.galleryPublished && verification.gallerySlug ? (
        <section className={styles.artworkPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={verification.archetypeTitle ?? "Verified I AM NOBODY artwork"}
            src={`/api/gallery/image/${verification.gallerySlug}`}
          />
          <div>
            <span>Verified public artwork</span>
            <strong>
              {verification.archetypeTitle ?? verification.artworkCode}
            </strong>
          </div>
        </section>
      ) : null}

      <section className={styles.record}>
        <div className={styles.codeBlock}>
          <span>Certificate code</span>
          <strong>{verification.certificateCode || "—"}</strong>
        </div>

        <dl>
          <div>
            <dt>Artwork</dt>
            <dd>{verification.artworkCode ?? "—"}</dd>
          </div>
          <div>
            <dt>Artwork role</dt>
            <dd>{verification.archetypeTitle ?? "—"}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{formatDate(verification.issuedAt)}</dd>
          </div>
          <div>
            <dt>Certificate status</dt>
            <dd>{verification.status.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Artwork file</dt>
            <dd>
              {verification.artworkFileVerified ? "Verified" : "Not verified"}
            </dd>
          </div>
          <div>
            <dt>Canonical reference</dt>
            <dd>
              {verification.referenceVerified ? "Verified" : "Not verified"}
            </dd>
          </div>
          <div>
            <dt>Certificate record</dt>
            <dd>
              {verification.verificationRecordVerified
                ? "Verified"
                : "Not verified"}
            </dd>
          </div>
          <div>
            <dt>Artwork fingerprint</dt>
            <dd>{shorten(verification.artworkSha256)}</dd>
          </div>
          <div>
            <dt>Verification fingerprint</dt>
            <dd>{shorten(verification.verificationHash)}</dd>
          </div>
        </dl>

        {verification.revokedReason ? (
          <div className={styles.revokedReason}>
            <strong>Revocation note</strong>
            <p>{verification.revokedReason}</p>
          </div>
        ) : null}

        <div className={styles.actions}>
          {verification.galleryPublished && verification.gallerySlug ? (
            <Link href="/gallery">View in the official gallery →</Link>
          ) : null}
          <Link href="/gallery#verify">Verify another artwork →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>I AM NOBODY</span>
        <span>
          The image is approved by a person. The certificate records that
          decision.
        </span>
      </footer>
    </main>
  );
}
