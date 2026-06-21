import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { calendarLookaheadCutoff } from "@/lib/integrations/calendar/env";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function purgeBeyondLookaheadCalendarData(
  supabase: AdminClient,
  orgId: string,
): Promise<{
  eventsRemoved: number;
  activitiesRemoved: number;
  sourcesRemoved: number;
}> {
  const cutoff = calendarLookaheadCutoff().toISOString();

  const { data: deletedByDate, error: byDateError } = await supabase
    .from("activities")
    .delete()
    .eq("org_id", orgId)
    .eq("source", "calendar_sync")
    .gt("activity_date", cutoff)
    .select("id");

  if (byDateError) {
    throw new Error(
      `Failed to remove far-future calendar activities: ${byDateError.message}`,
    );
  }

  const { data: farEvents, error: eventsError } = await supabase
    .from("calendar_events")
    .select("id, google_event_id")
    .eq("org_id", orgId)
    .gt("start_at", cutoff);

  if (eventsError) {
    throw new Error(
      `Failed to load far-future calendar events: ${eventsError.message}`,
    );
  }

  let activitiesFromEvents = 0;
  let sourcesRemoved = 0;
  let eventsRemoved = 0;

  if (farEvents?.length) {
    const googleEventIds = farEvents.map((event) => event.google_event_id);
    const eventIds = farEvents.map((event) => event.id);

    const { data: deletedByRef, error: refError } = await supabase
      .from("activities")
      .delete()
      .eq("org_id", orgId)
      .eq("source", "calendar_sync")
      .in("source_ref", googleEventIds)
      .select("id");

    if (refError) {
      throw new Error(
        `Failed to remove activities for far-future events: ${refError.message}`,
      );
    }

    activitiesFromEvents = deletedByRef?.length ?? 0;

    const { data: deletedSources, error: sourcesError } = await supabase
      .from("relationship_sources")
      .delete()
      .eq("org_id", orgId)
      .eq("source_type", "meeting")
      .in("source_id", eventIds)
      .select("id");

    if (sourcesError) {
      throw new Error(
        `Failed to remove far-future meeting provenance: ${sourcesError.message}`,
      );
    }

    sourcesRemoved = deletedSources?.length ?? 0;

    const { data: deletedEvents, error: deleteEventsError } = await supabase
      .from("calendar_events")
      .delete()
      .in("id", eventIds)
      .select("id");

    if (deleteEventsError) {
      throw new Error(
        `Failed to remove far-future calendar events: ${deleteEventsError.message}`,
      );
    }

    eventsRemoved = deletedEvents?.length ?? 0;
  }

  return {
    eventsRemoved,
    activitiesRemoved: (deletedByDate?.length ?? 0) + activitiesFromEvents,
    sourcesRemoved,
  };
}
