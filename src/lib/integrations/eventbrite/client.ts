import "server-only";

const EVENTBRITE_API_BASE = "https://www.eventbriteapi.com/v3";

export type EventbriteAccountIdentity = {
  name: string | null;
  email: string | null;
};

type EventbriteMeResponse = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  emails?: Array<{ email: string; primary?: boolean; verified?: boolean }>;
};

/**
 * Thrown specifically for a 401/403 from Eventbrite during a sync — distinct
 * from a generic Error so callers can tell "this token stopped working" (which
 * will keep failing on every event until reconnected) apart from a one-off
 * per-event problem worth just logging and moving on from.
 */
export class EventbriteAuthError extends Error {}

function friendlyErrorForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "That token wasn't accepted by Eventbrite — double check you copied the whole private token.";
  }
  if (status === 429) {
    return "Eventbrite is rate-limiting requests right now. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "Eventbrite's API is having trouble right now. Try again shortly.";
  }
  return `Eventbrite rejected the request (status ${status}).`;
}

/**
 * Validates an Eventbrite private token by calling GET /users/me/, and
 * returns the account's display name and primary email for confirmation
 * in the Admin UI. Throws a friendly Error on any failure.
 */
export async function validateEventbriteToken(
  token: string,
): Promise<EventbriteAccountIdentity> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Paste your Eventbrite private token first.");
  }

  let response: Response;
  try {
    response = await fetch(`${EVENTBRITE_API_BASE}/users/me/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Couldn't reach Eventbrite to check the token. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(friendlyErrorForStatus(response.status));
  }

  let payload: EventbriteMeResponse;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Eventbrite returned an unexpected response. Try again.");
  }

  const primaryEmail =
    payload.emails?.find((entry) => entry.primary)?.email ??
    payload.emails?.[0]?.email ??
    null;

  const name =
    payload.name ??
    [payload.first_name, payload.last_name].filter(Boolean).join(" ") ??
    null;

  return {
    name: name || null,
    email: primaryEmail,
  };
}

type EventbritePagination = {
  continuation?: string;
  has_more_items?: boolean;
  // Not used for the pagination loop itself — only read for the temporary
  // diagnostics below, to see what Eventbrite itself thinks the true totals
  // are versus what we actually end up counting.
  object_count?: number;
  page_count?: number;
  page_number?: number;
};

async function eventbriteGet<T>(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${EVENTBRITE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("Couldn't reach Eventbrite. Check your connection and try again.");
  }

  if (!response.ok) {
    const message = friendlyErrorForStatus(response.status);
    if (response.status === 401 || response.status === 403) {
      throw new EventbriteAuthError(message);
    }
    throw new Error(message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Eventbrite returned an unexpected response. Try again.");
  }
}

export type EventbriteEventSummary = {
  id: string;
  name: string;
  startIso: string | null;
  status: string;
};

type EventbriteEventsResponse = {
  events?: Array<{
    id: string;
    name?: { text?: string | null };
    start?: { utc?: string | null };
    status?: string;
  }>;
  pagination?: EventbritePagination;
};

type EventbriteOrganizationsResponse = {
  organizations?: Array<{ id: string }>;
};

/**
 * Eventbrite accounts that belong to a team "Organization" often don't
 * expose their events via /users/me/events/ (that only lists events tied
 * directly to the personal user) — the events actually live under
 * /organizations/{id}/events/. This finds those organisation IDs, if any.
 */
async function listOrganizationIds(token: string): Promise<string[]> {
  const page = await eventbriteGet<EventbriteOrganizationsResponse>(
    token,
    "/users/me/organizations/",
  );
  return (page.organizations ?? []).map((org) => org.id);
}

async function listEventsFromPath(
  token: string,
  path: string,
): Promise<EventbriteEventSummary[]> {
  const events: EventbriteEventSummary[] = [];
  let continuation: string | undefined;

  do {
    const params: Record<string, string> = {
      order_by: "start_desc",
      status: "all",
    };
    if (continuation) {
      params.continuation = continuation;
    }

    const page = await eventbriteGet<EventbriteEventsResponse>(token, path, params);

    for (const event of page.events ?? []) {
      events.push({
        id: event.id,
        name: cleanEventbriteText(event.name?.text) || "Untitled Eventbrite event",
        startIso: event.start?.utc ?? null,
        status: event.status ?? "unknown",
      });
    }

    continuation = page.pagination?.has_more_items
      ? page.pagination.continuation
      : undefined;
  } while (continuation);

  return events;
}

/**
 * Lists every event the connected account organises (any status — draft,
 * live, ended, or canceled), most recent first, across all pages. Used by
 * the event-mapping screen so an admin can link each one to a Caffeine
 * event.
 *
 * Tries the account's Organization(s) first — that's where events live for
 * team/shared Eventbrite accounts — and falls back to the personal user's
 * own events if the account has no organizations.
 */
export async function listOrganizerEvents(
  token: string,
): Promise<EventbriteEventSummary[]> {
  let organizationIds: string[] = [];

  try {
    organizationIds = await listOrganizationIds(token);
  } catch {
    // If this lookup fails for any reason, fall back to the personal path below.
    organizationIds = [];
  }

  if (organizationIds.length === 0) {
    return listEventsFromPath(token, "/users/me/events/");
  }

  const eventsByOrg = await Promise.all(
    organizationIds.map((orgId) =>
      listEventsFromPath(token, `/organizations/${encodeURIComponent(orgId)}/events/`),
    ),
  );

  return eventsByOrg.flat();
}

export type EventbriteAttendeeAnswer = {
  questionId: string | null;
  questionText: string | null;
  answer: string | null;
};

export type EventbriteAttendee = {
  id: string;
  email: string | null;
  name: string | null;
  ticketType: string | null;
  checkedIn: boolean;
  answers: EventbriteAttendeeAnswer[];
};

export type EventbriteQuestion = {
  id: string;
  text: string;
};

type EventbriteQuestionText = string | { text?: string | null } | null | undefined;

function extractQuestionText(value: EventbriteQuestionText): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return cleanEventbriteText(value);
  }
  return cleanEventbriteText(value.text);
}

type EventbriteQuestionsResponse = {
  questions?: Array<{
    id: string;
    question?: EventbriteQuestionText;
    name?: EventbriteQuestionText;
  }>;
  pagination?: EventbritePagination;
};

/**
 * Lists an event's custom registration questions, so an admin can map each
 * one to a Caffeine profile field (role, company size, phone) once per
 * event.
 */
export async function listEventQuestions(
  token: string,
  eventbriteEventId: string,
): Promise<EventbriteQuestion[]> {
  const questions: EventbriteQuestion[] = [];
  let continuation: string | undefined;

  do {
    const params: Record<string, string> = {};
    if (continuation) {
      params.continuation = continuation;
    }

    const page = await eventbriteGet<EventbriteQuestionsResponse>(
      token,
      `/events/${encodeURIComponent(eventbriteEventId)}/questions/`,
      params,
    );

    for (const question of page.questions ?? []) {
      const text = extractQuestionText(question.question ?? question.name);
      if (text) {
        questions.push({ id: question.id, text });
      }
    }

    continuation = page.pagination?.has_more_items
      ? page.pagination.continuation
      : undefined;
  } while (continuation);

  return questions;
}

/**
 * Eventbrite's data has had a bug since its 2026 ownership change where
 * some attendee names come through as Python "bytes" reprs instead of
 * plain text — e.g. "b'Eva' b'Kulkarni'" instead of "Eva Kulkarni". Strips
 * that wrapper if present; harmless no-op on normal names.
 */
function cleanEventbriteText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/b(['"])(.*?)\1/g, "$2").trim();
  return cleaned || null;
}

/**
 * On a group/multi-ticket order, Eventbrite shows the literal placeholder
 * "Info Requested" for each additional attendee who hasn't filled in their
 * own details yet — it's not a real email, and treating it like one floods
 * the review queue with dozens of identical, meaningless entries per event.
 * Normalising it (and anything else that isn't a real email) to null makes
 * these attendees skip the review queue entirely, the same as if Eventbrite
 * hadn't given us an email at all — once the real person actually fills in
 * their details, a later sync will pick up their real email normally.
 */
function normaliseAttendeeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() || "";
  if (!trimmed || trimmed === "info requested" || !trimmed.includes("@")) {
    return null;
  }
  return trimmed;
}

type EventbriteAttendeesResponse = {
  attendees?: Array<{
    id: string;
    profile?: { email?: string | null; name?: string | null };
    ticket_class_name?: string | null;
    checked_in?: boolean;
    status?: string;
    answers?: Array<{
      question_id?: string | null;
      question?: string | null;
      answer?: string | null;
    }>;
  }>;
  pagination?: EventbritePagination;
};

export type EventbriteAttendeesFetchDiagnostics = {
  pagesFetched: number;
  rawAttendeesSeen: number;
  statusFilteredOut: Record<string, number>;
  reportedObjectCount: number | null;
  reportedPageCount: number | null;
  finalHasMoreItems: boolean | null;
};

/**
 * Lists every attendee for one Eventbrite event, across all pages,
 * including their answers to the event's custom registration questions
 * (used to fill in role, phone, company size once mapped). Cancelled/
 * refunded tickets are skipped — only active attendees count.
 *
 * Also returns diagnostics (temporary, added while chasing a real
 * discrepancy between Eventbrite's own reported attendee count for an
 * event and what ends up in Caffeine) — how many pages we actually walked,
 * how many raw attendee records Eventbrite sent us before any filtering,
 * what statuses we filtered out and how many of each, and what Eventbrite
 * itself reports as the total object/page count on the last page we saw.
 * If reportedObjectCount doesn't match rawAttendeesSeen, our pagination
 * loop is stopping early. If it matches but rawAttendeesSeen is still
 * higher than the final returned list, the status filter is the culprit.
 */
export async function listEventAttendees(
  token: string,
  eventbriteEventId: string,
): Promise<{
  attendees: EventbriteAttendee[];
  diagnostics: EventbriteAttendeesFetchDiagnostics;
}> {
  const attendees: EventbriteAttendee[] = [];
  let continuation: string | undefined;
  let pagesFetched = 0;
  let rawAttendeesSeen = 0;
  const statusFilteredOut: Record<string, number> = {};
  let lastPagination: EventbritePagination | undefined;

  do {
    const params: Record<string, string> = { expand: "answers" };
    if (continuation) {
      params.continuation = continuation;
    }

    const page = await eventbriteGet<EventbriteAttendeesResponse>(
      token,
      `/events/${encodeURIComponent(eventbriteEventId)}/attendees/`,
      params,
    );
    pagesFetched += 1;
    lastPagination = page.pagination;

    for (const attendee of page.attendees ?? []) {
      rawAttendeesSeen += 1;

      if (attendee.status && attendee.status !== "Attending") {
        // Cancelled, refunded, or not-attending tickets — skip.
        statusFilteredOut[attendee.status] = (statusFilteredOut[attendee.status] ?? 0) + 1;
        continue;
      }

      attendees.push({
        id: attendee.id,
        email: normaliseAttendeeEmail(attendee.profile?.email),
        name: cleanEventbriteText(attendee.profile?.name),
        ticketType: cleanEventbriteText(attendee.ticket_class_name),
        checkedIn: attendee.checked_in === true,
        answers: (attendee.answers ?? [])
          .map((entry) => ({
            questionId: entry.question_id?.trim() || null,
            questionText: cleanEventbriteText(entry.question),
            answer: cleanEventbriteText(entry.answer),
          }))
          .filter((entry) => entry.answer),
      });
    }

    continuation = page.pagination?.has_more_items
      ? page.pagination.continuation
      : undefined;
  } while (continuation);

  return {
    attendees,
    diagnostics: {
      pagesFetched,
      rawAttendeesSeen,
      statusFilteredOut,
      reportedObjectCount: lastPagination?.object_count ?? null,
      reportedPageCount: lastPagination?.page_count ?? null,
      finalHasMoreItems: lastPagination?.has_more_items ?? null,
    },
  };
}
