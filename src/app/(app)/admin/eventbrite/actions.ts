"use server";

import { revalidatePath } from "next/cache";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  createEventFromEventbrite,
  linkEventbriteEventToExisting,
} from "@/lib/data/eventbrite-events";
import {
  resolveEventbriteReview,
  searchProfilesForEventbriteLink,
} from "@/lib/data/eventbrite-reviews";
import { syncEventbriteAttendeesForOrg } from "@/lib/integrations/eventbrite/sync";
import {
  linkEventbriteEventSchema,
  resolveEventbriteReviewSchema,
} from "@/lib/validators/eventbrite";

function revalidateEventbrite() {
  revalidatePath("/admin");
  revalidatePath("/admin/eventbrite/events");
  revalidatePath("/admin/eventbrite/review");
  revalidatePath("/events");
  revalidatePath("/profiles");
}

export async function linkEventbriteEventAction(formData: FormData) {
  const parsed = linkEventbriteEventSchema.safeParse({
    eventbriteEventId: formData.get("eventbriteEventId"),
    eventbriteTitle: formData.get("eventbriteTitle"),
    eventbriteStartIso: formData.get("eventbriteStartIso") ?? undefined,
    mode: formData.get("mode"),
    caffeineEventId: formData.get("caffeineEventId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    if (parsed.data.mode === "existing" && parsed.data.caffeineEventId) {
      await linkEventbriteEventToExisting(
        parsed.data.eventbriteEventId,
        parsed.data.caffeineEventId,
      );
    } else {
      await createEventFromEventbrite(
        parsed.data.eventbriteEventId,
        parsed.data.eventbriteTitle,
        parsed.data.eventbriteStartIso,
      );
    }

    revalidateEventbrite();
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to link event",
    };
  }
}

export async function syncEventbriteNowAction() {
  await requireAdmin();
  const orgId = await getOrgId();

  try {
    const stats = await syncEventbriteAttendeesForOrg(orgId, "all");
    revalidateEventbrite();
    return { success: true as const, stats };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

export async function resolveEventbriteReviewAction(formData: FormData) {
  const parsed = resolveEventbriteReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    action: formData.get("action"),
    profileId: formData.get("profileId") || undefined,
    fullName: formData.get("fullName") || undefined,
    email: formData.get("email") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await resolveEventbriteReview(parsed.data);
    revalidateEventbrite();
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update review",
    };
  }
}

export async function searchProfilesForEventbriteLinkAction(query: string) {
  try {
    const results = await searchProfilesForEventbriteLink(query);
    return { results };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Search failed",
      results: [],
    };
  }
}
