import "server-only";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  isInternalParticipant,
  isNonPersonParticipant,
  loadOrgParticipantFilters,
  type OrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CalendarSyncReviewSummary = {
  syncing: boolean;
  lastRunAt: string | null;
  eventsProcessed: number;
  activitiesCreated: number;
  reviewsQueued: number;
  pendingReviewCount: number;
  internalPendingReviewCount: number;
  matchedMeetingCount: number;
  internalMatchedMeetingCount: number;
  accountEmail: string | null;
};

export type CalendarReviewGroupLists = {
  external: CalendarUnmatchedGroup[];
  internal: CalendarUnmatchedGroup[];
};

export type CalendarMatchedMeetingLists = {
  external: CalendarMatchedMeeting[];
  internal: CalendarMatchedMeeting[];
};

export type CalendarUnmatchedGroup = {
  email: string;
  displayName: string | null;
  meetingCount: number;
  sampleMeetingTitle: string | null;
  sampleMeetingDate: string | null;
  reviewIds: string[];
};

export type CalendarMatchedMeeting = {
  id: string;
  title: string;
  activityDate: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
};

type LastRunMetadata = {
  syncing?: boolean;
  started_at?: string;
  last_run?: {
    at?: string;
    stats?: {
      eventsProcessed?: number;
      activitiesCreated?: number;
      reviewsQueued?: number;
    };
  };
};

function parseLastRun(metadata: unknown): LastRunMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return metadata as LastRunMetadata;
}

async function loadReviewParticipantFilters(
  orgId: string,
): Promise<OrgParticipantFilters> {
  return loadOrgParticipantFilters(createAdminClient(), orgId);
}

function partitionReviewGroups(
  groups: CalendarUnmatchedGroup[],
  filters: OrgParticipantFilters,
): CalendarReviewGroupLists {
  const external: CalendarUnmatchedGroup[] = [];
  const internal: CalendarUnmatchedGroup[] = [];

  for (const group of groups) {
    if (isInternalParticipant(group.email, filters)) {
      internal.push(group);
    } else {
      external.push(group);
    }
  }

  return { external, internal };
}

function partitionMatchedMeetings(
  meetings: CalendarMatchedMeeting[],
  filters: OrgParticipantFilters,
): CalendarMatchedMeetingLists {
  const external: CalendarMatchedMeeting[] = [];
  const internal: CalendarMatchedMeeting[] = [];

  for (const meeting of meetings) {
    if (
      meeting.profileEmail &&
      isInternalParticipant(meeting.profileEmail, filters)
    ) {
      internal.push(meeting);
    } else {
      external.push(meeting);
    }
  }

  return { external, internal };
}

export async function getCalendarSyncReviewSummary(): Promise<CalendarSyncReviewSummary> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: account, error: accountError } = await supabase
    .from("calendar_accounts")
    .select("email, metadata, last_sync_at")
    .eq("org_id", orgId)
    .eq("sync_enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to load calendar account: ${accountError.message}`);
  }

  const meta = parseLastRun(account?.metadata);
  const stats = meta.last_run?.stats;

  const filters = await loadReviewParticipantFilters(orgId);

  const { data: pendingReviews, error: pendingError } = await supabase
    .from("calendar_participant_reviews")
    .select("email")
    .eq("org_id", orgId)
    .eq("status", "pending");

  if (pendingError) {
    throw new Error(`Failed to count pending reviews: ${pendingError.message}`);
  }

  let pendingReviewCount = 0;
  let internalPendingReviewCount = 0;

  for (const row of pendingReviews ?? []) {
    if (isNonPersonParticipant(row.email)) {
      continue;
    }

    if (isInternalParticipant(row.email, filters)) {
      internalPendingReviewCount += 1;
    } else {
      pendingReviewCount += 1;
    }
  }

  const { data: matchedActivities, error: matchedError } = await supabase
    .from("activities")
    .select(
      `
      profiles (
        email
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("source", "calendar_sync");

  if (matchedError) {
    throw new Error(`Failed to count matched meetings: ${matchedError.message}`);
  }

  let matchedMeetingCount = 0;
  let internalMatchedMeetingCount = 0;

  for (const row of matchedActivities ?? []) {
    const email = row.profiles?.email;
    if (email && isInternalParticipant(email, filters)) {
      internalMatchedMeetingCount += 1;
    } else {
      matchedMeetingCount += 1;
    }
  }

  const totalMatched = matchedMeetingCount + internalMatchedMeetingCount;

  return {
    syncing: meta.syncing === true,
    lastRunAt: account?.last_sync_at ?? meta.last_run?.at ?? null,
    eventsProcessed: stats?.eventsProcessed ?? 0,
    activitiesCreated: stats?.activitiesCreated ?? totalMatched,
    reviewsQueued:
      stats?.reviewsQueued ??
      pendingReviewCount + internalPendingReviewCount,
    pendingReviewCount,
    internalPendingReviewCount,
    matchedMeetingCount,
    internalMatchedMeetingCount,
    accountEmail: account?.email ?? null,
  };
}

export async function listPendingCalendarReviewGroups(
  limit = 50,
): Promise<CalendarReviewGroupLists> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const filters = await loadReviewParticipantFilters(orgId);

  const { data, error } = await supabase
    .from("calendar_participant_reviews")
    .select(
      `
      id,
      email,
      display_name,
      calendar_events (
        title,
        start_at
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Failed to load calendar review queue: ${error.message}`);
  }

  const groups = new Map<string, CalendarUnmatchedGroup>();

  for (const row of data ?? []) {
    if (isNonPersonParticipant(row.email)) {
      continue;
    }

    const email = row.email.toLowerCase();
    const event = row.calendar_events;
    const existing = groups.get(email);

    if (existing) {
      existing.meetingCount += 1;
      existing.reviewIds.push(row.id);
      continue;
    }

    groups.set(email, {
      email: row.email,
      displayName: row.display_name,
      meetingCount: 1,
      sampleMeetingTitle: event?.title ?? null,
      sampleMeetingDate: event?.start_at ?? null,
      reviewIds: [row.id],
    });
  }

  const partitioned = partitionReviewGroups([...groups.values()], filters);

  return {
    external: partitioned.external.slice(0, limit),
    internal: partitioned.internal,
  };
}

export async function listRecentMatchedCalendarMeetings(
  limit = 25,
): Promise<CalendarMatchedMeetingLists> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const filters = await loadReviewParticipantFilters(orgId);

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id,
      title,
      activity_date,
      profile_id,
      profiles (
        full_name,
        email
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("source", "calendar_sync")
    .order("activity_date", { ascending: false })
    .limit(limit * 2);

  if (error) {
    throw new Error(`Failed to load matched meetings: ${error.message}`);
  }

  const meetings = (data ?? [])
    .map((row) => {
      const profile = row.profiles;
      if (!profile) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        activityDate: row.activity_date,
        profileId: row.profile_id,
        profileName: profile.full_name,
        profileEmail: profile.email,
      };
    })
    .filter((row): row is CalendarMatchedMeeting => row !== null);

  const partitioned = partitionMatchedMeetings(meetings, filters);

  return {
    external: partitioned.external.slice(0, limit),
    internal: partitioned.internal.slice(0, limit),
  };
}

export type CalendarProfileMatch = {
  id: string;
  fullName: string;
  email: string | null;
  matchReason: "exact_email" | "name_or_email";
};

export async function searchProfilesForCalendarLink(
  query: string,
  calendarEmail?: string,
): Promise<CalendarProfileMatch[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const trimmed = query.trim().replace(/[%_]/g, "");
  const normalisedCalendarEmail = calendarEmail
    ? calendarEmail.trim().toLowerCase()
    : null;

  const filters = await loadReviewParticipantFilters(orgId);
  const results: CalendarProfileMatch[] = [];
  const seen = new Set<string>();

  function addProfile(
    row: { id: string; full_name: string; email: string | null },
    matchReason: CalendarProfileMatch["matchReason"],
  ) {
    if (seen.has(row.id)) {
      return;
    }

    if (row.email && isInternalParticipant(row.email, filters)) {
      return;
    }

    seen.add(row.id);
    results.push({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      matchReason,
    });
  }

  if (normalisedCalendarEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .ilike("email", normalisedCalendarEmail)
      .limit(1);

    if (error) {
      throw new Error(`Failed to search profiles by email: ${error.message}`);
    }

    if (data?.[0]) {
      addProfile(data[0], "exact_email");
    }
  }

  if (trimmed.length >= 2) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
      .order("full_name")
      .limit(12);

    if (error) {
      throw new Error(`Failed to search profiles: ${error.message}`);
    }

    for (const row of data ?? []) {
      const isExactEmail =
        Boolean(row.email) &&
        Boolean(normalisedCalendarEmail) &&
        row.email!.trim().toLowerCase() === normalisedCalendarEmail;

      addProfile(row, isExactEmail ? "exact_email" : "name_or_email");
    }
  }

  if (normalisedCalendarEmail && results.length < 8) {
    const localPart = normalisedCalendarEmail.split("@")[0] ?? "";
    const localPartAlreadySearched =
      trimmed.length >= 2 &&
      (localPart.includes(trimmed) || trimmed.includes(localPart));

    if (localPart.length >= 3 && !localPartAlreadySearched) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("org_id", orgId)
        .or(`full_name.ilike.%${localPart}%,email.ilike.%${localPart}%`)
        .order("full_name")
        .limit(8);

      if (error) {
        throw new Error(`Failed to search profiles: ${error.message}`);
      }

      for (const row of data ?? []) {
        addProfile(row, "name_or_email");
      }
    }
  }

  return results.slice(0, 8);
}
