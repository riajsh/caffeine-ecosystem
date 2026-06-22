import "server-only";

import { pastActivityCutoffIso, isPastOrPresentActivityDate } from "@/lib/activities/past-only";
import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  isInternalParticipant,
  isNonPersonParticipant,
  loadOrgParticipantFilters,
  type OrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import {
  groupEmailsByWorkDomain,
  workEmailDomain,
} from "@/lib/integrations/calendar/company-suggestions";
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
  suggestedCompanies: string[];
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

  function updatePastSample(
    group: CalendarUnmatchedGroup,
    title: string | null | undefined,
    startAt: string | null | undefined,
  ) {
    if (!startAt || !isPastOrPresentActivityDate(startAt)) {
      return;
    }

    if (
      !group.sampleMeetingDate ||
      new Date(startAt).getTime() > new Date(group.sampleMeetingDate).getTime()
    ) {
      group.sampleMeetingTitle = title ?? null;
      group.sampleMeetingDate = startAt;
    }
  }

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
      updatePastSample(existing, event?.title, event?.start_at ?? null);
      continue;
    }

    const group: CalendarUnmatchedGroup = {
      email: row.email,
      displayName: row.display_name,
      meetingCount: 1,
      sampleMeetingTitle: null,
      sampleMeetingDate: null,
      reviewIds: [row.id],
      suggestedCompanies: [],
    };
    updatePastSample(group, event?.title, event?.start_at ?? null);
    groups.set(email, group);
  }

  const partitioned = partitionReviewGroups([...groups.values()], filters);

  return {
    external: partitioned.external.slice(0, limit),
    internal: partitioned.internal,
  };
}

async function loadCompaniesForEmailDomain(
  orgId: string,
  domain: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("organisation_name")
    .eq("org_id", orgId)
    .ilike("email", `%@${domain}`)
    .not("organisation_name", "is", null);

  if (error) {
    throw new Error(`Failed to load company suggestions: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const name = row.organisation_name?.trim();
    if (!name) {
      continue;
    }

    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(
      ([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount ||
        leftName.localeCompare(rightName, undefined, { sensitivity: "base" }),
    )
    .map(([name]) => name)
    .slice(0, 8);
}

async function attachCompanySuggestions(
  orgId: string,
  groups: CalendarUnmatchedGroup[],
): Promise<void> {
  const emailsByDomain = groupEmailsByWorkDomain(groups.map((group) => group.email));
  if (emailsByDomain.size === 0) {
    for (const group of groups) {
      group.suggestedCompanies = [];
    }
    return;
  }

  const companiesByDomain = new Map<string, string[]>();

  await Promise.all(
    [...emailsByDomain.keys()].map(async (domain) => {
      const companies = await loadCompaniesForEmailDomain(orgId, domain);
      companiesByDomain.set(domain, companies);
    }),
  );

  for (const group of groups) {
    const domain = workEmailDomain(group.email);
    group.suggestedCompanies = domain
      ? (companiesByDomain.get(domain) ?? [])
      : [];
  }
}

export async function listPendingCalendarReviewGroupsWithSuggestions(
  limit = 50,
): Promise<CalendarReviewGroupLists> {
  const groups = await listPendingCalendarReviewGroups(limit);
  const orgId = await getOrgId();

  await attachCompanySuggestions(orgId, groups.external);
  await attachCompanySuggestions(orgId, groups.internal);

  return groups;
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
    .lte("activity_date", pastActivityCutoffIso())
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

export type CalendarProfileSearchResult = {
  profiles: CalendarProfileMatch[];
  exactEmailMatch: boolean;
};

export async function searchProfilesForCalendarLink(
  query: string,
  calendarEmail?: string,
): Promise<CalendarProfileSearchResult> {
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
  let exactEmailMatch = false;

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
      exactEmailMatch = true;
      addProfile(data[0], "exact_email");
    }
  }

  const normalisedQuery = trimmed.toLowerCase();
  const queryIsCalendarEmail =
    Boolean(normalisedCalendarEmail) &&
    normalisedQuery === normalisedCalendarEmail;

  let nameSearchTerm = queryIsCalendarEmail ? "" : trimmed;

  if (!nameSearchTerm && normalisedCalendarEmail) {
    const localPart = normalisedCalendarEmail.split("@")[0] ?? "";
    if (localPart.length >= 2) {
      nameSearchTerm = localPart;
    }
  }

  if (nameSearchTerm.length >= 2) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .or(
        `full_name.ilike.%${nameSearchTerm}%,email.ilike.%${nameSearchTerm}%`,
      )
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
      nameSearchTerm.length >= 2 &&
      (localPart.includes(nameSearchTerm.toLowerCase()) ||
        nameSearchTerm.toLowerCase().includes(localPart));

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

  return {
    profiles: results.slice(0, 8),
    exactEmailMatch,
  };
}
