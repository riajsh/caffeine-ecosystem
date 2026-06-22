import "server-only";

import { GaxiosError } from "gaxios";
import type { calendar_v3 } from "googleapis";

import { autoResolveEligibleCalendarReviews } from "@/lib/integrations/calendar/auto-resolve-reviews";
import { getCalendarClient } from "@/lib/integrations/calendar/client";
import { removeCalendarEventDerivedData } from "@/lib/integrations/calendar/cleanup-event";
import {
  CALENDAR_BACKFILL_MONTHS,
  calendarLookaheadCutoff,
  isBeyondCalendarLookahead,
} from "@/lib/integrations/calendar/env";
import {
  hasExternalParticipant,
  loadOrgProfilesByEmail,
  processCalendarParticipants,
  type OrgProfileByEmail,
} from "@/lib/integrations/calendar/match";
import { loadOrgParticipantFilters } from "@/lib/integrations/participant-email";
import { loadIgnoredParticipantEmails, loadOrgRelationshipsByProfileId } from "@/lib/integrations/calendar/review-utils";
import { purgeBeyondLookaheadCalendarData } from "@/lib/integrations/calendar/purge-beyond-lookahead";
import { purgeInternalCalendarSyncData } from "@/lib/integrations/calendar/purge-internal";
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
};

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
      // self: true = PU team member is the organiser (accepted by definition).
      // self: false = external organiser; actual status comes from attendees array.
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

function parseGoogleEvent(event: calendar_v3.Schema$Event): ParsedCalendarEvent | null {
  const googleEventId = event.id;
  if (!googleEventId) {
    return null;
  }

  return {
    googleEventId,
    title: event.summary ?? null,
    description: event.description ?? null,
    participants: parseParticipants(event),
    startAt: parseEventDate(event.start),
    endAt: parseEventDate(event.end),
    isDeleted: event.status === "cancelled",
  };
}

function backfillTimeMin(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - CALENDAR_BACKFILL_MONTHS);
  return date.toISOString();
}

function backfillTimeMax(): string {
  return calendarLookaheadCutoff().toISOString();
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
}> {

  if (
    !parsed.isDeleted &&
    !hasExternalParticipant(parsed.participants, participantFilters)
  ) {
    return { activitiesCreated: 0, reviewsQueued: 0, profilesAutoCreated: 0 };
  }

  if (!parsed.isDeleted && isBeyondCalendarLookahead(parsed.startAt)) {
    return { activitiesCreated: 0, reviewsQueued: 0, profilesAutoCreated: 0 };
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("calendar_events")
    .upsert(
      {
        org_id: account.org_id,
        google_event_id: parsed.googleEventId,
        calendar_account_id: account.id,
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
    );
    return { activitiesCreated: 0, reviewsQueued: 0, profilesAutoCreated: 0 };
  }

  return processCalendarParticipants(supabase, {
    orgId: account.org_id,
    eventId: eventRow.id,
    googleEventId: parsed.googleEventId,
    title: parsed.title,
    startAt: parsed.startAt,
    participants: parsed.participants,
    participantFilters,
    ignoredParticipantEmails,
    profilesByEmail,
    relationshipsByProfileId,
  });
}

export async function syncCalendarAccount(
  account: CalendarAccount,
  isTokenRetry = false,
): Promise<CalendarSyncStats> {
  const stats: CalendarSyncStats = {
    eventsProcessed: 0,
    activitiesCreated: 0,
    reviewsQueued: 0,
    profilesAutoCreated: 0,
    errors: [],
  };

  const supabase = createAdminClient();
  const calendar = getCalendarClient(account);
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

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const syncToken = account.sync_cursor ?? undefined;
  let retryingAfterInvalidToken = false;

  try {
    // Set syncing flag and run purges inside the try so the finally block
    // always resets syncing: false even if these steps throw (#4).
    if (!isTokenRetry) {
      await supabase
        .from("calendar_accounts")
        .update({
          metadata: {
            syncing: true,
            started_at: new Date().toISOString(),
          },
        })
        .eq("id", account.id)
        .eq("org_id", account.org_id);
    }

    await purgeInternalCalendarSyncData(supabase, account.org_id, participantFilters);
    await purgeBeyondLookaheadCalendarData(supabase, account.org_id);

    do {
      const response = await calendar.events.list({
        calendarId: "primary",
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
        pageToken,
        syncToken,
        timeMin: syncToken ? undefined : backfillTimeMin(),
        timeMax: syncToken ? undefined : backfillTimeMax(),
      });

      for (const item of response.data.items ?? []) {
        try {
          const parsed = parseGoogleEvent(item);
          if (!parsed) {
            continue;
          }

          const result = await upsertCalendarEvent(
            supabase,
            account,
            parsed,
            participantFilters,
            ignoredParticipantEmails,
            profilesByEmail,
            relationshipsByProfileId,
          );
          stats.eventsProcessed += 1;
          stats.activitiesCreated += result.activitiesCreated;
          stats.reviewsQueued += result.reviewsQueued;
          stats.profilesAutoCreated += result.profilesAutoCreated;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown event sync error";
          stats.errors.push(message);
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
      nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

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
    if (error instanceof GaxiosError && error.response?.status === 429) {
      stats.errors.push(
        "Rate limited by Google Calendar API — will retry on next run",
      );
      stats.rateLimited = true;
      return stats;
    }

    const message =
      error instanceof Error ? error.message : "Calendar sync request failed";

    const isExpiredToken =
      (error instanceof GaxiosError && error.response?.status === 410) ||
      message.includes("Sync token is no longer valid");

    if (isExpiredToken && !isTokenRetry) {
      retryingAfterInvalidToken = true;
      try {
        // Await so that if the retry itself throws, we can reset the flag
        // and let this call's finally block clean up syncing: false (#3).
        return await syncCalendarAccount({ ...account, sync_cursor: null }, true);
      } catch (retryError) {
        retryingAfterInvalidToken = false;
        throw retryError;
      }
    }

    stats.errors.push(message);
    return stats;
  } finally {
    if (!retryingAfterInvalidToken) {
      await supabase
        .from("calendar_accounts")
        .update({
          last_sync_at: new Date().toISOString(),
          sync_cursor: nextSyncToken ?? account.sync_cursor,
          metadata: {
            syncing: false,
            last_run: {
              at: new Date().toISOString(),
              stats,
              ...(stats.errors.length > 0
                ? { error: stats.errors[stats.errors.length - 1] }
                : {}),
            },
          },
        })
        .eq("id", account.id)
        .eq("org_id", account.org_id);
    }
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
    .select("id, org_id, email, refresh_token, sync_cursor")
    .eq("sync_enabled", true);

  if (error) {
    throw new Error(`Failed to load calendar accounts: ${error.message}`);
  }

  const aggregate: CalendarSyncStats = {
    eventsProcessed: 0,
    activitiesCreated: 0,
    reviewsQueued: 0,
    profilesAutoCreated: 0,
    errors: [],
  };

  for (const account of accounts ?? []) {
    const stats = await syncCalendarAccount(account);
    aggregate.eventsProcessed += stats.eventsProcessed;
    aggregate.activitiesCreated += stats.activitiesCreated;
    aggregate.reviewsQueued += stats.reviewsQueued;
    aggregate.profilesAutoCreated += stats.profilesAutoCreated;
    aggregate.errors.push(...stats.errors);
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
        metadata: { needs_backfill: true },
      },
      { onConflict: "org_id,email" },
    )
    .select("id, org_id, email, refresh_token, sync_cursor")
    .single();

  if (error) {
    throw new Error(`Failed to store calendar account: ${error.message}`);
  }

  return data;
}
