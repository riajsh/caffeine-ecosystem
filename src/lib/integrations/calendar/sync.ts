import "server-only";

import { GaxiosError } from "gaxios";
import type { calendar_v3 } from "googleapis";

import { autoResolveEligibleCalendarReviews } from "@/lib/integrations/calendar/auto-resolve-reviews";
import { listSyncableCalendars } from "@/lib/integrations/calendar/calendar-list";
import { getCalendarClient } from "@/lib/integrations/calendar/client";
import { removeCalendarEventDerivedData } from "@/lib/integrations/calendar/cleanup-event";
import {
  calendarBackfillTimeMin,
  calendarLookaheadCutoff,
  isBeyondCalendarLookahead,
} from "@/lib/integrations/calendar/env";
import {
  hasExternalParticipant,
  loadOrgProfilesByEmail,
  processCalendarParticipants,
  type OrgProfileByEmail,
} from "@/lib/integrations/calendar/match";
import { calendarOccurrenceKey } from "@/lib/integrations/calendar/occurrence";
import { loadOrgParticipantFilters } from "@/lib/integrations/participant-email";
import {
  loadIgnoredParticipantEmails,
  loadOrgRelationshipsByProfileId,
} from "@/lib/integrations/calendar/review-utils";
import { purgeBeyondLookaheadCalendarData } from "@/lib/integrations/calendar/purge-beyond-lookahead";
import { purgeInternalCalendarSyncData } from "@/lib/integrations/calendar/purge-internal";
import {
  loadCalendarSyncCursors,
  parseCalendarAccountMetadata,
  resolvePrimarySyncCursor,
  type CalendarAccountMetadata,
  type CalendarSyncCursors,
} from "@/lib/integrations/calendar/sync-cursors";
import type {
  CalendarParticipant,
  CalendarSyncStats,
  ParsedCalendarEvent,
} from "@/lib/integrations/calendar/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type CalendarAccount = {
  id: string;
  org_id: string;
  email: string;
  refresh_token: string;
  sync_cursor: string | null;
  metadata: Json | null;
};

function emptyStats(): CalendarSyncStats {
  return {
    eventsProcessed: 0,
    eventsSkippedDuplicate: 0,
    calendarsSynced: 0,
    activitiesCreated: 0,
    reviewsQueued: 0,
    profilesAutoCreated: 0,
    errors: [],
  };
}

function mergeStats(into: CalendarSyncStats, from: CalendarSyncStats): void {
  into.eventsProcessed += from.eventsProcessed;
  into.eventsSkippedDuplicate += from.eventsSkippedDuplicate;
  into.calendarsSynced += from.calendarsSynced;
  into.activitiesCreated += from.activitiesCreated;
  into.reviewsQueued += from.reviewsQueued;
  into.profilesAutoCreated += from.profilesAutoCreated;
  into.errors.push(...from.errors);
  if (from.rateLimited) {
    into.rateLimited = true;
  }
}

function parseEventDate(
  value: calendar_v3.Schema$EventDateTime | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (value.dateTime) {
    return new Date(value.dateTime).toISOString();
  }

  if (value.date) {
    return new Date(`${value.date}T00:00:00.000Z`).toISOString();
  }

  return null;
}

function parseParticipants(event: calendar_v3.Schema$Event): CalendarParticipant[] {
  const participants = new Map<string, CalendarParticipant>();
  const organizerEmail = event.organizer?.email?.trim().toLowerCase();

  if (organizerEmail) {
    participants.set(organizerEmail, {
      email: organizerEmail,
      name: event.organizer?.displayName ?? null,
      responseStatus: event.organizer?.self ? "accepted" : "needsAction",
      organizer: true,
    });
  }

  for (const attendee of event.attendees ?? []) {
    const email = attendee.email?.trim().toLowerCase();
    if (!email) {
      continue;
    }

    participants.set(email, {
      email,
      name: attendee.displayName ?? null,
      responseStatus: attendee.responseStatus ?? null,
      organizer: email === organizerEmail,
    });
  }

  return [...participants.values()];
}

function parseGoogleEvent(
  event: calendar_v3.Schema$Event,
  sourceCalendarId: string,
): ParsedCalendarEvent | null {
  const googleEventId = event.id;
  if (!googleEventId) {
    return null;
  }

  return {
    googleEventId,
    icalUid: event.iCalUID?.trim() ?? null,
    sourceCalendarId,
    title: event.summary ?? null,
    description: event.description ?? null,
    participants: parseParticipants(event),
    startAt: parseEventDate(event.start),
    endAt: parseEventDate(event.end),
    isDeleted: event.status === "cancelled",
  };
}

function backfillTimeMax(): string {
  return calendarLookaheadCutoff().toISOString();
}

async function findExistingOccurrenceEvent(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  icalUid: string,
  startAt: string,
): Promise<{ id: string; google_event_id: string } | null> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, google_event_id")
    .eq("org_id", orgId)
    .eq("ical_uid", icalUid)
    .eq("start_at", startAt)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to lookup calendar occurrence: ${error.message}`);
  }

  return data;
}

async function upsertCalendarEvent(
  supabase: ReturnType<typeof createAdminClient>,
  account: CalendarAccount,
  parsed: ParsedCalendarEvent,
  participantFilters: Awaited<ReturnType<typeof loadOrgParticipantFilters>>,
  ignoredParticipantEmails: ReadonlySet<string>,
  profilesByEmail: OrgProfileByEmail,
  relationshipsByProfileId: Awaited<
    ReturnType<typeof loadOrgRelationshipsByProfileId>
  >,
): Promise<{
  activitiesCreated: number;
  reviewsQueued: number;
  profilesAutoCreated: number;
  skippedDuplicate: boolean;
}> {
  const occurrenceKey = calendarOccurrenceKey(parsed.icalUid, parsed.startAt);

  if (occurrenceKey && parsed.icalUid && parsed.startAt) {
    const existing = await findExistingOccurrenceEvent(
      supabase,
      account.org_id,
      parsed.icalUid,
      parsed.startAt,
    );

    if (existing) {
      if (parsed.isDeleted) {
        const { error: tombstoneError } = await supabase
          .from("calendar_events")
          .update({ is_deleted: true })
          .eq("id", existing.id)
          .eq("org_id", account.org_id);

        if (tombstoneError) {
          throw new Error(
            `Failed to tombstone duplicate occurrence: ${tombstoneError.message}`,
          );
        }

        await removeCalendarEventDerivedData(
          supabase,
          account.org_id,
          existing.id,
          existing.google_event_id,
          parsed.icalUid,
          parsed.startAt,
        );
      }

      return {
        activitiesCreated: 0,
        reviewsQueued: 0,
        profilesAutoCreated: 0,
        skippedDuplicate: true,
      };
    }
  }

  if (
    !parsed.isDeleted &&
    !hasExternalParticipant(parsed.participants, participantFilters)
  ) {
    return {
      activitiesCreated: 0,
      reviewsQueued: 0,
      profilesAutoCreated: 0,
      skippedDuplicate: false,
    };
  }

  if (!parsed.isDeleted && isBeyondCalendarLookahead(parsed.startAt)) {
    return {
      activitiesCreated: 0,
      reviewsQueued: 0,
      profilesAutoCreated: 0,
      skippedDuplicate: false,
    };
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("calendar_events")
    .upsert(
      {
        org_id: account.org_id,
        google_event_id: parsed.googleEventId,
        calendar_account_id: account.id,
        ical_uid: parsed.icalUid,
        source_calendar_id: parsed.sourceCalendarId,
        title: parsed.title,
        description: parsed.description,
        participants: parsed.participants as unknown as Json,
        start_at: parsed.startAt,
        end_at: parsed.endAt,
        is_deleted: parsed.isDeleted,
      },
      { onConflict: "org_id,google_event_id" },
    )
    .select("id")
    .single();

  if (eventError) {
    throw new Error(`Failed to upsert calendar event: ${eventError.message}`);
  }

  if (parsed.isDeleted) {
    await removeCalendarEventDerivedData(
      supabase,
      account.org_id,
      eventRow.id,
      parsed.googleEventId,
      parsed.icalUid,
      parsed.startAt,
    );
    return {
      activitiesCreated: 0,
      reviewsQueued: 0,
      profilesAutoCreated: 0,
      skippedDuplicate: false,
    };
  }

  const result = await processCalendarParticipants(supabase, {
    orgId: account.org_id,
    eventId: eventRow.id,
    googleEventId: parsed.googleEventId,
    icalUid: parsed.icalUid,
    startAt: parsed.startAt,
    title: parsed.title,
    participants: parsed.participants,
    participantFilters,
    ignoredParticipantEmails,
    profilesByEmail,
    relationshipsByProfileId,
  });

  return { ...result, skippedDuplicate: false };
}

async function syncCalendarFeed(
  calendar: calendar_v3.Calendar,
  params: {
    calendarId: string;
    syncToken: string | undefined;
    account: CalendarAccount;
    supabase: ReturnType<typeof createAdminClient>;
    participantFilters: Awaited<ReturnType<typeof loadOrgParticipantFilters>>;
    ignoredParticipantEmails: ReadonlySet<string>;
    profilesByEmail: OrgProfileByEmail;
    relationshipsByProfileId: Awaited<
      ReturnType<typeof loadOrgRelationshipsByProfileId>
    >;
  },
): Promise<{ stats: CalendarSyncStats; nextSyncToken: string | undefined }> {
  const stats = emptyStats();
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId: params.calendarId,
      singleEvents: true,
      showDeleted: true,
      maxResults: 250,
      pageToken,
      syncToken: params.syncToken,
      timeMin: params.syncToken ? undefined : calendarBackfillTimeMin(),
      timeMax: params.syncToken ? undefined : backfillTimeMax(),
    });

    for (const item of response.data.items ?? []) {
      try {
        const parsed = parseGoogleEvent(item, params.calendarId);
        if (!parsed) {
          continue;
        }

        const result = await upsertCalendarEvent(
          params.supabase,
          params.account,
          parsed,
          params.participantFilters,
          params.ignoredParticipantEmails,
          params.profilesByEmail,
          params.relationshipsByProfileId,
        );

        if (result.skippedDuplicate) {
          stats.eventsSkippedDuplicate += 1;
        } else {
          stats.eventsProcessed += 1;
        }

        stats.activitiesCreated += result.activitiesCreated;
        stats.reviewsQueued += result.reviewsQueued;
        stats.profilesAutoCreated += result.profilesAutoCreated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown event sync error";
        stats.errors.push(`${params.calendarId}: ${message}`);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  stats.calendarsSynced = 1;
  return { stats, nextSyncToken };
}

async function persistAccountSyncState(
  supabase: ReturnType<typeof createAdminClient>,
  account: CalendarAccount,
  params: {
    syncCursors: CalendarSyncCursors;
    stats: CalendarSyncStats;
    existingMetadata: ReturnType<typeof parseCalendarAccountMetadata>;
  },
): Promise<void> {
  const metadata: CalendarAccountMetadata = {
    ...params.existingMetadata,
    syncing: false,
    needs_backfill: false,
    sync_cursors: params.syncCursors,
    last_run: {
      at: new Date().toISOString(),
      stats: params.stats,
      calendars_synced: params.stats.calendarsSynced,
      ...(params.stats.errors.length > 0
        ? { error: params.stats.errors[params.stats.errors.length - 1] }
        : {}),
    },
  };

  await supabase
    .from("calendar_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_cursor: resolvePrimarySyncCursor(params.syncCursors, account.email),
      metadata: metadata as unknown as Json,
    })
    .eq("id", account.id)
    .eq("org_id", account.org_id);
}

export async function syncCalendarAccount(
  account: CalendarAccount,
  options: { clearedCalendarId?: string } = {},
): Promise<CalendarSyncStats> {
  const stats = emptyStats();

  const supabase = createAdminClient();
  const calendar = getCalendarClient(account);
  const existingMetadata = parseCalendarAccountMetadata(account.metadata);
  let syncCursors = loadCalendarSyncCursors(account.metadata, account.sync_cursor);

  if (options.clearedCalendarId) {
    delete syncCursors[options.clearedCalendarId];
  } else if (existingMetadata.needs_backfill) {
    syncCursors = {};
  }

  const participantFilters = await loadOrgParticipantFilters(
    supabase,
    account.org_id,
  );
  const ignoredParticipantEmails = await loadIgnoredParticipantEmails(
    supabase,
    account.org_id,
  );
  const profilesByEmail = await loadOrgProfilesByEmail(supabase, account.org_id);
  const relationshipsByProfileId = await loadOrgRelationshipsByProfileId(
    supabase,
    account.org_id,
  );

  try {
    await supabase
      .from("calendar_accounts")
      .update({
        metadata: {
          ...existingMetadata,
          syncing: true,
          started_at: new Date().toISOString(),
        } as unknown as Json,
      })
      .eq("id", account.id)
      .eq("org_id", account.org_id);

    await purgeInternalCalendarSyncData(supabase, account.org_id, participantFilters);
    await purgeBeyondLookaheadCalendarData(supabase, account.org_id);

    const syncableCalendars = await listSyncableCalendars(calendar, account.email);

    for (const syncable of syncableCalendars) {
      const syncToken = syncCursors[syncable.id] || undefined;

      try {
        const feedResult = await syncCalendarFeed(calendar, {
          calendarId: syncable.id,
          syncToken,
          account,
          supabase,
          participantFilters,
          ignoredParticipantEmails,
          profilesByEmail,
          relationshipsByProfileId,
        });

        mergeStats(stats, feedResult.stats);

        if (feedResult.nextSyncToken) {
          syncCursors[syncable.id] = feedResult.nextSyncToken;
        }
      } catch (error) {
        if (error instanceof GaxiosError && error.response?.status === 429) {
          stats.errors.push(
            `Rate limited on ${syncable.id} — will retry on next run`,
          );
          stats.rateLimited = true;
          break;
        }

        const message =
          error instanceof Error ? error.message : "Calendar sync request failed";

        const isExpiredToken =
          (error instanceof GaxiosError && error.response?.status === 410) ||
          message.includes("Sync token is no longer valid");

        if (isExpiredToken) {
          delete syncCursors[syncable.id];
          try {
            const retryResult = await syncCalendarFeed(calendar, {
              calendarId: syncable.id,
              syncToken: undefined,
              account,
              supabase,
              participantFilters,
              ignoredParticipantEmails,
              profilesByEmail,
              relationshipsByProfileId,
            });
            mergeStats(stats, retryResult.stats);
            if (retryResult.nextSyncToken) {
              syncCursors[syncable.id] = retryResult.nextSyncToken;
            }
          } catch (retryError) {
            const retryMessage =
              retryError instanceof Error
                ? retryError.message
                : "Calendar backfill retry failed";
            stats.errors.push(`${syncable.id}: ${retryMessage}`);
          }
          continue;
        }

        stats.errors.push(`${syncable.id}: ${message}`);
      }
    }

    try {
      const autoResolveResult = await autoResolveEligibleCalendarReviews(
        supabase,
        {
          orgId: account.org_id,
          participantFilters,
          profilesByEmail,
        },
      );
      stats.profilesAutoCreated += autoResolveResult.profilesCreated;
      stats.activitiesCreated += autoResolveResult.activitiesCreated;
    } catch (autoResolveError) {
      const message =
        autoResolveError instanceof Error
          ? autoResolveError.message
          : "Calendar review auto-resolve failed";
      stats.errors.push(message);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar sync failed";
    stats.errors.push(message);
  } finally {
    await persistAccountSyncState(supabase, account, {
      syncCursors,
      stats,
      existingMetadata,
    });
  }

  return stats;
}

export async function syncAllCalendarAccounts(): Promise<{
  accountsProcessed: number;
  stats: CalendarSyncStats;
}> {
  const supabase = createAdminClient();
  const { data: accounts, error } = await supabase
    .from("calendar_accounts")
    .select("id, org_id, email, refresh_token, sync_cursor, metadata")
    .eq("sync_enabled", true);

  if (error) {
    throw new Error(`Failed to load calendar accounts: ${error.message}`);
  }

  const aggregate = emptyStats();

  for (const account of accounts ?? []) {
    const stats = await syncCalendarAccount(account);
    mergeStats(aggregate, stats);
  }

  return {
    accountsProcessed: accounts?.length ?? 0,
    stats: aggregate,
  };
}

export async function upsertCalendarAccount(params: {
  orgId: string;
  userId: string;
  email: string;
  encryptedRefreshToken: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("calendar_accounts")
    .upsert(
      {
        org_id: params.orgId,
        user_id: params.userId,
        email: params.email,
        refresh_token: params.encryptedRefreshToken,
        sync_enabled: true,
        sync_cursor: null,
        metadata: { needs_backfill: true, sync_cursors: {} },
      },
      { onConflict: "org_id,email" },
    )
    .select("id, org_id, email, refresh_token, sync_cursor, metadata")
    .single();

  if (error) {
    throw new Error(`Failed to store calendar account: ${error.message}`);
  }

  return data;
}
