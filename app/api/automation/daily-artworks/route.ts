import { NextResponse } from "next/server";
import { processDailyAutomationQueue } from "@/lib/nobody/automationWorker";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { assertNobodyRuntimeReady } from "@/lib/nobody/runtimeConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized scheduled request." },
      { status: 401 },
    );
  }

  try {
    assertNobodyRuntimeReady();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "The Studio runtime configuration is invalid.",
      },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const requestedLimit = Number(requestUrl.searchParams.get("limit") ?? "10");
  const itemLimit = Number.isInteger(requestedLimit)
    ? Math.max(1, Math.min(10, requestedLimit))
    : 10;
  const force = requestUrl.searchParams.get("force") === "1";

  try {
    const result = await processDailyAutomationQueue({
      requestUrl: request.url,
      itemLimit,
      force,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        processed: false,
        processedCount: 0,
        failedCount: 0,
        message:
          error instanceof Error
            ? error.message
            : "The scheduled artwork worker failed.",
      },
      { status: 500 },
    );
  }
}
