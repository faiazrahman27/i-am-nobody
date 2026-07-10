"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import styles from "./studio-login.module.css";

type LoginFormProps = Readonly<{
  initialError?: string | null;
}>;

function getInitialMessage(code?: string | null) {
  if (code === "not-authorized") {
    return "This account is signed in but is not authorized for the private studio.";
  }

  return "";
}

export default function LoginForm({
  initialError,
}: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserSupabaseClient(),
    [],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    getInitialMessage(initialError),
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("The email or password is incorrect.");
        return;
      }

      const response = await fetch("/api/studio/session", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (response.status === 403) {
        await supabase.auth.signOut();
        setMessage(
          "This account exists but has not been approved for the private studio.",
        );
        return;
      }

      if (!response.ok) {
        await supabase.auth.signOut();
        setMessage(
          "The studio could not verify access. Please try again.",
        );
        return;
      }

      router.replace("/studio");
      router.refresh();
    } catch {
      setMessage(
        "The studio could not connect. Check the Supabase configuration and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>
        <span>Email</span>
        <input
          autoComplete="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}

      <button className={styles.submit} disabled={pending} type="submit">
        {pending ? "Verifying…" : "Enter the studio"}
      </button>
    </form>
  );
}