"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";
import styles from "./studio-chrome.module.css";

export default function SignOutButton() {
  const router = useRouter();

  const supabase = useMemo(
    () => createBrowserSupabaseClient(),
    [],
  );

  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/studio/login");
      router.refresh();
    }
  }

  return (
    <button
      aria-label={
        pending
          ? "Signing out"
          : "Sign out of the private studio"
      }
      className={styles.signOutButton}
      disabled={pending}
      onClick={signOut}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
        <path d="M14 8l4 4-4 4M18 12H9" />
      </svg>

      <span>
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}