import "server-only";

import type { calendar_v3 } from "googleapis";

import { isNonPersonParticipant } from "@/lib/integrations/participant-email";

export type SyncableCalendar = {
  id: string;
  summary: string | null;
  accessRole: string | null;
};

function loadSyncCalendarDomains(): Set<string> {
  const raw = process.env.CALENDAR_SYNC_DOMAINS ?? process.env.ORG_INTERNAL_EMAIL_DOMAINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Whether a calendarList entry should be synced for this connected account. */
export function shouldSyncCalendarId(
  calendarId: string,
  accountEmail: string,
): boolean {
  const normalisedId = calendarId.trim().toLowerCase();
  const normalisedAccountEmail = accountEmail.trim().toLowerCase();

  if (normalisedId === "primary" || normalisedId === normalisedAccountEmail) {
    return true;
  }

  if (normalisedId.endsWith("@resource.calendar.google.com")) {
    return true;
  }

  const domains = loadSyncCalendarDomains();
  for (const domain of domains) {
    if (normalisedId.endsWith(`@${domain}`)) {
      return true;
    }
  }

  return false;
}

function isReadableCalendar(entry: calendar_v3.Schema$CalendarListEntry): boolean {
  if (!entry.id || entry.hidden) {
    return false;
  }

  if (entry.accessRole === "freeBusyReader") {
    return false;
  }

  // Skip public holiday and birthday feeds — not relationship evidence.
  if (entry.id.includes("@group.v.calendar.google.com")) {
    return false;
  }

  if (entry.id.includes("#contacts@group.v.calendar.google.com")) {
    return false;
  }

  return true;
}

export async function listSyncableCalendars(
  calendar: calendar_v3.Calendar,
  accountEmail: string,
): Promise<SyncableCalendar[]> {
  const calendars: SyncableCalendar[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.calendarList.list({
      maxResults: 250,
      pageToken,
      showHidden: false,
    });

    for (const entry of response.data.items ?? []) {
      if (!isReadableCalendar(entry) || !entry.id) {
        continue;
      }

      if (!shouldSyncCalendarId(entry.id, accountEmail)) {
        continue;
      }

      calendars.push({
        id: entry.id,
        summary: entry.summary ?? null,
        accessRole: entry.accessRole ?? null,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (!calendars.some((item) => item.id === "primary")) {
    calendars.unshift({
      id: "primary",
      summary: accountEmail,
      accessRole: "owner",
    });
  }

  return calendars.sort((a, b) => calendarSyncPriority(a.id) - calendarSyncPriority(b.id));
}

function calendarSyncPriority(calendarId: string): number {
  if (calendarId === "primary") {
    return 0;
  }

  if (calendarId.endsWith("@resource.calendar.google.com")) {
    return 1;
  }

  return 2;
}

/** True when attendee is a room/desk resource, not a person. */
export function isResourceParticipantEmail(email: string): boolean {
  return isNonPersonParticipant(email);
}
