import { NextResponse } from "next/server";
import {
  ensureDailyAutomationBatch,
  requeueFailedDailyAutomationItems,
} from "@/lib/nobody/automationService";
import { processDailyAutomationQueue } from "@/lib/nobody/automationWorker";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";
import { assertNobodyRuntimeReady } from "@/lib/nobody/runtimeConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type AutomationRequest = Readonly<{
  action?: unknown;
  enabled?: unknown;
}>;

async function requireEditor() {
  const access = await getStudioAccess();

  if (!access.authenticated) {
    return {
      response: NextResponse.json(
        { ok: false, message: "Please sign in again." },
        { status: 401 },
      ),
    } as const;
  }

  if (!access.authorized || access.admin.role === "reviewer") {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message:
            "Only a studio owner or editor can change the daily automation.",
        },
        { status: 403 },
      ),
    } as const;
  }

  return { admin: access.admin } as const;
}

function runtimeErrorResponse(error: unknown) {
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

export async function PATCH(request: Request) {
  const authorization = await requireEditor();

  if ("response" in authorization) return authorization.response;

  let body: AutomationRequest;

  try {
    body = (await request.json()) as AutomationRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "The automation request is invalid." },
      { status: 400 },
    );
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "Choose whether the daily automation is active." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const functionName = body.enabled
    ? "resume_nobody_daily_automation"
    : "pause_nobody_daily_automation";
  const { data, error } = await supabase.rpc(functionName);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error.message ||
          (body.enabled
            ? "Daily automation could not be enabled."
            : "Daily automation could not be paused."),
      },
      { status: 500 },
    );
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: authorization.admin.userId,
    action: body.enabled ? "automation.enabled" : "automation.paused",
    entity_type: "daily_artwork_automation",
    entity_id: "singleton",
    details: {
      enabled: body.enabled,
      scheduler_result: data,
    },
  });

  return NextResponse.json({
    ok: true,
    enabled: body.enabled,
    scheduler: data,
  });
}

export async function POST(request: Request) {
  const authorization = await requireEditor();

  if ("response" in authorization) return authorization.response;

  let body: AutomationRequest;

  try {
    body = (await request.json()) as AutomationRequest;
  } catch {
    return NextResponse.json(
      { ok: false, message: "The automation request is invalid." },
      { status: 400 },
    );
  }

  if (body.action === "prepare_today") {
    try {
      assertNobodyRuntimeReady();
      const result = await ensureDailyAutomationBatch({ force: true });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Today's artwork queue could not be prepared.",
        },
        { status: 500 },
      );
    }
  }

  if (body.action === "retry_failed") {
    try {
      const result = await requeueFailedDailyAutomationItems();
      return NextResponse.json({
        ok: true,
        ...result,
        message:
          result.requeuedCount > 0
            ? `${result.requeuedCount} failed artwork${result.requeuedCount === 1 ? "" : "s"} returned to the generation queue.`
            : "There are no failed artworks to retry.",
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "The failed artworks could not be queued again.",
        },
        { status: 500 },
      );
    }
  }

  if (body.action === "process_next" || body.action === "process_remaining") {
    try {
      assertNobodyRuntimeReady();
    } catch (error) {
      return runtimeErrorResponse(error);
    }

    try {
      const result = await processDailyAutomationQueue({
        requestUrl: request.url,
        force: true,
        itemLimit: body.action === "process_remaining" ? 3 : 1,
        automaticRetry: false,
      });

      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "The daily artwork queue could not be processed.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { ok: false, message: "Choose a valid automation action." },
    { status: 400 },
  );
}
