import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatCalendarSourceLabel } from "@/lib/integrations/calendar/source-label";
import type { Database } from "@/types/database";

type CalendarEventSourceRow = {
  google_event_id: string;
  ical_uid: string | null;
  start_at: string | null;
  source_calendar_id: string | null;
  calendar_accounts: {
    email: string;
    users: { full_name: string } | null;
  } | null;
};

const CALENDAR_EVENT_SOURCE_SELECT = `
  google_event_id,
  ical_uid,
  start_at,
  source_calendar_id,
  calendar_accounts (
    email,
    users (
      full_name
    )
  )
`;

function parseOccurrenceSourceRef(
  sourceRef: string,
): { icalUid: string; startAt: string } | null {
  const separatorIndex = sourceRef.indexOf("#");
  if (separatorIndex <= 0 || separatorIndex === sourceRef.length - 1) {
    return null;
  }

  return {
    icalUid: sourceRef.slice(0, separatorIndex),
    startAt: sourceRef.slice(separatorIndex + 1),
  };
}

export async function resolveCalendarSourceLabelsForRefs(
  supabase: SupabaseClient<Database>,
  orgId: string,
  sourceRefs: string[],
): Promise<Map<string, string>> {
  const uniqueRefs = [...new Set(sourceRefs.map((ref) => ref.trim()).filter(Boolean))];
  const labels = new Map<string, string>();

  if (uniqueRefs.length === 0) {
    return labels;
  }

  const googleEventIds: string[] = [];
  const occurrenceRefs: Array<{ sourceRef: string; icalUid: string; startAt: string }> =
    [];

  for (const sourceRef of uniqueRefs) {
    const occurrence = parseOccurrenceSourceRef(sourceRef);
    if (occurrence) {
      occurrenceRefs.push({ sourceRef, ...occurrence });
    } else {
      googleEventIds.push(sourceRef);
    }
  }

  if (googleEventIds.length > 0) {
    const { data, error } = await supabase
      .from("calendar_events")
      .select(CALENDAR_EVENT_SOURCE_SELECT)
      .eq("org_id", orgId)
      .in("google_event_id", googleEventIds);

    if (error) {
      throw new Error(`Failed to load calendar events: ${error.message}`);
    }

    for (const row of (data ?? []) as CalendarEventSourceRow[]) {
      const label = formatCalendarSourceLabel(row);
      if (label) {
        labels.set(row.google_event_id, label);
      }
    }
  }

  if (occurrenceRefs.length > 0) {
    const icalUids = [...new Set(occurrenceRefs.map((entry) => entry.icalUid))];
    const { data, error } = await supabase
      .from("calendar_events")
      .select(CALENDAR_EVENT_SOURCE_SELECT)
      .eq("org_id", orgId)
      .in("ical_uid", icalUids);

    if (error) {
      throw new Error(`Failed to load calendar occurrences: ${error.message}`);
    }

    const rowsByOccurrence = new Map<string, CalendarEventSourceRow>();
    for (const row of (data ?? []) as CalendarEventSourceRow[]) {
      if (!row.ical_uid || !row.start_at) {
        continue;
      }

      rowsByOccurrence.set(`${row.ical_uid}#${row.start_at}`, row);
    }

    for (const occurrence of occurrenceRefs) {
      const row = rowsByOccurrence.get(occurrence.sourceRef);
      if (!row) {
        continue;
      }

      const label = formatCalendarSourceLabel(row);
      if (label) {
        labels.set(occurrence.sourceRef, label);
      }
    }
  }

  return labels;
}
