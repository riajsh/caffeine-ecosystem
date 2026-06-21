import "server-only";

import { notFound } from "next/navigation";

import { getOrgId, requireUser } from "@/lib/auth/session";
import { formatLocation } from "@/lib/format/location";
import { PROFILE_ACTIVITY_LIMIT } from "@/lib/format/provenance";
import {
  isInternalParticipant,
  loadOrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CreateProfileInput,
  UpdateProfileInput,
} from "@/lib/validators/profiles";
import type { Database } from "@/types/database";

type OwnerStrength = Database["public"]["Enums"]["owner_strength"];
type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];
type RelationshipType = Database["public"]["Enums"]["relationship_type"];
type ActivityType = Database["public"]["Enums"]["activity_type"];
type ActivitySource = Database["public"]["Enums"]["activity_source"];
type IntroductionOutcome = Database["public"]["Enums"]["introduction_outcome"];
type ConnectionType = Database["public"]["Enums"]["connection_type"];
type ConnectionStrength = Database["public"]["Enums"]["connection_strength"];
type ConnectionSource = Database["public"]["Enums"]["connection_source"];
type EventType = Database["public"]["Enums"]["event_type"];

export type ProfileListItem = {
  id: string;
  fullName: string;
  organisationName: string | null;
  occupation: string | null;
  location: string | null;
  source: string;
  relationshipStatus: RelationshipStatus | null;
  primaryOwner: {
    userId: string;
    fullName: string;
  } | null;
  strength: OwnerStrength | null;
  lastInteractionAt: string | null;
  tags: Array<{ id: string; name: string; category: string }>;
};

export type ProfileOwner = {
  id: string;
  userId: string;
  fullName: string;
  strength: OwnerStrength;
  isPrimary: boolean;
  lastInteractionAt: string | null;
  notes: string | null;
};

export type ProfileSource = {
  id: string;
  sourceType: Database["public"]["Enums"]["relationship_source_type"];
  sourceLabel: string;
};

export type ProfileActivity = {
  id: string;
  activityType: ActivityType;
  title: string;
  summary: string | null;
  activityDate: string;
  source: ActivitySource;
  introductionOutcome: IntroductionOutcome | null;
};

export type ProfileEvent = {
  id: string;
  title: string;
  eventType: EventType;
  eventDate: string;
  location: string | null;
};

export type ProfileConnection = {
  id: string;
  otherProfileId: string;
  otherFullName: string;
  connectionType: ConnectionType;
  strength: ConnectionStrength;
  source: ConnectionSource;
  notes: string | null;
};

export type ProfileDetail = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  organisationName: string | null;
  occupation: string | null;
  location: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  bio: string | null;
  source: string;
  relationship: {
    id: string;
    status: RelationshipStatus;
    relationshipType: RelationshipType;
    notes: string | null;
  } | null;
  owners: ProfileOwner[];
  sources: ProfileSource[];
  tags: Array<{ id: string; name: string; category: string }>;
  activities: ProfileActivity[];
  activitiesTruncated: boolean;
  events: ProfileEvent[];
  connections: ProfileConnection[];
  isInternalProfile: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string;
  organisation_name: string | null;
  occupation: string | null;
  location_city: string | null;
  location_country: string | null;
  source: string;
  relationships: Array<{
    status?: RelationshipStatus;
    relationship_owners: Array<{
      strength: OwnerStrength;
      is_primary: boolean;
      last_interaction_at: string | null;
      user_id: string;
      users: { id: string; full_name: string } | null;
    }>;
  }> | null;
  profile_tags: Array<{
    tags: { id: string; name: string; category: string } | null;
  }> | null;
};

type ProfileDetailRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  organisation_name: string | null;
  occupation: string | null;
  location_city: string | null;
  location_country: string | null;
  bio: string | null;
  source: string;
  relationships: Array<{
    id: string;
    status: RelationshipStatus;
    relationship_type: RelationshipType;
    notes: string | null;
    relationship_owners: Array<{
      id: string;
      strength: OwnerStrength;
      is_primary: boolean;
      last_interaction_at: string | null;
      notes: string | null;
      user_id: string;
      users: { id: string; full_name: string } | null;
    }>;
    relationship_sources: Array<{
      id: string;
      source_type: Database["public"]["Enums"]["relationship_source_type"];
      source_label: string;
    }>;
  }> | null;
  profile_tags: Array<{
    tags: { id: string; name: string; category: string } | null;
  }> | null;
  activities: Array<{
    id: string;
    activity_type: ActivityType;
    title: string;
    summary: string | null;
    activity_date: string;
    source: ActivitySource;
    introduction_outcome: IntroductionOutcome | null;
  }> | null;
  event_attendees: Array<{
    events: {
      id: string;
      title: string;
      event_type: EventType;
      event_date: string;
      location: string | null;
    } | null;
  }> | null;
};

type ConnectionRow = {
  id: string;
  connection_type: ConnectionType;
  strength: ConnectionStrength;
  source: ConnectionSource;
  notes: string | null;
  profile_a_id: string;
  profile_b_id: string;
  profile_a: { id: string; full_name: string } | null;
  profile_b: { id: string; full_name: string } | null;
};

function mapTags(
  profileTags: ProfileDetailRow["profile_tags"],
): ProfileDetail["tags"] {
  return (profileTags ?? [])
    .map((profileTag) => profileTag.tags)
    .filter((tag): tag is { id: string; name: string; category: string } =>
      Boolean(tag),
    );
}

function mapProfileRow(profile: ProfileRow): ProfileListItem {
  const relationship = profile.relationships?.[0];
  const owners = relationship?.relationship_owners ?? [];
  const primaryOwnerRow =
    owners.find((owner) => owner.is_primary) ?? owners[0] ?? null;
  const ownerUser = primaryOwnerRow?.users;

  return {
    id: profile.id,
    fullName: profile.full_name,
    organisationName: profile.organisation_name,
    occupation: profile.occupation,
    location: formatLocation(profile.location_city, profile.location_country),
    source: profile.source,
    relationshipStatus: relationship?.status ?? null,
    primaryOwner: ownerUser
      ? { userId: ownerUser.id, fullName: ownerUser.full_name }
      : null,
    strength: primaryOwnerRow?.strength ?? null,
    lastInteractionAt: primaryOwnerRow?.last_interaction_at ?? null,
    tags: mapTags(profile.profile_tags),
  };
}

function mapConnectionRow(
  connection: ConnectionRow,
  profileId: string,
): ProfileConnection {
  const isProfileA = connection.profile_a_id === profileId;
  const otherProfile = isProfileA ? connection.profile_b : connection.profile_a;

  return {
    id: connection.id,
    otherProfileId: isProfileA
      ? connection.profile_b_id
      : connection.profile_a_id,
    otherFullName: otherProfile?.full_name ?? "Unknown",
    connectionType: connection.connection_type,
    strength: connection.strength,
    source: connection.source,
    notes: connection.notes,
  };
}

function mapProfileDetailRow(
  profile: ProfileDetailRow,
  connections: ConnectionRow[],
  options: { isInternalProfile: boolean; activitiesTruncated: boolean },
): ProfileDetail {
  const relationship = profile.relationships?.[0];

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    linkedinUrl: profile.linkedin_url,
    websiteUrl: profile.website_url,
    organisationName: profile.organisation_name,
    occupation: profile.occupation,
    location: formatLocation(profile.location_city, profile.location_country),
    locationCity: profile.location_city,
    locationCountry: profile.location_country,
    bio: profile.bio,
    source: profile.source,
    relationship: relationship
      ? {
          id: relationship.id,
          status: relationship.status,
          relationshipType: relationship.relationship_type,
          notes: relationship.notes,
        }
      : null,
    owners: (relationship?.relationship_owners ?? [])
      .map((owner) => {
        const user = owner.users;
        if (!user) {
          return null;
        }

        return {
          id: owner.id,
          userId: user.id,
          fullName: user.full_name,
          strength: owner.strength,
          isPrimary: owner.is_primary,
          lastInteractionAt: owner.last_interaction_at,
          notes: owner.notes,
        };
      })
      .filter((owner): owner is ProfileOwner => owner !== null),
    sources: (relationship?.relationship_sources ?? []).map((source) => ({
      id: source.id,
      sourceType: source.source_type,
      sourceLabel: source.source_label,
    })),
    tags: mapTags(profile.profile_tags),
    activities: (profile.activities ?? []).map((activity) => ({
      id: activity.id,
      activityType: activity.activity_type,
      title: activity.title,
      summary: activity.summary,
      activityDate: activity.activity_date,
      source: activity.source,
      introductionOutcome: activity.introduction_outcome,
    })),
    events: (profile.event_attendees ?? [])
      .map((attendee) => attendee.events)
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.event_type,
        eventDate: event.event_date,
        location: event.location,
      })),
    connections: connections.map((connection) =>
      mapConnectionRow(connection, profile.id),
    ),
    isInternalProfile: options.isInternalProfile,
    activitiesTruncated: options.activitiesTruncated,
  };
}

export async function listProfiles(options?: {
  tagId?: string;
  ownerUserId?: string;
  status?: Database["public"]["Enums"]["relationship_status"];
  company?: string;
}): Promise<ProfileListItem[]> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const useRelationshipInner = Boolean(options?.ownerUserId || options?.status);
  const useOwnerInner = Boolean(options?.ownerUserId);

  const relationshipSelect = useRelationshipInner
    ? `relationships!inner (
        status,
        relationship_owners${useOwnerInner ? "!inner" : ""} (
          strength,
          is_primary,
          last_interaction_at,
          user_id,
          users (
            id,
            full_name
          )
        )
      )`
    : `relationships (
        status,
        relationship_owners (
          strength,
          is_primary,
          last_interaction_at,
          user_id,
          users (
            id,
            full_name
          )
        )
      )`;

  const profileTagsSelect = options?.tagId
    ? "profile_tags!inner(tags(id, name, category))"
    : `profile_tags (
        tags (
          id,
          name,
          category
        )
      )`;

  let query = supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      organisation_name,
      occupation,
      location_city,
      location_country,
      source,
      ${relationshipSelect},
      ${profileTagsSelect}
    `,
    )
    .eq("org_id", orgId)
    .order("full_name");

  if (options?.tagId) {
    query = query.eq("profile_tags.tag_id", options.tagId);
  }

  if (options?.ownerUserId) {
    query = query.eq("relationships.relationship_owners.user_id", options.ownerUserId);
  }

  if (options?.status) {
    query = query.eq("relationships.status", options.status);
  }

  if (options?.company) {
    query = query.ilike("organisation_name", options.company);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list profiles: ${error.message}`);
  }

  return ((data ?? []) as unknown as ProfileRow[]).map(mapProfileRow);
}

export async function getProfileById(id: string): Promise<ProfileDetail> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      linkedin_url,
      website_url,
      organisation_name,
      occupation,
      location_city,
      location_country,
      bio,
      source,
      relationships (
        id,
        status,
        relationship_type,
        notes,
        relationship_owners (
          id,
          strength,
          is_primary,
          last_interaction_at,
          notes,
          user_id,
          users (
            id,
            full_name
          )
        ),
        relationship_sources (
          id,
          source_type,
          source_label
        )
      ),
      profile_tags (
        tags (
          id,
          name,
          category
        )
      ),
      activities (
        id,
        activity_type,
        title,
        summary,
        activity_date,
        source,
        introduction_outcome
      ),
      event_attendees (
        events (
          id,
          title,
          event_type,
          event_date,
          location
        )
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .order("activity_date", {
      foreignTable: "activities",
      ascending: false,
    })
    .limit(PROFILE_ACTIVITY_LIMIT, { foreignTable: "activities" })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const { data: connections, error: connectionsError } = await supabase
    .from("connections")
    .select(
      `
      id,
      connection_type,
      strength,
      source,
      notes,
      profile_a_id,
      profile_b_id,
      profile_a:profiles!connections_profile_a_id_fkey (
        id,
        full_name
      ),
      profile_b:profiles!connections_profile_b_id_fkey (
        id,
        full_name
      )
    `,
    )
    .eq("org_id", orgId)
    .or(`profile_a_id.eq.${id},profile_b_id.eq.${id}`);

  if (connectionsError) {
    throw new Error(
      `Failed to load profile connections: ${connectionsError.message}`,
    );
  }

  const filters = await loadOrgParticipantFilters(createAdminClient(), orgId);
  const isInternalProfile = data.email
    ? isInternalParticipant(data.email, filters)
    : false;

  const { count: activityCount, error: activityCountError } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("profile_id", id);

  if (activityCountError) {
    throw new Error(
      `Failed to count profile activities: ${activityCountError.message}`,
    );
  }

  const loadedActivities = (data as ProfileDetailRow).activities?.length ?? 0;

  return mapProfileDetailRow(
    data as ProfileDetailRow,
    (connections ?? []) as ConnectionRow[],
    {
      isInternalProfile,
      activitiesTruncated: (activityCount ?? 0) > loadedActivities,
    },
  );
}

export type ProfilePickerOption = {
  id: string;
  fullName: string;
  organisationName: string | null;
};

export async function searchProfilesForPicker(
  query: string,
  limit = 10,
): Promise<ProfilePickerOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, organisation_name")
    .eq("org_id", orgId)
    .ilike("full_name", `%${trimmed}%`)
    .order("full_name")
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search profiles: ${error.message}`);
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    organisationName: profile.organisation_name,
  }));
}

export async function createProfile(input: CreateProfileInput): Promise<string> {
  const user = await requireUser();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const organisationName = input.organisationName ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      org_id: orgId,
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin_url: input.linkedinUrl ?? null,
      website_url: input.websiteUrl ?? null,
      organisation_name: organisationName,
      organisation_name_normalised: normaliseOrganisationName(organisationName),
      occupation: input.occupation ?? null,
      location_city: input.locationCity ?? null,
      location_country: input.locationCountry ?? null,
      bio: input.bio ?? null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A profile with this email already exists.");
    }
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  const { data: relationship, error: relationshipError } = await supabase
    .from("relationships")
    .insert({
      org_id: orgId,
      profile_id: data.id,
      status: "prospect",
      relationship_type: "other",
    })
    .select("id")
    .single();

  if (relationshipError) {
    throw new Error(`Failed to create relationship: ${relationshipError.message}`);
  }

  const { error: sourceError } = await supabase
    .from("relationship_sources")
    .insert({
      org_id: orgId,
      relationship_id: relationship.id,
      source_type: "manual",
      source_label: "Created manually",
      created_by: user.id,
    });

  if (sourceError) {
    throw new Error(
      `Failed to create relationship source: ${sourceError.message}`,
    );
  }

  return data.id;
}

export async function updateProfile(input: UpdateProfileInput): Promise<void> {
  await requireUser();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const organisationName = input.organisationName ?? null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin_url: input.linkedinUrl ?? null,
      website_url: input.websiteUrl ?? null,
      organisation_name: organisationName,
      organisation_name_normalised: normaliseOrganisationName(organisationName),
      occupation: input.occupation ?? null,
      location_city: input.locationCity ?? null,
      location_country: input.locationCountry ?? null,
      bio: input.bio ?? null,
    })
    .eq("id", input.profileId)
    .eq("org_id", orgId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Another profile already uses this email address.");
    }
    throw new Error(`Failed to update profile: ${error.message}`);
  }
}
