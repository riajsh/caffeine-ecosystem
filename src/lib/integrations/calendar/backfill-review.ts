import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureRelationshipForProfile } from "@/lib/integrations/calendar/review-utils";
import { isBeyondCalendarLookahead } from "@/lib/integrations/calendar/env";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function backfillCalendarReviewsForProfile(
  supabase: AdminClient,
  params: {
    orgId: string;
    profileId: string;
    reviewIds: string[];
  },
): Promise<number> {
  let activitiesCreated = 0;

  const { data: reviews, error: reviewsError } = await supabase
    .from("calendar_participant_reviews")
    .select(
      `
      id,
      calendar_event_id,
      calendar_events (
        id,
        google_event_id,
        title,
        start_at
      )
    `,
    )
    .eq("org_id", params.orgId)
    .in("id", params.reviewIds);

  if (reviewsError) {
    throw new Error(`Failed to load review rows: ${reviewsError.message}`);
  }

  const relationshipId = await ensureRelationshipForProfile(
    supabase,
    params.orgId,
    params.profileId,
  );

  for (const review of reviews ?? []) {
    const event = review.calendar_events;
    if (!event) {
      continue;
    }

    if (isBeyondCalendarLookahead(event.start_at)) {
      continue;
    }

    const { data: existingActivity, error: activityError } = await supabase
      .from("activities")
      .select("id")
      .eq("org_id", params.orgId)
      .eq("profile_id", params.profileId)
      .eq("source", "calendar_sync")
      .eq("source_ref", event.google_event_id)
      .maybeSingle();

    if (activityError) {
      throw new Error(`Failed to check activity: ${activityError.message}`);
    }

    if (!existingActivity) {
      const { error: insertError } = await supabase.from("activities").insert({
        org_id: params.orgId,
        profile_id: params.profileId,
        activity_type: "meeting",
        title: event.title ?? "Calendar meeting",
        summary: null,
        activity_date: event.start_at ?? new Date().toISOString(),
        source: "calendar_sync",
        source_ref: event.google_event_id,
      });

      if (insertError) {
        throw new Error(`Failed to create activity: ${insertError.message}`);
      }

      activitiesCreated += 1;
    }

    const { data: existingSource, error: sourceError } = await supabase
      .from("relationship_sources")
      .select("id")
      .eq("relationship_id", relationshipId)
      .eq("source_type", "meeting")
      .eq("source_id", event.id)
      .maybeSingle();

    if (sourceError) {
      throw new Error(`Failed to check relationship source: ${sourceError.message}`);
    }

    if (!existingSource) {
      const { error: insertSourceError } = await supabase
        .from("relationship_sources")
        .insert({
          org_id: params.orgId,
          relationship_id: relationshipId,
          source_type: "meeting",
          source_id: event.id,
          source_label: event.title ?? "Calendar meeting",
        });

      if (insertSourceError) {
        throw new Error(
          `Failed to create relationship source: ${insertSourceError.message}`,
        );
      }
    }
  }

  return activitiesCreated;
}
