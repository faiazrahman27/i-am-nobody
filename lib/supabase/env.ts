export type SupabasePublicEnvironment = Readonly<{
  url: string;
  publishableKey: string;
}>;

export type SupabaseServerEnvironment = SupabasePublicEnvironment &
  Readonly<{
    serviceRoleKey: string;
  }>;

function requireEnvironmentValue(
  name: string,
  value: string | undefined,
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `Missing required environment variable: ${name}.`,
    );
  }

  return normalized;
}

export function getSupabasePublicEnvironment(): SupabasePublicEnvironment {
  return {
    url: requireEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requireEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function getSupabaseServerEnvironment(): SupabaseServerEnvironment {
  const publicEnvironment = getSupabasePublicEnvironment();

  return {
    ...publicEnvironment,
    serviceRoleKey: requireEnvironmentValue(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}