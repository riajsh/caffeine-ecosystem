"use server";

import { redirect } from "next/navigation";

import { getPrimaryLoginDomain } from "@/lib/auth/allowed-email";
import { formatLoginError } from "@/lib/auth/login-errors";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { ensureUserRow } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(error: string): never {
  redirect(`/login?error=${encodeURIComponent(error)}`);
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    loginRedirect("Enter your email address.");
  }

  if (!password) {
    loginRedirect("Enter your password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    loginRedirect(formatLoginError(error.message));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authedUser = user;
  if (!authedUser) {
    loginRedirect("Sign-in succeeded but no user session was created.");
  }

  try {
    await ensureUserRow(authedUser);
  } catch (bootstrapError) {
    const message =
      bootstrapError instanceof Error
        ? bootstrapError.message
        : "Failed to bootstrap user account.";
    loginRedirect(message);
  }

  redirect("/");
}

export async function signInWithGoogle(formData: FormData) {
  const next = getSafeRedirectPath(String(formData.get("next") ?? ""));
  const redirectTo = new URL(`${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`);
  if (next !== "/") {
    redirectTo.searchParams.set("next", next);
  }

  const primaryDomain = getPrimaryLoginDomain();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      ...(primaryDomain
        ? { queryParams: { hd: primaryDomain } }
        : undefined),
    },
  });

  if (error) {
    loginRedirect(formatLoginError(error.message));
  }

  if (!data.url) {
    loginRedirect("Google sign-in could not be started.");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
