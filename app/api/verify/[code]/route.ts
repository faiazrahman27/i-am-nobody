import { NextResponse } from "next/server";
import { getCertificateVerification } from "@/lib/nobody/certificateService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ code: string }> }>,
) {
  const { code } = await context.params;
  const verification = await getCertificateVerification(code);

  return NextResponse.json(verification, {
    status: verification.found ? 200 : 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
