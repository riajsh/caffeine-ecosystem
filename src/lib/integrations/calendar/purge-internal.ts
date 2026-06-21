import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isInternalParticipant,
  type OrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function purgeInternalCalendarSyncData(
  supabase: AdminClient,
  orgId: string,
  filters: OrgParticipantFilters,
): Promise<{ activitiesRemoved: number; reviewsRemoved: number; sourcesRemoved: number }> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("org_id", orgId);

  if (profilesError) {
    throw new Error(`Failed to load profiles for cleanup: ${profilesError.message}`);
  }

  const internalProfileIds = (profiles ?? [])
    .filter(
      (profile) =>
        profile.email && isInternalParticipant(profile.email, filters),
    )
    .map((profile) => profile.id);

  let activitiesRemoved = 0;
  let sourcesRemoved = 0;
  let reviewsRemoved = 0;

  if (internalProfileIds.length > 0) {
    const { data: deletedActivities, error: activitiesError } = await supabase
      .from("activities")
      .delete()
      .eq("org_id", orgId)
      .eq("source", "calendar_sync")
      .in("profile_id", internalProfileIds)
      .select("id");

    if (activitiesError) {
      throw new Error(
        `Failed to remove internal calendar activities: ${activitiesError.message}`,
      );
    }

    activitiesRemoved = deletedActivities?.length ?? 0;

    const { data: relationships, error: relationshipsError } = await supabase
      .from("relationships")
      .select("id")
      .eq("org_id", orgId)
      .in("profile_id", internalProfileIds);

    if (relationshipsError) {
      throw new Error(
        `Failed to load internal relationships for cleanup: ${relationshipsError.message}`,
      );
    }

    const relationshipIds = (relationships ?? []).map((row) => row.id);

    if (relationshipIds.length > 0) {
      const { data: calendarEvents, error: calendarEventsError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("org_id", orgId);

      if (calendarEventsError) {
        throw new Error(
          `Failed to load calendar events for cleanup: ${calendarEventsError.message}`,
        );
      }

      const calendarEventIds = (calendarEvents ?? []).map((row) => row.id);

      if (calendarEventIds.length > 0) {
        const { data: deletedSources, error: sourcesError } = await supabase
          .from("relationship_sources")
          .delete()
          .eq("org_id", orgId)
          .eq("source_type", "meeting")
          .in("relationship_id", relationshipIds)
          .in("source_id", calendarEventIds)
          .select("id");

        if (sourcesError) {
          throw new Error(
            `Failed to remove internal meeting provenance: ${sourcesError.message}`,
          );
        }

        sourcesRemoved = deletedSources?.length ?? 0;
      }
    }
  }

  const { data: pendingReviews, error: reviewsError } = await supabase
    .from("calendar_participant_reviews")
    .select("id, email")
    .eq("org_id", orgId)
    .eq("status", "pending");

  if (reviewsError) {
    throw new Error(
      `Failed to load pending calendar reviews for cleanup: ${reviewsError.message}`,
    );
  }

  const reviewIdsToRemove = (pendingReviews ?? [])
    .filter((review) => isInternalParticipant(review.email, filters))
    .map((review) => review.id);

  if (reviewIdsToRemove.length > 0) {
    const { data: deletedReviews, error: deleteReviewsError } = await supabase
      .from("calendar_participant_reviews")
      .delete()
      .in("id", reviewIdsToRemove)
      .select("id");

    if (deleteReviewsError) {
      throw new Error(
        `Failed to remove internal calendar reviews: ${deleteReviewsError.message}`,
      );
    }

    reviewsRemoved = deletedReviews?.length ?? 0;
  }

  return { activitiesRemoved, reviewsRemoved, sourcesRemoved };
}
