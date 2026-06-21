import "server-only";

import { getOrgId } from "@/lib/auth/session";
import { listProfileIds } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SearchFilters = {
  tagId?: string;
  ownerUserId?: string;
  status?: Database["public"]["Enums"]["relationship_status"];
};

export type SearchEntityType =
  | "profile"
  | "activity"
  | "event"
  | "thread"
  | "message";

export type SearchResult = {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string | null;
  rank: number;
  href: string;
  profileId?: string;
  primaryOwnerName?: string | null;
  lastInteractionAt?: string | null;
  activityDate?: string;
  eventDate?: string;
  contextLabel: string;
};

type SearchIndexRow = {
  id: string | null;
  entity_type: string | null;
  title: string | null;
  subtitle: string | null;
};

const ENTITY_LIMIT = 10;
const OVERALL_LIMIT = 50;

const ENTITY_LABELS: Record<SearchEntityType, string> = {
  profile: "Profile",
  activity: "Activity",
  event: "Event",
  thread: "Email thread",
  message: "Email message",
};

function normalizeQuery(query: string): string | null {
  const trimmed = query.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function searchIndexRows(
  entityType: string,
  query: string,
  orgId: string,
): Promise<Array<SearchIndexRow & { id: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("search_index")
    .select("id, entity_type, title, subtitle")
    .eq("org_id", orgId)
    .eq("entity_type", entityType)
    .textSearch("fts", query, { type: "plain", config: "english" })
    .limit(ENTITY_LIMIT);

  if (error) {
    throw new Error(`Search failed for ${entityType}: ${error.message}`);
  }

  return (data ?? []).filter((row): row is SearchIndexRow & { id: string } =>
    Boolean(row.id),
  );
}

async function profilesFromTags(
  tagIds: string[],
  orgId: string,
): Promise<Array<{ id: string; full_name: string; organisation_name: string | null; tag_name: string }>> {
  if (tagIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_tags")
    .select(
      `
      profile_id,
      tags ( name ),
      profiles!inner (
        id,
        full_name,
        organisation_name
      )
    `,
    )
    .eq("org_id", orgId)
    .in("tag_id", tagIds);

  if (error) {
    throw new Error(`Tag profile search failed: ${error.message}`);
  }

  return (data ?? []).flatMap((row) => {
    const profile = row.profiles as {
      id: string;
      full_name: string;
      organisation_name: string | null;
    } | null;
    const tag = row.tags as { name: string } | null;

    if (!profile) {
      return [];
    }

    return [
      {
        id: profile.id,
        full_name: profile.full_name,
        organisation_name: profile.organisation_name,
        tag_name: tag?.name ?? "Tag",
      },
    ];
  });
}

async function enrichProfiles(
  profileIds: string[],
): Promise<
  Map<
    string,
    { primaryOwnerName: string | null; lastInteractionAt: string | null }
  >
> {
  const map = new Map<
    string,
    { primaryOwnerName: string | null; lastInteractionAt: string | null }
  >();

  if (profileIds.length === 0) {
    return map;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      relationships (
        relationship_owners (
          is_primary,
          last_interaction_at,
          users ( full_name )
        )
      )
    `,
    )
    .in("id", profileIds);

  if (error) {
    throw new Error(`Failed to enrich search profiles: ${error.message}`);
  }

  for (const profile of data ?? []) {
    const owners = profile.relationships?.[0]?.relationship_owners ?? [];
    const primary =
      owners.find((owner) => owner.is_primary) ?? owners[0] ?? null;
    const user = primary?.users as { full_name: string } | null;

    map.set(profile.id, {
      primaryOwnerName: user?.full_name ?? null,
      lastInteractionAt: primary?.last_interaction_at ?? null,
    });
  }

  return map;
}

async function enrichActivities(
  activityIds: string[],
): Promise<
  Map<string, { profileId: string; activityDate: string; summary: string | null }>
> {
  const map = new Map<
    string,
    { profileId: string; activityDate: string; summary: string | null }
  >();

  if (activityIds.length === 0) {
    return map;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, profile_id, activity_date, summary")
    .in("id", activityIds);

  if (error) {
    throw new Error(`Failed to enrich search activities: ${error.message}`);
  }

  for (const activity of data ?? []) {
    map.set(activity.id, {
      profileId: activity.profile_id,
      activityDate: activity.activity_date,
      summary: activity.summary,
    });
  }

  return map;
}

async function enrichEvents(
  eventIds: string[],
): Promise<Map<string, { eventDate: string }>> {
  const map = new Map<string, { eventDate: string }>();

  if (eventIds.length === 0) {
    return map;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_date")
    .in("id", eventIds);

  if (error) {
    throw new Error(`Failed to enrich search events: ${error.message}`);
  }

  for (const event of data ?? []) {
    map.set(event.id, { eventDate: event.event_date });
  }

  return map;
}

async function enrichThreads(
  threadIds: string[],
): Promise<Map<string, { subject: string | null }>> {
  const map = new Map<string, { subject: string | null }>();

  if (threadIds.length === 0) {
    return map;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_threads")
    .select("id, subject")
    .in("id", threadIds);

  if (error) {
    throw new Error(`Failed to enrich search threads: ${error.message}`);
  }

  for (const thread of data ?? []) {
    map.set(thread.id, { subject: thread.subject });
  }

  return map;
}

async function searchEmailBodies(
  query: string,
): Promise<
  Array<{
    id: string;
    thread_id: string;
    rank: number;
    sent_at: string | null;
    gmail_message_id: string;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_email_message_bodies", {
    p_query: query,
    p_limit: ENTITY_LIMIT,
  });

  if (error) {
    throw new Error(`Email body search failed: ${error.message}`);
  }

  return data ?? [];
}

async function getAllowedProfileIds(
  filters?: SearchFilters,
): Promise<Set<string> | null> {
  if (!filters?.tagId && !filters?.ownerUserId && !filters?.status) {
    return null;
  }

  const profileIds = await listProfileIds({
    tagId: filters.tagId,
    ownerUserId: filters.ownerUserId,
    status: filters.status,
  });

  return new Set(profileIds);
}

function applyProfileFilters(
  results: SearchResult[],
  allowedProfileIds: Set<string> | null,
): SearchResult[] {
  if (!allowedProfileIds) {
    return results;
  }

  return results.filter((result) => {
    if (result.entityType === "profile") {
      return allowedProfileIds.has(result.id);
    }

    if (result.entityType === "activity") {
      return Boolean(
        result.profileId && allowedProfileIds.has(result.profileId),
      );
    }

    return true;
  });
}

export async function search(
  query: string,
  filters?: SearchFilters,
): Promise<SearchResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  const orgId = await getOrgId();
  const allowedProfileIds = await getAllowedProfileIds(filters);

  const [profiles, activities, events, threads, tagRows, emailBodies] =
    await Promise.all([
      searchIndexRows("profile", normalized, orgId),
      searchIndexRows("activity", normalized, orgId),
      searchIndexRows("event", normalized, orgId),
      searchIndexRows("thread", normalized, orgId),
      searchIndexRows("tag", normalized, orgId),
      searchEmailBodies(normalized),
    ]);

  const tagProfileRows = await profilesFromTags(
    tagRows.map((row) => row.id),
    orgId,
  );

  const profileIds = new Set<string>();
  const results: SearchResult[] = [];

  for (const row of profiles) {
    profileIds.add(row.id);
    results.push({
      id: row.id,
      entityType: "profile",
      title: row.title ?? "Unknown profile",
      subtitle: row.subtitle,
      rank: 1,
      href: `/profiles/${row.id}`,
      profileId: row.id,
      contextLabel: ENTITY_LABELS.profile,
    });
  }

  for (const row of tagProfileRows) {
    if (profileIds.has(row.id)) {
      continue;
    }
    profileIds.add(row.id);
    results.push({
      id: row.id,
      entityType: "profile",
      title: row.full_name,
      subtitle: row.organisation_name,
      rank: 0.9,
      href: `/profiles/${row.id}`,
      profileId: row.id,
      contextLabel: `Profile · Tag: ${row.tag_name}`,
    });
  }

  const activityIds = activities.map((row) => row.id);
  const eventIds = events.map((row) => row.id);
  const threadIds = emailBodies.map((message) => message.thread_id);

  const [profileEnrichment, activityEnrichment, eventEnrichment, threadEnrichment] =
    await Promise.all([
      enrichProfiles([...profileIds]),
      enrichActivities(activityIds),
      enrichEvents(eventIds),
      enrichThreads(threadIds),
    ]);

  for (const result of results) {
    if (result.entityType !== "profile" || !result.profileId) {
      continue;
    }
    const enrichment = profileEnrichment.get(result.profileId);
    if (enrichment) {
      result.primaryOwnerName = enrichment.primaryOwnerName;
      result.lastInteractionAt = enrichment.lastInteractionAt;
    }
  }

  for (const row of activities) {
    const enrichment = activityEnrichment.get(row.id);
    results.push({
      id: row.id,
      entityType: "activity",
      title: row.title ?? "Activity",
      subtitle: enrichment?.summary ?? row.subtitle,
      rank: 0.8,
      href: enrichment
        ? `/profiles/${enrichment.profileId}?tab=activity`
        : "/profiles",
      profileId: enrichment?.profileId,
      activityDate: enrichment?.activityDate,
      contextLabel: ENTITY_LABELS.activity,
    });
  }

  for (const row of events) {
    const enrichment = eventEnrichment.get(row.id);
    results.push({
      id: row.id,
      entityType: "event",
      title: row.title ?? "Event",
      subtitle: row.subtitle,
      rank: 0.7,
      href: `/events/${row.id}`,
      eventDate: enrichment?.eventDate,
      contextLabel: ENTITY_LABELS.event,
    });
  }

  for (const row of threads) {
    results.push({
      id: row.id,
      entityType: "thread",
      title: row.title ?? "Email thread",
      subtitle: row.subtitle,
      rank: 0.6,
      href: "/profiles",
      contextLabel: ENTITY_LABELS.thread,
    });
  }

  for (const message of emailBodies) {
    const thread = threadEnrichment.get(message.thread_id);
    results.push({
      id: message.id,
      entityType: "message",
      title: thread?.subject ?? message.gmail_message_id,
      subtitle: message.sent_at ? `Sent ${message.sent_at}` : null,
      rank: message.rank,
      href: "/profiles",
      contextLabel: ENTITY_LABELS.message,
    });
  }

  return applyProfileFilters(results, allowedProfileIds)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, OVERALL_LIMIT);
}

export function groupSearchResults(
  results: SearchResult[],
): Record<SearchEntityType, SearchResult[]> {
  const groups: Record<SearchEntityType, SearchResult[]> = {
    profile: [],
    activity: [],
    event: [],
    thread: [],
    message: [],
  };

  for (const result of results) {
    groups[result.entityType].push(result);
  }

  return groups;
}
