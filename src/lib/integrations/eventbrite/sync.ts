import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ensureEventAttendanceEvidence,
  findOrCreateEventTag,
  linkProfileToTag,
} from "@/lib/data/events";
import { getDecryptedEventbriteTokenForSync } from "@/lib/data/eventbrite-accounts";
import { listEventAttendees } from "@/lib/integrations/eventbrite/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export type EventbriteSyncStats = {
  eventsProcessed: number;
  attendeesMatched: number;
  attendeesQueuedForReview: number;
  errors: string[];
};

async function findProfileIdByEmail(
  supabase: AdminClient,
  orgId: string,
  email: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up profile: ${error.message}`);
  }

  return data?.id ?? null;
}

/** Adds the attendee if not already recorded. Never downgrades an
 * existing "Attended" row back to "Registered" on a re-sync. */
async function ensureAttendeeRow(
  supabase: AdminClient,
  orgId: string,
  eventId: string,
  profileId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("event_attendees")
    .select("id")
    .eq("org_id", orgId)
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from("event_attendees").insert({
    org_id: orgId,
    event_id: eventId,
    profile_id: profileId,
    attended: false,
  });

  if (error && error.code !== "23505") {
    throw new Error(`Failed to add attendee: ${error.message}`);
  }
}

type MappedEvent = {
  id: string;
  title: string;
  event_date: string;
  eventbrite_event_id: string;
};

async function syncAttendeesForEvent(
  supabase: AdminClient,
  orgId: string,
  event: MappedEvent,
  token: string,
  systemUserId: string,
): Promise<{ matched: number; queued: number }> {
  const attendees = await listEventAttendees(token, event.eventbrite_event_id);

  let tagId: string | null = null;
  let tagFetched = false;
  let matched = 0;
  let queued = 0;

  for (const attendee of attendees) {
    if (!attendee.email) {
      // No email on the ticket — nothing to match or review against.
      continue;
    }

    const profileId = await findProfileIdByEmail(supabase, orgId, attendee.email);

    if (profileId) {
      await ensureAttendeeRow(supabase, orgId, event.id, profileId);
      await ensureEventAttendanceEvidence(
        orgId,
        event,
        profileId,
        systemUserId,
        supabase,
      );

      if (!tagFetched) {
        const tagResult = await findOrCreateEventTag(supabase, orgId, event.title);
        tagId = tagResult.tagId;
        tagFetched = true;
      }
      if (tagId) {
        await linkProfileToTag(supabase, orgId, profileId, tagId);
      }

      matched += 1;
      continue;
    }

    const { error } = await supabase.from("eventbrite_attendee_reviews").insert({
      org_id: orgId,
      event_id: event.id,
      eventbrite_attendee_id: attendee.id,
      email: attendee.email,
      display_name: attendee.name,
      ticket_type: attendee.ticketType,
    });

    // 23505 = we've already recorded this exact attendee before (whether
    // still pending review or already resolved) — nothing new to do.
    if (!error) {
      queued += 1;
    } else if (error.code !== "23505") {
      throw new Error(`Failed to queue attendee for review: ${error.message}`);
    }
  }

  return { matched, queued };
}

const NEAR_TERM_WINDOW_DAYS = 14;
const RECENTLY_FINISHED_WINDOW_HOURS = 48;

function isNearTermEvent(eventDateIso: string): boolean {
  const eventTime = new Date(eventDateIso).getTime();
  const now = Date.now();
  const windowMs = NEAR_TERM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentMs = RECENTLY_FINISHED_WINDOW_HOURS * 60 * 60 * 1000;
  return eventTime >= now - recentMs && eventTime <= now + windowMs;
}

/**
 * Syncs attendees for every Eventbrite-mapped event in one org.
 *
 * `tier: "near_term"` only processes events happening soon or that just
 * finished (the cron runs this every 30 minutes). `tier: "all"` processes
 * every mapped event regardless of date (used by the manual "Sync now"
 * button, and by a slower daily catch-all pass for older events).
 */
export async function syncEventbriteAttendeesForOrg(
  orgId: string,
  tier: "near_term" | "all" = "all",
): Promise<EventbriteSyncStats> {
  const stats: EventbriteSyncStats = {
    eventsProcessed: 0,
    attendeesMatched: 0,
    attendeesQueuedForReview: 0,
    errors: [],
  };

  const token = await getDecryptedEventbriteTokenForSync(orgId);
  if (!token) {
    return stats;
  }

  const supabase = createAdminClient();

  const { data: mappedEvents, error } = await supabase
    .from("events")
    .select("id, title, event_date, eventbrite_event_id")
    .eq("org_id", orgId)
    .not("eventbrite_event_id", "is", null);

  if (error) {
    throw new Error(`Failed to load mapped events: ${error.message}`);
  }

  const { data: connector } = await supabase
    .from("eventbrite_accounts")
    .select("connected_by")
    .eq("org_id", orgId)
    .maybeSingle();

  const systemUserId = connector?.connected_by;
  if (!systemUserId) {
    stats.errors.push("No connected Eventbrite account found for this org.");
    return stats;
  }

  for (const row of mappedEvents ?? []) {
    if (!row.eventbrite_event_id) {
      continue;
    }

    if (tier === "near_term" && !isNearTermEvent(row.event_date)) {
      continue;
    }

    const event: MappedEvent = {
      id: row.id,
      title: row.title,
      event_date: row.event_date,
      eventbrite_event_id: row.eventbrite_event_id,
    };

    try {
      const result = await syncAttendeesForEvent(
        supabase,
        orgId,
        event,
        token,
        systemUserId,
      );
      stats.eventsProcessed += 1;
      stats.attendeesMatched += result.matched;
      stats.attendeesQueuedForReview += result.queued;
    } catch (syncError) {
      stats.errors.push(
        `${row.title}: ${syncError instanceof Error ? syncError.message : "sync failed"}`,
      );
    }
  }

  await supabase
    .from("eventbrite_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      metadata: { last_run: { at: new Date().toISOString(), stats } },
    })
    .eq("org_id", orgId);

  return stats;
}
