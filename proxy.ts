import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function isAuthorizedAutomationGeneration(request: NextRequest) {
  if (request.nextUrl.pathname !== "/api/studio/generate") {
    return false;
  }

  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim() ?? "";

  return Boolean(
    secret &&
      secret.length >= 32 &&
      authorization === `Bearer ${secret}`,
  );
}

export async function proxy(request: NextRequest) {
  /*
   * Vercel's scheduled worker calls the normal generation endpoint with the
   * server-only CRON_SECRET. It has no browser Supabase session, so this
   * narrowly scoped request must reach the route handler before the regular
   * Studio authentication middleware runs. The route performs the same secret
   * check again and loads the configured owner/editor from Supabase.
   */
  if (isAuthorizedAutomationGeneration(request)) {
    return NextResponse.next();
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/studio/:path*", "/api/studio/:path*"],
};
