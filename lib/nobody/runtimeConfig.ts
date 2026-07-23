import "server-only";

const SUPPORTED_IMAGE_MODELS = new Set([
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
]);

const SUPPORTED_TEXT_MODELS = new Set(["gpt-5.6-luna"]);

export type NobodyRuntimeReadiness = Readonly<{
  ready: boolean;
  missing: readonly string[];
  invalid: readonly string[];
}>;

function looksLikePlaceholder(value: string) {
  return /(?:^|[._/-])(your|replace|placeholder|example|test)(?:[._/-]|$)/i.test(
    value,
  );
}

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getNobodyRuntimeReadiness(): NobodyRuntimeReadiness {
  const missing: string[] = [];
  const invalid: string[] = [];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const imageModel = process.env.OPENAI_IMAGE_MODEL?.trim() ?? "";
  const reviewModel = process.env.OPENAI_REVIEW_MODEL?.trim() ?? "";
  const plannerModel = process.env.OPENAI_PLANNER_MODEL?.trim() ?? "";
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (!siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabasePublishableKey)
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) missing.push("OPENAI_API_KEY");
  if (!imageModel) missing.push("OPENAI_IMAGE_MODEL");
  if (!reviewModel) missing.push("OPENAI_REVIEW_MODEL");
  if (!plannerModel) missing.push("OPENAI_PLANNER_MODEL");
  if (!cronSecret) missing.push("CRON_SECRET");

  if (imageModel && !SUPPORTED_IMAGE_MODELS.has(imageModel)) {
    invalid.push("OPENAI_IMAGE_MODEL");
  }

  if (reviewModel && !SUPPORTED_TEXT_MODELS.has(reviewModel)) {
    invalid.push("OPENAI_REVIEW_MODEL");
  }

  if (plannerModel && !SUPPORTED_TEXT_MODELS.has(plannerModel)) {
    invalid.push("OPENAI_PLANNER_MODEL");
  }

  if (
    apiKey &&
    (!apiKey.startsWith("sk-") || apiKey.length < 20 || looksLikePlaceholder(apiKey))
  ) {
    invalid.push("OPENAI_API_KEY");
  }

  if (
    supabasePublishableKey &&
    (supabasePublishableKey.length < 20 ||
      looksLikePlaceholder(supabasePublishableKey))
  ) {
    invalid.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (
    supabaseServiceRoleKey &&
    (supabaseServiceRoleKey.length < 20 ||
      looksLikePlaceholder(supabaseServiceRoleKey))
  ) {
    invalid.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (
    cronSecret &&
    (cronSecret.length < 32 || looksLikePlaceholder(cronSecret))
  ) {
    invalid.push("CRON_SECRET");
  }

  if (
    siteUrl &&
    (!isAbsoluteHttpUrl(siteUrl) || looksLikePlaceholder(siteUrl))
  ) {
    invalid.push("NEXT_PUBLIC_SITE_URL");
  }

  if (
    supabaseUrl &&
    (!isAbsoluteHttpUrl(supabaseUrl) || looksLikePlaceholder(supabaseUrl))
  ) {
    invalid.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

export function assertNobodyRuntimeReady() {
  const readiness = getNobodyRuntimeReadiness();

  if (!readiness.ready) {
    const details = [
      readiness.missing.length
        ? `Missing: ${readiness.missing.join(", ")}.`
        : "",
      readiness.invalid.length
        ? `Invalid: ${readiness.invalid.join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    throw new Error(`Studio runtime configuration is invalid. ${details}`);
  }

  return readiness;
}
