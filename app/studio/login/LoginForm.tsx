"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";
import styles from "./studio-login.module.css";

type LoginFormProps = Readonly<{
  initialError?: string | null;
}>;

function getInitialMessage(
  code?: string | null,
) {
  if (code === "not-authorized") {
    return "This account is signed in, but it has not been approved for the private studio.";
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
  const [password, setPassword] =
    useState("");

  const [
    passwordVisible,
    setPasswordVisible,
  ] = useState(false);

  const [message, setMessage] = useState(
    getInitialMessage(initialError),
  );

  const [pending, setPending] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setMessage("");
    setPending(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        setMessage(
          "The email or password is incorrect.",
        );
        return;
      }

      const response = await fetch(
        "/api/studio/session",
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );

      if (response.status === 403) {
        await supabase.auth.signOut();

        setMessage(
          "This account exists, but it has not been approved for the private studio.",
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
    <form
      className={styles.form}
      noValidate
      onSubmit={handleSubmit}
    >
      <label className={styles.field}>
        <span>Email address</span>

        <div className={styles.inputShell}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <rect
              height="14"
              rx="2"
              width="18"
              x="3"
              y="5"
            />

            <path d="m4 7 8 6 8-6" />
          </svg>

          <input
            autoComplete="email"
            inputMode="email"
            name="email"
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </div>
      </label>

      <label className={styles.field}>
        <span>Password</span>

        <div className={styles.inputShell}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <rect
              height="10"
              rx="2"
              width="16"
              x="4"
              y="10"
            />

            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>

          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            type={
              passwordVisible
                ? "text"
                : "password"
            }
            value={password}
          />

          <button
            aria-label={
              passwordVisible
                ? "Hide password"
                : "Show password"
            }
            className={styles.passwordToggle}
            onClick={() =>
              setPasswordVisible(
                (current) => !current,
              )
            }
            type="button"
          >
            {passwordVisible ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {message ? (
        <p className={styles.error} role="alert">
          <span aria-hidden="true">!</span>
          {message}
        </p>
      ) : null}

      <button
        className={styles.submit}
        disabled={pending}
        type="submit"
      >
        <span>
          {pending
            ? "Verifying private access…"
            : "Enter the studio"}
        </span>

        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}