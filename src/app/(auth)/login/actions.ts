"use server";

import { redirect } from "next/navigation";

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
    loginRedirect(error.message);
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

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/login?error=missing_email");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=check_email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
