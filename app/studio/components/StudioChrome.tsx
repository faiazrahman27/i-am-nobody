"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";
import styles from "./studio-chrome.module.css";

type StudioSession = Readonly<{
  ok?: boolean;
  admin?: Readonly<{
    email: string;
    displayName: string | null;
    role: "owner" | "editor" | "reviewer";
  }>;
}>;

type NavigationItem = Readonly<{
  href: string;
  label: string;
  description: string;
  active: (pathname: string) => boolean;
  icon: "create" | "automation" | "archive" | "gallery" | "site";
}>;

const NAVIGATION: readonly NavigationItem[] = [
  {
    href: "/studio",
    label: "Overview",
    description: "Daily production status",
    active: (pathname) => pathname === "/studio",
    icon: "create",
  },
  {
    href: "/studio/automation",
    label: "Daily studio",
    description: "Ten artworks daily at 08:00",
    active: (pathname) => pathname.startsWith("/studio/automation"),
    icon: "automation",
  },
  {
    href: "/studio/artworks",
    label: "Artworks",
    description: "Review and finish artworks",
    active: (pathname) => pathname.startsWith("/studio/artworks"),
    icon: "archive",
  },
  {
    href: "/gallery",
    label: "Gallery",
    description: "View published artworks",
    active: () => false,
    icon: "gallery",
  },
  {
    href: "/",
    label: "Website",
    description: "Return to I AM NOBODY",
    active: () => false,
    icon: "site",
  },
];

function NavIcon({ name }: Readonly<{ name: NavigationItem["icon"] }>) {
  if (name === "create") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="6" rx="1" width="6" x="4" y="4" />
        <rect height="6" rx="1" width="6" x="14" y="4" />
        <rect height="6" rx="1" width="6" x="4" y="14" />
        <rect height="6" rx="1" width="6" x="14" y="14" />
      </svg>
    );
  }

  if (name === "automation") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2M8 3l-2 2M16 3l2 2" />
      </svg>
    );
  }

  if (name === "archive") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="6" rx="1" width="6" x="3" y="3" />
        <rect height="6" rx="1" width="6" x="15" y="3" />
        <rect height="6" rx="1" width="6" x="3" y="15" />
        <rect height="6" rx="1" width="6" x="15" y="15" />
      </svg>
    );
  }

  if (name === "gallery") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="18" x="3" y="4" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m5.5 17 4.2-4.2 2.8 2.8 2.2-2.2 3.8 3.6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function getSectionLabel(pathname: string) {
  if (pathname.startsWith("/studio/automation")) {
    return "Daily automation";
  }

  if (pathname.startsWith("/studio/artworks/")) {
    return "Artwork review";
  }

  if (pathname.startsWith("/studio/artworks")) {
    return "Artwork archive";
  }

  return "Studio overview";
}

function formatRole(role?: "owner" | "editor" | "reviewer") {
  if (role === "owner") return "Studio owner";
  if (role === "editor") return "Creative editor";
  if (role === "reviewer") return "Creative reviewer";
  return "Creative team";
}

export default function StudioChrome({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isLogin = pathname === "/studio/login";
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<StudioSession | null>(null);

  useEffect(() => {
    if (isLogin) return;

    const controller = new AbortController();

    async function loadSession() {
      try {
        const response = await fetch("/api/studio/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) return;
        setSession((await response.json()) as StudioSession);
      } catch {
        // Protected studio pages handle authentication and redirects.
      }
    }

    void loadSession();
    return () => controller.abort();
  }, [isLogin]);

  const adminName = useMemo(() => {
    const admin = session?.admin;
    return admin?.displayName?.trim() || admin?.email || "Creative team";
  }, [session]);

  if (isLogin) return <>{children}</>;

  return (
    <div className={styles.shell}>
      <div aria-hidden="true" className={styles.iridescentLine} />

      <div className={styles.navDock}>
        <header className={styles.navbar}>
          <Link
            aria-label="I AM NOBODY Image Studio home"
            className={styles.brand}
            href="/studio"
          >
            <span className={styles.brandCopy}>
              <strong>I AM NOBODY</strong>
              <small>Private image studio</small>
            </span>
          </Link>

          <button
            aria-controls="studio-navigation"
            aria-expanded={menuOpen}
            aria-label={
              menuOpen ? "Close studio navigation" : "Open studio navigation"
            }
            className={styles.menuButton}
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            <span />
            <span />
          </button>

          <nav
            aria-label="Studio navigation"
            className={`${styles.navigation} ${
              menuOpen ? styles.navigationOpen : ""
            }`}
            id="studio-navigation"
          >
            {NAVIGATION.map((item) => {
              const active = item.active(pathname);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`${styles.navLink} ${
                    active ? styles.navLinkActive : ""
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  <NavIcon name={item.icon} />

                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className={styles.accountArea}>
            <div className={styles.accountCopy}>
              <span>{adminName}</span>
              <small>{formatRole(session?.admin?.role)}</small>
            </div>

            <SignOutButton />
          </div>
        </header>
      </div>

      <aside aria-label="Studio welcome" className={styles.welcomeBar}>
        <div aria-hidden="true" className={styles.welcomeSymbol}>
          <span />
        </div>

        <div className={styles.welcomeCopy}>
          <strong>Welcome to the private I AM NOBODY Image Studio.</strong>
          <p>
            At 08:00 Rome time the studio starts today’s ten-artwork collection. Remaining items continue automatically on the next worker wave, and you can run them manually at any time. Nothing is approved or published without a human decision.
          </p>
        </div>

        <div className={styles.welcomeMeta}>
          <span>{getSectionLabel(pathname)}</span>
          <small>Every publication is a human decision</small>
        </div>
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
