"use server";

import { revalidatePath } from "next/cache";

import { getOrgId, requireAdmin, requireUser } from "@/lib/auth/session";
import { backfillCalendarReviewsForProfile } from "@/lib/integrations/calendar/backfill-review";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";

async function resolvePendingReviewsForEmail(
  email: string,
  status: "linked" | "created" | "ignored",
  profileId?: string,
) {
  const user = await requireUser();
  const orgId = await getOrgId();
  const supabase = createAdminClient();

  const { data: pendingReviews, error: pendingError } = await supabase
    .from("calendar_participant_reviews")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .eq("status", "pending");

  if (pendingError) {
    throw new Error(`Failed to load pending reviews: ${pendingError.message}`);
  }

  const reviewIds = (pendingReviews ?? []).map((row) => row.id);
  if (reviewIds.length === 0) {
    return { reviewCount: 0, activitiesCreated: 0, profileId: profileId ?? null };
  }

  if (status !== "ignored" && profileId) {
    await backfillCalendarReviewsForProfile(supabase, {
      orgId,
      profileId,
      reviewIds,
    });
  }

  const { error: updateError } = await supabase
    .from("calendar_participant_reviews")
    .update({
      status,
      profile_id: status === "ignored" ? null : profileId,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("email", email)
    .eq("status", "pending");

  if (updateError) {
    throw new Error(`Failed to update review rows: ${updateError.message}`);
  }

  return {
    reviewCount: reviewIds.length,
    activitiesCreated: status === "ignored" ? 0 : reviewIds.length,
    profileId: profileId ?? null,
  };
}

export async function createProfileFromCalendarReviewAction(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const fullName =
    displayName || email.split("@")[0]?.replace(/[._]/g, " ") || email;

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    const orgId = await getOrgId();
    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .ilike("email", email)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing profile: ${existingError.message}`);
    }

    let profileId = existing?.id;

    if (!profileId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          org_id: orgId,
          full_name: fullName,
          email,
          source: "manual",
          organisation_name_normalised: normaliseOrganisationName(null),
        })
        .select("id")
        .single();

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      profileId = profile.id;
    }

    const result = await resolvePendingReviewsForEmail(email, "created", profileId);

    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");
    revalidatePath("/profiles");

    return { success: true as const, ...result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create profile",
    };
  }
}

export async function linkCalendarReviewAction(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!email || !profileId) {
    return { error: "Email and profile are required" };
  }

  try {
    const orgId = await getOrgId();
    const supabase = createAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("org_id", orgId)
      .eq("id", profileId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to verify profile: ${profileError.message}`);
    }

    if (!profile) {
      return { error: "Profile not found" };
    }

    const result = await resolvePendingReviewsForEmail(email, "linked", profileId);

    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");
    revalidatePath(`/profiles/${profileId}`);

    return { success: true as const, ...result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to link profile",
    };
  }
}

export async function ignoreCalendarReviewAction(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    const result = await resolvePendingReviewsForEmail(email, "ignored");

    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");

    return { success: true as const, ...result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to ignore participant",
    };
  }
}

export async function searchProfilesForCalendarLinkAction(query: string) {
  await requireAdmin();

  const { searchProfilesForCalendarLink } = await import(
    "@/lib/data/calendar-sync-review"
  );

  try {
    const profiles = await searchProfilesForCalendarLink(query);
    return { success: true as const, profiles };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Search failed",
      profiles: [],
    };
  }
}
