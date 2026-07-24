"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutomationLiveRefresh({
  enabled,
}: Readonly<{
  enabled: boolean;
}>) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, router]);

  return null;
}
