import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnvironment } from "./env";

function isStudioPage(pathname: string) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

function isStudioLoginPage(pathname: string) {
  return pathname === "/studio/login";
}

function isStudioApi(pathname: string) {
  return pathname === "/api/studio" || pathname.startsWith("/api/studio/");
}

export async function updateSupabaseSession(
  request: NextRequest,
) {
  const { url, publishableKey } =
    getSupabasePublicEnvironment();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const isAuthenticated =
    !claimsError && Boolean(claimsData?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  if (
    isStudioPage(pathname) &&
    !isStudioLoginPage(pathname) &&
    !isAuthenticated
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/studio/login";
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }

  if (isStudioApi(pathname) && !isAuthenticated) {
    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHENTICATED",
      },
      { status: 401 },
    );
  }

  return response;
}