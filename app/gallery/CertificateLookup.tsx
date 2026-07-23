"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./gallery.module.css";

export default function CertificateLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "");

    if (!normalized) return;
    router.push(`/verify/${encodeURIComponent(normalized)}`);
  }

  return (
    <form className={styles.verifyForm} onSubmit={submit}>
      <label htmlFor="certificate-code">Certificate code</label>
      <div>
        <input
          autoComplete="off"
          id="certificate-code"
          onChange={(event) => setCode(event.target.value)}
          placeholder="IAMN-2026-XXXX-XXXX-XXXX"
          spellCheck={false}
          value={code}
        />
        <button type="submit">Verify artwork →</button>
      </div>
    </form>
  );
}
