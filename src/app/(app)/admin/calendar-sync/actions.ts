"use server";

import { revalidatePath } from "next/cache";

import { getOrgId, requireAdmin, requireUser } from "@/lib/auth/session";
import { createCalendarParticipantProfile } from "@/lib/integrations/calendar/create-participant-profile";
import {
  isInternalParticipant,
  loadOrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import { resolveCalendarReviewsForEmail } from "@/lib/integrations/calendar/resolve-calendar-reviews";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createProfileFromCalendarReviewAction(formData: FormData) {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const organisationName = String(formData.get("organisationName") ?? "").trim();
  const occupation = String(formData.get("occupation") ?? "").trim();
  const fullName =
    displayName || email.split("@")[0]?.replace(/[._]/g, " ") || email;

  if (!email) {
    return { error: "Email is required" };
  }

  const orgId = await getOrgId();
  const filters = await loadOrgParticipantFilters(createAdminClient(), orgId);
  if (isInternalParticipant(email, filters)) {
    return { error: "That address is internal to your organisation" };
  }

  try {
    const user = await requireUser();
    const supabase = createAdminClient();

    const profileId = await createCalendarParticipantProfile(supabase, {
      orgId,
      email,
      fullName,
      organisationName,
      occupation,
    });

    const result = await resolveCalendarReviewsForEmail(supabase, {
      orgId,
      email,
      status: "created",
      profileId,
      reviewedByUserId: user.id,
    });

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
    const user = await requireUser();
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

    const result = await resolveCalendarReviewsForEmail(supabase, {
      orgId,
      email,
      status: "linked",
      profileId,
      reviewedByUserId: user.id,
    });

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
    const user = await requireUser();
    const orgId = await getOrgId();
    const supabase = createAdminClient();

    const result = await resolveCalendarReviewsForEmail(supabase, {
      orgId,
      email,
      status: "ignored",
      reviewedByUserId: user.id,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");

    return { success: true as const, ...result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to ignore participant",
    };
  }
}

export async function ignoreAllInternalCalendarReviewsAction() {
  await requireAdmin();

  try {
    const user = await requireUser();
    const orgId = await getOrgId();
    const supabase = createAdminClient();
    const filters = await loadOrgParticipantFilters(supabase, orgId);

    const { data: pendingReviews, error: pendingError } = await supabase
      .from("calendar_participant_reviews")
      .select("email")
      .eq("org_id", orgId)
      .eq("status", "pending");

    if (pendingError) {
      throw new Error(`Failed to load pending reviews: ${pendingError.message}`);
    }

    const internalEmails = new Set<string>();

    for (const row of pendingReviews ?? []) {
      if (isInternalParticipant(row.email, filters)) {
        internalEmails.add(row.email.toLowerCase());
      }
    }

    let ignoredCount = 0;

    for (const email of internalEmails) {
      const result = await resolveCalendarReviewsForEmail(supabase, {
        orgId,
        email,
        status: "ignored",
        reviewedByUserId: user.id,
      });
      ignoredCount += result.reviewCount;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");

    return { success: true as const, ignoredCount };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to ignore internal participants",
    };
  }
}

export async function searchProfilesForCalendarLinkAction(
  query: string,
  calendarEmail?: string,
) {
  await requireAdmin();

  const { searchProfilesForCalendarLink } = await import(
    "@/lib/data/calendar-sync-review"
  );

  try {
    const result = await searchProfilesForCalendarLink(query, calendarEmail);
    return { success: true as const, ...result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Search failed",
      profiles: [],
      exactEmailMatch: false,
    };
  }
}
