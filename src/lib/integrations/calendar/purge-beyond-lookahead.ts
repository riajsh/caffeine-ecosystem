import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { calendarLookaheadCutoff } from "@/lib/integrations/calendar/env";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function purgeBeyondLookaheadCalendarData(
  supabase: AdminClient,
  orgId: string,
): Promise<{ eventsRemoved: number; activitiesRemoved: number }> {
  const cutoff = calendarLookaheadCutoff().toISOString();

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

  if (!farEvents?.length) {
    return { eventsRemoved: 0, activitiesRemoved: 0 };
  }

  const googleEventIds = farEvents.map((event) => event.google_event_id);
  let activitiesRemoved = 0;

  const { data: deletedActivities, error: activitiesError } = await supabase
    .from("activities")
    .delete()
    .eq("org_id", orgId)
    .eq("source", "calendar_sync")
    .in("source_ref", googleEventIds)
    .select("id");

  if (activitiesError) {
    throw new Error(
      `Failed to remove far-future calendar activities: ${activitiesError.message}`,
    );
  }

  activitiesRemoved = deletedActivities?.length ?? 0;

  const eventIds = farEvents.map((event) => event.id);
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

  return {
    eventsRemoved: deletedEvents?.length ?? 0,
    activitiesRemoved,
  };
}
