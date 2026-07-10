import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnvironment } from "./env";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } =
    getSupabaseServerEnvironment();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}