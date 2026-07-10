import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./server";

export type StudioAdmin = Readonly<{
  userId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "editor" | "reviewer";
}>;

export type StudioAccessResult =
  | Readonly<{
      authenticated: false;
      authorized: false;
      admin: null;
    }>
  | Readonly<{
      authenticated: true;
      authorized: false;
      admin: null;
    }>
  | Readonly<{
      authenticated: true;
      authorized: true;
      admin: StudioAdmin;
    }>;

export async function getStudioAccess(): Promise<StudioAccessResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string" || !userId) {
    return {
      authenticated: false,
      authorized: false,
      admin: null,
    };
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("studio_admins")
    .select("user_id,email,display_name,role,is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !adminRow) {
    return {
      authenticated: true,
      authorized: false,
      admin: null,
    };
  }

  const role = adminRow.role;

  if (
    role !== "owner" &&
    role !== "editor" &&
    role !== "reviewer"
  ) {
    return {
      authenticated: true,
      authorized: false,
      admin: null,
    };
  }

  return {
    authenticated: true,
    authorized: true,
    admin: {
      userId: adminRow.user_id,
      email: adminRow.email,
      displayName: adminRow.display_name,
      role,
    },
  };
}

export async function requireStudioAdmin() {
  const access = await getStudioAccess();

  if (!access.authenticated) {
    redirect("/studio/login");
  }

  if (!access.authorized) {
    redirect("/studio/login?error=not-authorized");
  }

  return access.admin;
}