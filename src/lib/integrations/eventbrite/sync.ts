import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cleanupTextBatch } from "@/lib/ai/text-cleanup";
import {
  ensureEventAttendanceEvidence,
  findOrCreateEventTag,
  linkProfileToTag,
} from "@/lib/data/events";
import { getDecryptedEventbriteTokenForSync } from "@/lib/data/eventbrite-accounts";
import {
  loadQuestionFieldMapForSync,
  type MappableField,
} from "@/lib/data/eventbrite-question-mappings";
import type {
  EventbriteAttendee,
  EventbriteAttendeeAnswer,
} from "@/lib/integrations/eventbrite/client";
import { listEventAttendees } from "@/lib/integrations/eventbrite/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

type MappedField = "role" | "company_size" | "phone";
type MappedProfileFields = Partial<Record<MappedField, string>>;

const FIELD_TO_COLUMN: Record<MappedField, "occupation" | "company_size" | "phone"> = {
  role: "occupation",
  company_size: "company_size",
  phone: "phone",
};

/**
 * Pulls out each attendee's answers to questions mapped to a profile field
 * (role/company size/phone), then batch-cleans the free-text ones (role,
 * company size) through cleanupTextBatch in one shot rather than one API
 * call per attendee. Phone is left as typed.
 */
async function buildMappedFieldsByAttendee(
  attendees: EventbriteAttendee[],
  fieldMap: Map<string, MappableField>,
): Promise<Map<string, MappedProfileFields>> {
  const byAttendee = new Map<string, MappedProfileFields>();

  if (fieldMap.size === 0) {
    return byAttendee;
  }

  for (const attendee of attendees) {
    const fields: MappedProfileFields = {};

    for (const answer of attendee.answers as EventbriteAttendeeAnswer[]) {
      if (!answer.questionId || !answer.answer) {
        continue;
      }
      const target = fieldMap.get(answer.questionId);
      if (!target || target === "ignore") {
        continue;
      }
      fields[target] = answer.answer;
    }

    if (Object.keys(fields).length > 0) {
      byAttendee.set(attendee.id, fields);
    }
  }

  if (byAttendee.size === 0) {
    return byAttendee;
  }

  const textEntries: Array<{ attendeeId: string; field: "role" | "company_size" }> = [];
  const textValues: string[] = [];

  for (const [attendeeId, fields] of byAttendee) {
    for (const field of ["role", "company_size"] as const) {
      const value = fields[field];
      if (value) {
        textEntries.push({ attendeeId, field });
        textValues.push(value);
      }
    }
  }

  if (textValues.length > 0) {
    const cleaned = await cleanupTextBatch(textValues);
    textEntries.forEach((entry, index) => {
      const fields = byAttendee.get(entry.attendeeId);
      if (fields) {
        fields[entry.field] = cleaned[index];
      }
    });
  }

  return byAttendee;
}

/**
 * For an attendee who matched an existing profile: fills any of the
 * mapped fields that are currently blank on the profile directly, and
 * queues a human review (rather than overwriting) for any field that's
 * already set to something different — Ria wants to be the pulse on
 * changed roles/companies, not silently lose the old value.
 */
async function applyMappedFieldsToMatchedProfile(
  supabase: AdminClient,
  orgId: string,
  event: MappedEvent,
  eventbriteAttendeeId: string,
  profileId: string,
  mapped: MappedProfileFields,
): Promise<void> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("occupation, company_size, phone")
    .eq("id", profileId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !profile) {
    return;
  }

  const fill: { occupation?: string; company_size?: string; phone?: string } = {};
  const changes: Record<string, { old: string; new: string }> = {};
  const profileValues: Record<string, string | null> = {
    occupation: profile.occupation,
    company_size: profile.company_size,
    phone: profile.phone,
  };

  for (const [field, newValue] of Object.entries(mapped) as Array<
    [MappedField, string]
  >) {
    const column = FIELD_TO_COLUMN[field];
    const current = profileValues[column];

    if (!current || !current.trim()) {
      fill[column] = newValue;
    } else if (current.trim() !== newValue.trim()) {
      changes[field] = { old: current, new: newValue };
    }
  }

  if (Object.keys(fill).length > 0) {
    const { error: fillError } = await supabase
      .from("profiles")
      .update(fill)
      .eq("id", profileId)
      .eq("org_id", orgId);
    if (fillError) {
      throw new Error(`Failed to fill profile fields: ${fillError.message}`);
    }
  }

  if (Object.keys(changes).length > 0) {
    const { error: reviewInsertError } = await supabase
      .from("eventbrite_profile_update_reviews")
      .insert({
        org_id: orgId,
        profile_id: profileId,
        event_id: event.id,
        eventbrite_attendee_id: eventbriteAttendeeId,
        proposed_changes: changes,
      });

    // 23505 = we've already queued (or resolved) this exact attendee's
    // update before — nothing new to do on a re-sync.
    if (reviewInsertError && reviewInsertError.code !== "23505") {
      throw new Error(
        `Failed to queue profile update review: ${reviewInsertError.message}`,
      );
    }
  }
}

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
  const fieldMap = await loadQuestionFieldMapForSync(supabase, orgId, event.id);
  const mappedFieldsByAttendee = await buildMappedFieldsByAttendee(attendees, fieldMap);

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
    const mappedFields = mappedFieldsByAttendee.get(attendee.id);

    if (profileId) {
      await ensureAttendeeRow(supabase, orgId, event.id, profileId);
      await ensureEventAttendanceEvidence(
        orgId,
        event,
        profileId,
        systemUserId,
        supabase,
      );

      if (mappedFields) {
        await applyMappedFieldsToMatchedProfile(
          supabase,
          orgId,
          event,
          attendee.id,
          profileId,
          mappedFields,
        );
      }

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
      mapped_fields: mappedFields ?? {},
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

/**
 * Syncs attendees for just one newly-linked event, right after linking —
 * so attendees show up immediately instead of the admin having to wait for
 * the next cron tick (up to 30 minutes away) or remember to click "Sync
 * now". Scoped to one event, so it stays fast regardless of how many other
 * events are mapped.
 */
export async function syncEventbriteAttendeesForEvent(
  orgId: string,
  caffeineEventId: string,
): Promise<{ matched: number; queued: number } | null> {
  const token = await getDecryptedEventbriteTokenForSync(orgId);
  if (!token) {
    return null;
  }

  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("events")
    .select("id, title, event_date, eventbrite_event_id")
    .eq("id", caffeineEventId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load event: ${error.message}`);
  }
  if (!row?.eventbrite_event_id) {
    return null;
  }

  const { data: connector } = await supabase
    .from("eventbrite_accounts")
    .select("connected_by")
    .eq("org_id", orgId)
    .maybeSingle();

  const systemUserId = connector?.connected_by;
  if (!systemUserId) {
    return null;
  }

  const event: MappedEvent = {
    id: row.id,
    title: row.title,
    event_date: row.event_date,
    eventbrite_event_id: row.eventbrite_event_id,
  };

  const result = await syncAttendeesForEvent(supabase, orgId, event, token, systemUserId);

  await supabase
    .from("eventbrite_accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return result;
}
