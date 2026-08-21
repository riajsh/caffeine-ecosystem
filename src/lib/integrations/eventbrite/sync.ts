import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cleanupTextBatch } from "@/lib/ai/text-cleanup";
import { splitCompanyAndRoleBatch } from "@/lib/ai/split-company-role";
import { findOrCreateEventTag } from "@/lib/data/events";
import {
  disableEventbriteSyncAfterAuthFailure,
  getDecryptedEventbriteTokenForSync,
} from "@/lib/data/eventbrite-accounts";
import {
  loadQuestionFieldMapForSync,
  type MappableField,
} from "@/lib/data/eventbrite-question-mappings";
import { formatInteractionDate } from "@/lib/format/date";
import type {
  EventbriteAttendee,
  EventbriteAttendeeAnswer,
} from "@/lib/integrations/eventbrite/client";
import { EventbriteAuthError, listEventAttendees } from "@/lib/integrations/eventbrite/client";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

type MappedField = "role" | "company_size" | "phone" | "organisation_name";
// "note" isn't a profile column — it never goes through FIELD_TO_COLUMN or
// the fill/queue-review comparison logic. It's additive: every mapped
// answer becomes its own new timeline entry on the profile, never something
// to compare against an existing value.
type MappedProfileFields = Partial<Record<MappedField, string>> & { note?: string };

const FIELD_TO_COLUMN: Record<
  MappedField,
  "occupation" | "company_size" | "phone" | "organisation_name"
> = {
  role: "occupation",
  company_size: "company_size",
  phone: "phone",
  organisation_name: "organisation_name",
};

/**
 * Pulls out each attendee's answers to questions mapped to a profile field
 * (role/company size/phone/company-and-role-combined), then batch-processes
 * the free-text ones in one shot rather than one API call per attendee:
 * cleanupTextBatch for simple role/company-size answers, and
 * splitCompanyAndRoleBatch for the combined "what's your company & role"
 * style question, which needs splitting into two fields. Phone is left as
 * typed. An explicit "Role" question mapping (if the event has one) always
 * wins over whatever the combined split guesses.
 */
async function buildMappedFieldsByAttendee(
  attendees: EventbriteAttendee[],
  fieldMap: Map<string, MappableField>,
): Promise<Map<string, MappedProfileFields>> {
  const byAttendee = new Map<string, MappedProfileFields>();
  const combinedRawByAttendee = new Map<string, string>();

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
      if (target === "company_and_role") {
        // Keep the first one seen if an event somehow has more than one.
        if (!combinedRawByAttendee.has(attendee.id)) {
          combinedRawByAttendee.set(attendee.id, answer.answer);
        }
        continue;
      }
      if (target === "company") {
        // "Company" is its own separate question but maps to the
        // organisation_name profile column, not a "company" column.
        fields.organisation_name = answer.answer;
        continue;
      }
      if (target === "note") {
        // Left exactly as typed — deliberately not run through the AI
        // text cleanup used for role/company/etc, since that's tuned for
        // tidying up short job-title-style answers and could easily mangle
        // the tone or meaning of a personal, open-ended answer.
        fields.note = answer.answer;
        continue;
      }
      fields[target] = answer.answer;
    }

    if (Object.keys(fields).length > 0 || combinedRawByAttendee.has(attendee.id)) {
      byAttendee.set(attendee.id, fields);
    }
  }

  if (byAttendee.size === 0) {
    return byAttendee;
  }

  const textEntries: Array<{
    attendeeId: string;
    field: "role" | "company_size" | "organisation_name";
  }> = [];
  const textValues: string[] = [];

  for (const [attendeeId, fields] of byAttendee) {
    for (const field of ["role", "company_size", "organisation_name"] as const) {
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

  if (combinedRawByAttendee.size > 0) {
    const attendeeIds = Array.from(combinedRawByAttendee.keys());
    const rawValues = attendeeIds.map((id) => combinedRawByAttendee.get(id) as string);
    const splits = await splitCompanyAndRoleBatch(rawValues);

    attendeeIds.forEach((attendeeId, index) => {
      const fields = byAttendee.get(attendeeId);
      if (!fields) {
        return;
      }
      const { role, company } = splits[index];
      if (role && !fields.role) {
        fields.role = role;
      }
      if (company && !fields.organisation_name) {
        fields.organisation_name = company;
      }
    });
  }

  return byAttendee;
}

type ProfileLookupRow = {
  id: string;
  email: string;
  occupation: string | null;
  company_size: string | null;
  phone: string | null;
  organisation_name: string | null;
};

/**
 * Loads every profile in the org that has an email, once per sync run,
 * keyed by lower-cased email. Replaces what used to be one "find profile by
 * email" database round trip per attendee — for an event with a few hundred
 * attendees that added up fast, especially once "Sync now" started walking
 * every linked event in one go. A whole org's worth of profiles (just a
 * handful of columns) is small enough to hold in memory for the length of
 * one sync.
 */
async function loadOrgProfileLookup(
  supabase: AdminClient,
  orgId: string,
): Promise<Map<string, ProfileLookupRow>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, occupation, company_size, phone, organisation_name")
    .eq("org_id", orgId)
    .not("email", "is", null);

  if (error) {
    throw new Error(`Failed to load profiles: ${error.message}`);
  }

  const byEmail = new Map<string, ProfileLookupRow>();
  for (const row of data ?? []) {
    if (row.email) {
      byEmail.set(row.email.trim().toLowerCase(), row as ProfileLookupRow);
    }
  }
  return byEmail;
}

/**
 * For an attendee who matched an existing profile: fills any of the
 * mapped fields that are currently blank on the profile directly, and
 * queues a human review (rather than overwriting) for any field that's
 * already set to something different — Ria wants to be the pulse on
 * changed roles/companies, not silently lose the old value. Takes the
 * profile's current field values directly (already fetched in bulk by
 * loadOrgProfileLookup) rather than looking them up itself.
 */
async function applyMappedFieldsToMatchedProfile(
  supabase: AdminClient,
  orgId: string,
  event: MappedEvent,
  eventbriteAttendeeId: string,
  profile: ProfileLookupRow,
  mapped: MappedProfileFields,
): Promise<void> {
  const profileId = profile.id;
  const fill: {
    occupation?: string;
    company_size?: string;
    phone?: string;
    organisation_name?: string;
    organisation_name_normalised?: string | null;
  } = {};
  const changes: Record<string, { old: string; new: string }> = {};
  const profileValues: Record<string, string | null> = {
    occupation: profile.occupation,
    company_size: profile.company_size,
    phone: profile.phone,
    organisation_name: profile.organisation_name,
  };

  for (const [field, newValue] of Object.entries(mapped) as Array<
    [MappedField, string]
  >) {
    const column = FIELD_TO_COLUMN[field];
    const current = profileValues[column];

    if (!current || !current.trim()) {
      fill[column] = newValue;
      if (column === "organisation_name") {
        fill.organisation_name_normalised = normaliseOrganisationName(newValue);
      }
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

type MappedEvent = {
  id: string;
  title: string;
  event_date: string;
  eventbrite_event_id: string;
};

/**
 * Syncs one event's attendees against the org's profiles.
 *
 * Rewritten to replace what used to be several sequential database round
 * trips per attendee (look up their profile, check if they're already
 * recorded as an attendee, check if attendance evidence already exists,
 * check if they're already tagged) with a handful of batched queries for
 * the whole event up front, then batched inserts for whatever's actually
 * new. That's what made "Sync now" take minutes once there were dozens of
 * linked events each with real attendee counts — this keeps the same
 * behaviour (never downgrades existing rows, never overwrites a resolved
 * review, still queues profile-update reviews rather than silently
 * overwriting changed answers) but does it in a small fixed number of
 * queries per event instead of one set per attendee.
 */
async function syncAttendeesForEvent(
  supabase: AdminClient,
  orgId: string,
  event: MappedEvent,
  token: string,
  systemUserId: string,
): Promise<{ matched: number; queued: number }> {
  const attendees = await listEventAttendees(token, event.eventbrite_event_id);
  const attendeesWithEmail = attendees.filter(
    (attendee): attendee is EventbriteAttendee & { email: string } => Boolean(attendee.email),
  );

  if (attendeesWithEmail.length === 0) {
    return { matched: 0, queued: 0 };
  }

  const fieldMap = await loadQuestionFieldMapForSync(supabase, orgId, event.id);
  const mappedFieldsByAttendee = await buildMappedFieldsByAttendee(attendeesWithEmail, fieldMap);

  // Attendance evidence ("Attended this event") and notes-from-this-event
  // both use source "event_system", but a profile can only have one
  // activities row per (org_id, profile_id, source, source_ref) — the
  // database enforces this with its own unique index, regardless of
  // activity_type. So notes get their own source_ref, distinct from the
  // plain event id used for attendance evidence, or the two would collide
  // on every re-sync of an event that already has attendance evidence.
  const noteSourceRef = `${event.id}:note`;

  const [profileByEmail, existingAttendeesResult, existingActivitiesResult, existingReviewsResult] =
    await Promise.all([
      loadOrgProfileLookup(supabase, orgId),
      supabase
        .from("event_attendees")
        .select("profile_id")
        .eq("org_id", orgId)
        .eq("event_id", event.id),
      supabase
        .from("activities")
        .select("profile_id, source_ref")
        .eq("org_id", orgId)
        .eq("source", "event_system")
        .in("source_ref", [event.id, noteSourceRef]),
      supabase
        .from("eventbrite_attendee_reviews")
        .select("eventbrite_attendee_id, status")
        .eq("org_id", orgId)
        .eq("event_id", event.id),
    ]);

  if (existingAttendeesResult.error) {
    throw new Error(`Failed to load existing attendees: ${existingAttendeesResult.error.message}`);
  }
  if (existingActivitiesResult.error) {
    throw new Error(
      `Failed to load existing attendance evidence: ${existingActivitiesResult.error.message}`,
    );
  }
  if (existingReviewsResult.error) {
    throw new Error(`Failed to load existing reviews: ${existingReviewsResult.error.message}`);
  }

  const existingAttendeeProfileIds = new Set(
    (existingAttendeesResult.data ?? []).map((row) => row.profile_id),
  );
  const existingEvidenceProfileIds = new Set(
    (existingActivitiesResult.data ?? [])
      .filter((row) => row.source_ref === event.id)
      .map((row) => row.profile_id),
  );
  const existingNoteProfileIds = new Set(
    (existingActivitiesResult.data ?? [])
      .filter((row) => row.source_ref === noteSourceRef)
      .map((row) => row.profile_id),
  );
  const existingReviewStatusByAttendeeId = new Map(
    (existingReviewsResult.data ?? []).map((row) => [row.eventbrite_attendee_id, row.status]),
  );

  const tagResult = await findOrCreateEventTag(supabase, orgId, event.title);
  const tagId = tagResult.tagId;

  let existingTaggedProfileIds = new Set<string>();
  if (tagId) {
    const { data: taggedRows, error: taggedError } = await supabase
      .from("profile_tags")
      .select("profile_id")
      .eq("org_id", orgId)
      .eq("tag_id", tagId);
    if (taggedError) {
      throw new Error(`Failed to load existing tag links: ${taggedError.message}`);
    }
    existingTaggedProfileIds = new Set((taggedRows ?? []).map((row) => row.profile_id));
  }

  const newAttendeeRows: Array<{
    org_id: string;
    event_id: string;
    profile_id: string;
    attended: boolean;
  }> = [];
  const newActivityRows: Array<{
    org_id: string;
    profile_id: string;
    activity_type: "event";
    title: string;
    summary: string;
    activity_date: string;
    source: "event_system";
    source_ref: string;
    created_by: string;
  }> = [];
  const newTagRows: Array<{ org_id: string; profile_id: string; tag_id: string }> = [];
  const newNoteRows: Array<{
    org_id: string;
    profile_id: string;
    activity_type: "note";
    title: string;
    summary: string;
    activity_date: string;
    source: "event_system";
    source_ref: string;
    created_by: string;
  }> = [];
  const newReviewRows: Array<{
    org_id: string;
    event_id: string;
    eventbrite_attendee_id: string;
    email: string;
    display_name: string | null;
    ticket_type: string | null;
    mapped_fields: MappedProfileFields;
  }> = [];
  const reviewsNeedingRefresh: Array<{ eventbriteAttendeeId: string; mappedFields: MappedProfileFields }> = [];
  const mappedFieldUpdates: Array<{
    profile: ProfileLookupRow;
    eventbriteAttendeeId: string;
    mappedFields: MappedProfileFields;
  }> = [];

  let matched = 0;
  let queued = 0;

  for (const attendee of attendeesWithEmail) {
    const profile = profileByEmail.get(attendee.email.trim().toLowerCase());
    const mappedFields = mappedFieldsByAttendee.get(attendee.id);

    if (profile) {
      if (!existingAttendeeProfileIds.has(profile.id)) {
        newAttendeeRows.push({
          org_id: orgId,
          event_id: event.id,
          profile_id: profile.id,
          attended: false,
        });
        existingAttendeeProfileIds.add(profile.id);
      }
      if (!existingEvidenceProfileIds.has(profile.id)) {
        newActivityRows.push({
          org_id: orgId,
          profile_id: profile.id,
          activity_type: "event",
          title: event.title,
          summary: `Attended ${formatInteractionDate(event.event_date)}`,
          activity_date: event.event_date,
          source: "event_system",
          source_ref: event.id,
          created_by: systemUserId,
        });
        existingEvidenceProfileIds.add(profile.id);
      }
      if (tagId && !existingTaggedProfileIds.has(profile.id)) {
        newTagRows.push({ org_id: orgId, profile_id: profile.id, tag_id: tagId });
        existingTaggedProfileIds.add(profile.id);
      }
      if (mappedFields?.note && !existingNoteProfileIds.has(profile.id)) {
        newNoteRows.push({
          org_id: orgId,
          profile_id: profile.id,
          activity_type: "note",
          title: `Note from ${event.title}`,
          summary: mappedFields.note,
          activity_date: event.event_date,
          source: "event_system",
          source_ref: noteSourceRef,
          created_by: systemUserId,
        });
        existingNoteProfileIds.add(profile.id);
      }
      // "note" isn't a profile column, so it never goes through the
      // fill/queue-for-review comparison below — only pass the
      // column-backed fields (role/company size/phone/company) along.
      const columnFields: MappedProfileFields = { ...mappedFields };
      delete columnFields.note;
      if (Object.keys(columnFields).length > 0) {
        mappedFieldUpdates.push({
          profile,
          eventbriteAttendeeId: attendee.id,
          mappedFields: columnFields,
        });
      }
      matched += 1;
      continue;
    }

    const existingStatus = existingReviewStatusByAttendeeId.get(attendee.id);
    if (existingStatus === undefined) {
      newReviewRows.push({
        org_id: orgId,
        event_id: event.id,
        eventbrite_attendee_id: attendee.id,
        email: attendee.email,
        display_name: attendee.name,
        ticket_type: attendee.ticketType,
        mapped_fields: mappedFields ?? {},
      });
      queued += 1;
    } else if (existingStatus === "pending" && mappedFields && Object.keys(mappedFields).length > 0) {
      // Already queued from an earlier sync and still sitting there
      // unresolved — refresh its mapped answers so a question-mapping
      // change made after the first sync shows up as a suggestion. Never
      // touch one that's already been resolved into a profile.
      reviewsNeedingRefresh.push({ eventbriteAttendeeId: attendee.id, mappedFields });
    }
  }

  if (newAttendeeRows.length > 0) {
    const { error } = await supabase
      .from("event_attendees")
      .upsert(newAttendeeRows, { onConflict: "event_id,profile_id", ignoreDuplicates: true });
    if (error) {
      throw new Error(`Failed to add attendees: ${error.message}`);
    }
  }

  if (newActivityRows.length > 0) {
    const { error } = await supabase.from("activities").insert(newActivityRows);
    if (error) {
      throw new Error(`Failed to record event attendance evidence: ${error.message}`);
    }
  }

  if (newNoteRows.length > 0) {
    // Plain insert, not upsert: the activities table's dedup index is
    // partial (only applies where source_ref isn't null), and Postgres
    // won't match a partial unique index against a plain ON CONFLICT
    // column list — upsert() has no way to express that here, and errors
    // with "no unique or exclusion constraint matching the ON CONFLICT
    // specification" every time. Catching 23505 instead does the same job:
    // in-memory de-duping above already stops two rows in this same batch
    // from colliding, so a 23505 here can only mean this profile already
    // has this event's note from somewhere else — safe to treat as done.
    const { error } = await supabase.from("activities").insert(newNoteRows);
    if (error && error.code !== "23505") {
      throw new Error(`Failed to add notes to profiles: ${error.message}`);
    }
  }

  if (newTagRows.length > 0) {
    const { error } = await supabase
      .from("profile_tags")
      .upsert(newTagRows, { onConflict: "profile_id,tag_id", ignoreDuplicates: true });
    if (error) {
      throw new Error(`Failed to tag attendees: ${error.message}`);
    }
  }

  if (newReviewRows.length > 0) {
    const { error } = await supabase
      .from("eventbrite_attendee_reviews")
      .upsert(newReviewRows, {
        onConflict: "org_id,event_id,eventbrite_attendee_id",
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`Failed to queue attendees for review: ${error.message}`);
    }
  }

  // Small, targeted set — only reviews that are still pending and got a
  // different mapped answer this time — so these stay individual updates
  // rather than needing their own batch machinery.
  for (const { eventbriteAttendeeId, mappedFields } of reviewsNeedingRefresh) {
    await supabase
      .from("eventbrite_attendee_reviews")
      .update({ mapped_fields: mappedFields })
      .eq("org_id", orgId)
      .eq("event_id", event.id)
      .eq("eventbrite_attendee_id", eventbriteAttendeeId)
      .eq("status", "pending");
  }

  // Also small and targeted — only matched attendees who actually answered
  // a mapped question — and each profile's fill/queue-for-review decision
  // depends on that profile's own current values, so these stay per-profile.
  for (const { profile, eventbriteAttendeeId, mappedFields } of mappedFieldUpdates) {
    await applyMappedFieldsToMatchedProfile(
      supabase,
      orgId,
      event,
      eventbriteAttendeeId,
      profile,
      mappedFields,
    );
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
      if (syncError instanceof EventbriteAuthError) {
        // The token itself has stopped working — every remaining event
        // would fail the exact same way, so stop here instead of hammering
        // Eventbrite 40 more times, and switch sync off with a clear reason
        // rather than letting it silently fail forever in the background.
        stats.errors.push(`Eventbrite connection stopped working: ${syncError.message}`);
        await disableEventbriteSyncAfterAuthFailure(orgId, syncError.message);
        return stats;
      }
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

  let result: { matched: number; queued: number };
  try {
    result = await syncAttendeesForEvent(supabase, orgId, event, token, systemUserId);
  } catch (syncError) {
    if (syncError instanceof EventbriteAuthError) {
      await disableEventbriteSyncAfterAuthFailure(orgId, syncError.message);
      return null;
    }
    throw syncError;
  }

  await supabase
    .from("eventbrite_accounts")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return result;
}
