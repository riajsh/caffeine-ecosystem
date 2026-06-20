import "server-only";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type CalendarSyncReviewSummary = {
  syncing: boolean;
  lastRunAt: string | null;
  eventsProcessed: number;
  activitiesCreated: number;
  reviewsQueued: number;
  pendingReviewCount: number;
  matchedMeetingCount: number;
  accountEmail: string | null;
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

  const { count: pendingReviewCount, error: pendingError } = await supabase
    .from("calendar_participant_reviews")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");

  if (pendingError) {
    throw new Error(`Failed to count pending reviews: ${pendingError.message}`);
  }

  const { count: matchedMeetingCount, error: matchedError } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source", "calendar_sync");

  if (matchedError) {
    throw new Error(`Failed to count matched meetings: ${matchedError.message}`);
  }

  return {
    syncing: meta.syncing === true,
    lastRunAt: account?.last_sync_at ?? meta.last_run?.at ?? null,
    eventsProcessed: stats?.eventsProcessed ?? 0,
    activitiesCreated: stats?.activitiesCreated ?? matchedMeetingCount ?? 0,
    reviewsQueued: stats?.reviewsQueued ?? pendingReviewCount ?? 0,
    pendingReviewCount: pendingReviewCount ?? 0,
    matchedMeetingCount: matchedMeetingCount ?? 0,
    accountEmail: account?.email ?? null,
  };
}

export async function listPendingCalendarReviewGroups(
  limit = 50,
): Promise<CalendarUnmatchedGroup[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

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

    if (groups.size >= limit) {
      break;
    }
  }

  return [...groups.values()];
}

export async function listRecentMatchedCalendarMeetings(
  limit = 25,
): Promise<CalendarMatchedMeeting[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(
      `
      id,
      title,
      activity_date,
      profile_id,
      profiles (
        full_name
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("source", "calendar_sync")
    .order("activity_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load matched meetings: ${error.message}`);
  }

  return (data ?? [])
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
      };
    })
    .filter((row): row is CalendarMatchedMeeting => row !== null);
}

export async function searchProfilesForCalendarLink(
  query: string,
): Promise<Array<{ id: string; fullName: string; email: string | null }>> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const trimmed = query.trim().replace(/[%_]/g, "");

  if (trimmed.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("org_id", orgId)
    .or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .order("full_name")
    .limit(8);

  if (error) {
    throw new Error(`Failed to search profiles: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  }));
}
