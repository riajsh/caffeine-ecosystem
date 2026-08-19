"use server";

import { revalidatePath } from "next/cache";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  createEventFromEventbrite,
  linkEventbriteEventToExisting,
} from "@/lib/data/eventbrite-events";
import type {
  MappableField,
  QuestionMappingList,
} from "@/lib/data/eventbrite-question-mappings";
import {
  listQuestionMappingsForEvent,
  saveQuestionMappings,
} from "@/lib/data/eventbrite-question-mappings";
import {
  bulkCreateProfilesFromReviews,
  bulkIgnoreReviews,
  resolveEventbriteReview,
  searchProfilesForEventbriteLink,
} from "@/lib/data/eventbrite-reviews";
import { resolveProfileUpdateReview } from "@/lib/data/eventbrite-profile-updates";
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

export async function bulkCreateProfilesFromReviewsAction(
  items: Array<{ reviewId: string; fullName: string; email: string }>,
  // We're on the /admin/eventbrite/review page while this runs, so each
  // revalidatePath() call forces Next to re-render that page's data and
  // stream it back as part of THIS action's response — worth doing once
  // the whole run finishes, but doing it on every small batch was adding
  // real, avoidable latency to each round trip. The client only passes
  // `true` for the very last batch.
  isFinalBatch = true,
) {
  if (items.length === 0) {
    return { createdCount: 0, errors: [] };
  }

  try {
    const result = await bulkCreateProfilesFromReviews(items);
    if (isFinalBatch) {
      revalidateEventbrite();
    }
    return result;
  } catch (error) {
    return {
      createdCount: 0,
      errors: [
        {
          reviewId: "",
          message: error instanceof Error ? error.message : "Bulk create failed",
        },
      ],
    };
  }
}

export async function bulkIgnoreReviewsAction(
  reviewIds: string[],
  isFinalBatch = true,
) {
  if (reviewIds.length === 0) {
    return { ignoredCount: 0, errors: [] };
  }

  try {
    const result = await bulkIgnoreReviews(reviewIds);
    if (isFinalBatch) {
      revalidateEventbrite();
    }
    return result;
  } catch (error) {
    return {
      ignoredCount: 0,
      errors: [
        {
          reviewId: "",
          message: error instanceof Error ? error.message : "Bulk ignore failed",
        },
      ],
    };
  }
}

export async function loadQuestionMappingsAction(
  caffeineEventId: string,
): Promise<{ result?: QuestionMappingList; error?: string }> {
  try {
    const result = await listQuestionMappingsForEvent(caffeineEventId);
    return { result };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to load questions",
    };
  }
}

export async function saveQuestionMappingsAction(
  caffeineEventId: string,
  mappings: Array<{
    eventbriteQuestionId: string;
    questionText: string;
    targetField: MappableField;
  }>,
) {
  try {
    await saveQuestionMappings(caffeineEventId, mappings);
    revalidateEventbrite();
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save mappings",
    };
  }
}

export async function resolveProfileUpdateReviewAction(formData: FormData) {
  const reviewId = formData.get("reviewId");
  const action = formData.get("action");

  if (typeof reviewId !== "string" || (action !== "apply" && action !== "ignore")) {
    return { error: "Invalid input" };
  }

  try {
    await resolveProfileUpdateReview(reviewId, action);
    revalidateEventbrite();
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update",
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
