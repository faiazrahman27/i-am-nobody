import { NextResponse } from "next/server";
import { ensureDailyAutomationBatch } from "@/lib/nobody/automationService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudioAccess } from "@/lib/supabase/studioAccess";

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
    return { response: NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 }) } as const;
  }

  if (!access.authorized || access.admin.role === "reviewer") {
    return { response: NextResponse.json({ ok: false, message: "Only a studio owner or editor can change the daily automation." }, { status: 403 }) } as const;
  }

  return { admin: access.admin } as const;
}

export async function PATCH(request: Request) {
  const authorization = await requireEditor();

  if ("response" in authorization) return authorization.response;

  let body: AutomationRequest;

  try {
    body = (await request.json()) as AutomationRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "The automation request is invalid." }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, message: "Choose whether the daily automation is active." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("daily_artwork_automation")
    .update({ is_enabled: body.enabled })
    .eq("singleton", true);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  await supabase.from("studio_audit_log").insert({
    actor_user_id: authorization.admin.userId,
    action: body.enabled ? "automation.enabled" : "automation.paused",
    entity_type: "daily_artwork_automation",
    entity_id: "singleton",
    details: { enabled: body.enabled },
  });

  return NextResponse.json({ ok: true, enabled: body.enabled });
}

export async function POST(request: Request) {
  const authorization = await requireEditor();

  if ("response" in authorization) return authorization.response;

  let body: AutomationRequest;

  try {
    body = (await request.json()) as AutomationRequest;
  } catch {
    return NextResponse.json({ ok: false, message: "The automation request is invalid." }, { status: 400 });
  }

  if (body.action === "prepare_today") {
    try {
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

  if (body.action === "process_next") {
    const secret = process.env.CRON_SECRET?.trim();

    if (!secret || secret.length < 32) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Add the scheduled-worker secret before running the daily queue.",
        },
        { status: 503 },
      );
    }

    try {
      const origin = new URL(request.url).origin;
      const response = await fetch(`${origin}/api/automation/daily-artworks?limit=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}` },
        cache: "no-store",
        signal: AbortSignal.timeout(295_000),
      });
      const payload = await response.json();
      return NextResponse.json(payload, { status: response.status });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "The next daily artwork could not be processed.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: false, message: "Choose a valid automation action." }, { status: 400 });
}
