import { NextResponse } from "next/server";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getStudioAccess();

  if (!access.authenticated) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        authorized: false,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!access.authorized) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: true,
        authorized: false,
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: true,
      authorized: true,
      admin: access.admin,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}