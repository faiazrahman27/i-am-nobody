import Image from "next/image";
import { redirect } from "next/navigation";
import { getStudioAccess } from "@/lib/supabase/studioAccess";
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
      <section aria-hidden="true" className={styles.coverPanel}>
        <Image
          alt=""
          className={styles.cover}
          fill
          priority
          sizes="(max-width: 880px) 100vw, 45vw"
          src="/book-cover.png"
        />

        <div className={styles.coverShade} />
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formInner}>
          <p className={styles.eyebrow}>IMAGE STUDIO</p>

          <h1>I AM NOBODY</h1>

          <p className={styles.intro}>
            A private space for creating and selecting official I AM NOBODY
            cover variations.
          </p>

          <LoginForm initialError={params.error ?? null} />

          <p className={styles.notice}>
            Access is limited to invited members of the creative team.
          </p>
        </div>
      </section>
    </main>
  );
}
