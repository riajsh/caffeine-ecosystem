import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

/** Remove derived calendar data when an event is cancelled or removed from sync. */
export async function removeCalendarEventDerivedData(
  supabase: AdminClient,
  orgId: string,
  eventId: string,
  googleEventId: string,
): Promise<void> {
  const { error: activitiesError } = await supabase
    .from("activities")
    .delete()
    .eq("org_id", orgId)
    .eq("source", "calendar_sync")
    .eq("source_ref", googleEventId);

  if (activitiesError) {
    throw new Error(
      `Failed to remove calendar activities for cancelled event: ${activitiesError.message}`,
    );
  }

  const { error: reviewsError } = await supabase
    .from("calendar_participant_reviews")
    .delete()
    .eq("org_id", orgId)
    .eq("calendar_event_id", eventId)
    .eq("status", "pending");

  if (reviewsError) {
    throw new Error(
      `Failed to remove calendar reviews for cancelled event: ${reviewsError.message}`,
    );
  }

  const { error: sourcesError } = await supabase
    .from("relationship_sources")
    .delete()
    .eq("org_id", orgId)
    .eq("source_type", "meeting")
    .eq("source_id", eventId);

  if (sourcesError) {
    throw new Error(
      `Failed to remove meeting provenance for cancelled event: ${sourcesError.message}`,
    );
  }
}
