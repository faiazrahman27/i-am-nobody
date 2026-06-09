import { isLegalSlug, legalPageResponse } from "@/lib/legalPages";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ policy: string }> },
) {
  const { policy } = await context.params;

  if (!isLegalSlug(policy)) {
    return new Response("Not found", { status: 404 });
  }

  return legalPageResponse(policy, "en");
}
