import process from "node:process";

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_REVIEW_MODEL",
  "OPENAI_PLANNER_MODEL",
  "CRON_SECRET",
];

const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = [];

function looksLikePlaceholder(value) {
  return /(?:^|[._/-])(your|replace|placeholder|example|test)(?:[._/-]|$)/i.test(
    value,
  );
}

if (
  process.env.CRON_SECRET &&
  (process.env.CRON_SECRET.trim().length < 32 ||
    looksLikePlaceholder(process.env.CRON_SECRET.trim()))
) {
  invalid.push("CRON_SECRET must be a real random value of at least 32 characters");
}

if (
  process.env.OPENAI_API_KEY &&
  (!process.env.OPENAI_API_KEY.trim().startsWith("sk-") ||
    process.env.OPENAI_API_KEY.trim().length < 20 ||
    looksLikePlaceholder(process.env.OPENAI_API_KEY.trim()))
) {
  invalid.push("OPENAI_API_KEY is not a valid production key value");
}

for (const name of [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  const value = process.env[name]?.trim();
  if (value && (value.length < 20 || looksLikePlaceholder(value))) {
    invalid.push(`${name} is not a valid production value`);
  }
}

if (
  process.env.OPENAI_IMAGE_MODEL &&
  !["gpt-image-2", "gpt-image-2-2026-04-21"].includes(
    process.env.OPENAI_IMAGE_MODEL.trim(),
  )
) {
  invalid.push("OPENAI_IMAGE_MODEL is unsupported");
}

for (const name of ["OPENAI_REVIEW_MODEL", "OPENAI_PLANNER_MODEL"]) {
  if (process.env[name] && process.env[name].trim() !== "gpt-5.6-luna") {
    invalid.push(`${name} must be gpt-5.6-luna`);
  }
}

try {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      looksLikePlaceholder(process.env.NEXT_PUBLIC_SITE_URL.trim())
    ) {
      invalid.push("NEXT_PUBLIC_SITE_URL must be the real absolute site URL");
    }
  }
} catch {
  invalid.push("NEXT_PUBLIC_SITE_URL must be a valid absolute URL");
}

try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      looksLikePlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL.trim())
    ) {
      invalid.push("NEXT_PUBLIC_SUPABASE_URL must be the real project URL");
    }
  }
} catch {
  invalid.push("NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL");
}

if (missing.length || invalid.length) {
  console.error(
    [
      "I AM NOBODY production configuration validation failed.",
      missing.length ? `Missing: ${missing.join(", ")}.` : "",
      ...invalid,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  process.exit(1);
}

console.log("I AM NOBODY production configuration validated.");
