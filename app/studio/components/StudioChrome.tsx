"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
} from "next/navigation";
import SignOutButton from "./SignOutButton";
import styles from "./studio-chrome.module.css";

type StudioSession = Readonly<{
  ok?: boolean;
  admin?: Readonly<{
    email: string;
    displayName: string | null;
    role:
      | "owner"
      | "editor"
      | "reviewer";
  }>;
}>;

type NavigationItem = Readonly<{
  href: string;
  label: string;
  description: string;
  external?: boolean;
  active: (
    pathname: string,
  ) => boolean;
  icon:
    | "create"
    | "archive"
    | "gallery"
    | "site";
}>;

const NAVIGATION:
  readonly NavigationItem[] = [
    {
      href: "/studio",
      label: "Create",
      description:
        "Direct a new mask",
      active: (pathname) =>
        pathname === "/studio",
      icon: "create",
    },
    {
      href: "/studio/artworks",
      label: "Archive",
      description:
        "Review every artwork",
      active: (pathname) =>
        pathname.startsWith(
          "/studio/artworks",
        ),
      icon: "archive",
    },
    {
      href: "/gallery",
      label: "Public gallery",
      description:
        "See released works",
      active: () => false,
      icon: "gallery",
    },
    {
      href: "/",
      label: "Website",
      description:
        "Return to I AM NOBODY",
      active: () => false,
      icon: "site",
    },
  ];

function NavIcon({
  name,
}: Readonly<{
  name:
    NavigationItem["icon"];
}>) {
  if (name === "create") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (name === "archive") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <rect
          height="6"
          rx="1"
          width="6"
          x="3"
          y="3"
        />

        <rect
          height="6"
          rx="1"
          width="6"
          x="15"
          y="3"
        />

        <rect
          height="6"
          rx="1"
          width="6"
          x="3"
          y="15"
        />

        <rect
          height="6"
          rx="1"
          width="6"
          x="15"
          y="15"
        />
      </svg>
    );
  }

  if (name === "gallery") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
      >
        <rect
          height="16"
          rx="2"
          width="18"
          x="3"
          y="4"
        />

        <circle
          cx="9"
          cy="9"
          r="1.5"
        />

        <path d="m5.5 17 4.2-4.2 2.8 2.8 2.2-2.2 3.8 3.6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function getSectionLabel(
  pathname: string,
) {
  if (
    pathname.startsWith(
      "/studio/artworks/",
    )
  ) {
    return "Artwork review";
  }

  if (
    pathname.startsWith(
      "/studio/artworks",
    )
  ) {
    return "Private archive";
  }

  return "Creation desk";
}

function formatRole(
  role?:
    | "owner"
    | "editor"
    | "reviewer",
) {
  if (role === "owner") {
    return "Studio owner";
  }

  if (role === "editor") {
    return "Creative editor";
  }

  if (role === "reviewer") {
    return "Creative reviewer";
  }

  return "Creative team";
}

export default function StudioChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname =
    usePathname();

  const isLogin =
    pathname ===
    "/studio/login";

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false);

  const [
    session,
    setSession,
  ] =
    useState<StudioSession | null>(
      null,
    );

  useEffect(() => {
    if (isLogin) {
      return;
    }

    const controller =
      new AbortController();

    async function loadSession() {
      try {
        const response =
          await fetch(
            "/api/studio/session",
            {
              cache:
                "no-store",

              credentials:
                "same-origin",

              signal:
                controller.signal,
            },
          );

        if (!response.ok) {
          return;
        }

        const payload =
          (await response.json()) as
            StudioSession;

        setSession(payload);
      } catch {
        // Protected studio pages perform the authoritative redirect.
      }
    }

    void loadSession();

    return () =>
      controller.abort();
  }, [isLogin]);

  const adminName =
    useMemo(() => {
      const admin =
        session?.admin;

      if (!admin) {
        return "Private creative team";
      }

      return (
        admin.displayName?.trim() ||
        admin.email
      );
    }, [session]);

  if (isLogin) {
    return <>{children}</>;
  }

  const sectionLabel =
    getSectionLabel(pathname);

  const roleLabel =
    formatRole(
      session?.admin?.role,
    );

  return (
    <div className={styles.shell}>
      <div
        aria-hidden="true"
        className={
          styles.iridescentLine
        }
      />

      <div
        className={
          styles.navDock
        }
      >
        <header
          className={
            styles.navbar
          }
        >
          <Link
            aria-label="I AM NOBODY Image Studio home"
            className={
              styles.brand
            }
            href="/studio"
          >
            <span
              aria-hidden="true"
              className={
                styles.brandMark
              }
            >
              <span />
            </span>

            <span
              className={
                styles.brandCopy
              }
            >
              <strong>
                I AM NOBODY
              </strong>

              <small>
                Private image studio
              </small>
            </span>
          </Link>

          <button
            aria-controls="studio-navigation"
            aria-expanded={
              menuOpen
            }
            aria-label={
              menuOpen
                ? "Close studio navigation"
                : "Open studio navigation"
            }
            className={
              styles.menuButton
            }
            onClick={() =>
              setMenuOpen(
                (current) =>
                  !current,
              )
            }
            type="button"
          >
            <span />
            <span />
          </button>

          <nav
            aria-label="Studio navigation"
            className={`${styles.navigation} ${
              menuOpen
                ? styles.navigationOpen
                : ""
            }`}
            id="studio-navigation"
          >
            {NAVIGATION.map(
              (item) => {
                const active =
                  item.active(
                    pathname,
                  );

                return (
                  <Link
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={`${styles.navLink} ${
                      active
                        ? styles.navLinkActive
                        : ""
                    }`}
                    href={
                      item.href
                    }
                    key={
                      item.href
                    }
                    onClick={() =>
                      setMenuOpen(
                        false,
                      )
                    }
                    target={
                      item.external
                        ? "_blank"
                        : undefined
                    }
                  >
                    <NavIcon
                      name={
                        item.icon
                      }
                    />

                    <span>
                      <strong>
                        {
                          item.label
                        }
                      </strong>

                      <small>
                        {
                          item.description
                        }
                      </small>
                    </span>
                  </Link>
                );
              },
            )}
          </nav>

          <div
            className={
              styles.accountArea
            }
          >
            <div
              className={
                styles.accountCopy
              }
            >
              <span>
                {adminName}
              </span>

              <small>
                {roleLabel}
              </small>
            </div>

            <SignOutButton />
          </div>
        </header>
      </div>

      <aside
        aria-label="Private studio welcome"
        className={
          styles.welcomeBar
        }
      >
        <div
          aria-hidden="true"
          className={
            styles.welcomeSymbol
          }
        >
          <span />
        </div>

        <div
          className={
            styles.welcomeCopy
          }
        >
          <strong>
            Welcome to the private
            I AM NOBODY Image Studio.
          </strong>

          <p>
            Create with discipline,
            review with intention, and
            release only what truly
            belongs to the official
            universe.
          </p>
        </div>

        <div
          className={
            styles.welcomeMeta
          }
        >
          <span>
            {sectionLabel}
          </span>

          <small>
            Human approval always
            required
          </small>
        </div>
      </aside>

      <div
        className={
          styles.content
        }
      >
        {children}
      </div>
    </div>
  );
}
