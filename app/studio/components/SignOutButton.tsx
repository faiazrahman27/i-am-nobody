"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "../studio.module.css";

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
      className={styles.signOut}
      disabled={pending}
      onClick={signOut}
      type="button"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}