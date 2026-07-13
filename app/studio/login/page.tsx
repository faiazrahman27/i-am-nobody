import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NOBODY_BRAND } from "@/lib/nobody";
import {
  getStudioAccess,
} from "@/lib/supabase/studioAccess";
import LoginForm from "./LoginForm";
import styles from "./studio-login.module.css";

export const dynamic = "force-dynamic";

type StudioLoginPageProps = Readonly<{
  searchParams: Promise<{
    error?: string;
  }>;
}>;

export default async function StudioLoginPage({
  searchParams,
}: StudioLoginPageProps) {
  const [params, access] = await Promise.all([
    searchParams,
    getStudioAccess(),
  ]);

  if (access.authorized) {
    redirect("/studio");
  }

  return (
    <main className={styles.page}>
      <div
        aria-hidden="true"
        className={styles.iridescentLine}
      />

      <section className={styles.coverPanel}>
        <div className={styles.coverPanelTop}>
          <Link href="/">I AM NOBODY</Link>
          <span>Private creative access</span>
        </div>

        <div className={styles.coverStage}>
          <div
            aria-hidden="true"
            className={styles.coverAura}
          />

          <div className={styles.coverFrame}>
            <Image
              alt="Original I AM NOBODY book cover"
              className={styles.cover}
              height={
                NOBODY_BRAND
                  .canonicalReference.height
              }
              priority
              sizes="(max-width: 900px) 78vw, 42vw"
              src={
                NOBODY_BRAND
                  .canonicalReference.publicPath
              }
              width={
                NOBODY_BRAND
                  .canonicalReference.width
              }
            />
          </div>

          <div className={styles.referenceLabel}>
            <span>Canonical reference</span>
            <strong>
              906 × 1280 · full cover preserved
            </strong>
          </div>
        </div>

        <blockquote>
          “Who are you when nobody is watching?”
        </blockquote>
      </section>

      <section className={styles.formPanel}>
        <div
          aria-hidden="true"
          className={styles.formTexture}
        />

        <div className={styles.formInner}>
          <div className={styles.privateBadge}>
            <span aria-hidden="true" />
            Invitation-only workspace
          </div>

          <p className={styles.eyebrow}>
            I AM NOBODY · IMAGE STUDIO
          </p>

          <h1>
            Enter the
            <span>private studio.</span>
          </h1>

          <p className={styles.intro}>
            A controlled space for creating,
            reviewing, and preparing official visual
            masks. Every artwork remains private
            until a human chooses to release it.
          </p>

          <LoginForm
            initialError={params.error ?? null}
          />

          <div className={styles.accessNote}>
            <strong>
              Protected creative environment
            </strong>

            <p>
              Access is limited to approved members
              of the I AM NOBODY creative team.
              Activity inside the studio is recorded
              for production integrity.
            </p>
          </div>

          <Link className={styles.backLink} href="/">
            <span aria-hidden="true">←</span>
            Return to the public website
          </Link>
        </div>
      </section>
    </main>
  );
}