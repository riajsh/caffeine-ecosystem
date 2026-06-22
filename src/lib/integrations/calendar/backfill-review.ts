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

    const { data: insertedActivities, error: activityError } = await supabase
      .from("activities")
      .upsert(
        {
          org_id: params.orgId,
          profile_id: params.profileId,
          activity_type: "meeting",
          title: event.title ?? "Calendar meeting",
          summary: null,
          activity_date: event.start_at ?? new Date().toISOString(),
          source: "calendar_sync",
          source_ref: event.google_event_id,
        },
        {
          onConflict: "org_id,profile_id,source,source_ref",
          ignoreDuplicates: true,
        },
      )
      .select("id");

    if (activityError) {
      throw new Error(`Failed to create activity: ${activityError.message}`);
    }

    if (insertedActivities && insertedActivities.length > 0) {
      activitiesCreated += 1;
    }

    const { error: insertSourceError } = await supabase
      .from("relationship_sources")
      .upsert(
        {
          org_id: params.orgId,
          relationship_id: relationshipId,
          source_type: "meeting",
          source_id: event.id,
          source_label: event.title ?? "Calendar meeting",
        },
        {
          onConflict: "relationship_id,source_type,source_id",
          ignoreDuplicates: true,
        },
      );

    if (insertSourceError) {
      throw new Error(
        `Failed to create relationship source: ${insertSourceError.message}`,
      );
    }
  }

  return activitiesCreated;
}
