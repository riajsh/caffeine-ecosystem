import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarParticipant } from "@/lib/integrations/calendar/types";
import { isBeyondCalendarLookahead } from "@/lib/integrations/calendar/env";
import { ensureRelationshipForProfile } from "@/lib/integrations/calendar/review-utils";
import {
  hasExternalParticipant,
  isInternalParticipant,
  normaliseEmail,
  type OrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export type OrgProfileByEmail = Map<
  string,
  { id: string; email: string | null }
>;

export { hasExternalParticipant };

export async function loadOrgProfilesByEmail(
  supabase: AdminClient,
  orgId: string,
): Promise<OrgProfileByEmail> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("org_id", orgId)
    .not("email", "is", null);

  if (error) {
    throw new Error(`Failed to load org profiles: ${error.message}`);
  }

  const profilesByEmail: OrgProfileByEmail = new Map();

  for (const profile of data ?? []) {
    if (!profile.email) {
      continue;
    }
    profilesByEmail.set(profile.email.toLowerCase(), profile);
  }

  return profilesByEmail;
}

export async function processCalendarParticipants(
  supabase: AdminClient,
  params: {
    orgId: string;
    eventId: string;
    googleEventId: string;
    title: string | null;
    startAt: string | null;
    participants: CalendarParticipant[];
    participantFilters: OrgParticipantFilters;
    ignoredParticipantEmails: ReadonlySet<string>;
    profilesByEmail: OrgProfileByEmail;
  },
): Promise<{ activitiesCreated: number; reviewsQueued: number }> {
  let activitiesCreated = 0;
  let reviewsQueued = 0;
  const relationshipIds = new Map<string, string>();

  for (const participant of params.participants) {
    const email = normaliseEmail(participant.email);
    if (!email || isInternalParticipant(email, params.participantFilters)) {
      continue;
    }

    const profile = params.profilesByEmail.get(email);

    if (
      profile?.email &&
      isInternalParticipant(profile.email, params.participantFilters)
    ) {
      continue;
    }

    if (isBeyondCalendarLookahead(params.startAt)) {
      continue;
    }

    if (params.ignoredParticipantEmails.has(email)) {
      continue;
    }

    if (profile) {
      let relationshipId = relationshipIds.get(profile.id);
      if (!relationshipId) {
        relationshipId = await ensureRelationshipForProfile(
          supabase,
          params.orgId,
          profile.id,
        );
        relationshipIds.set(profile.id, relationshipId);
      }

      const activityDate = params.startAt ?? new Date().toISOString();
      const { data: insertedActivities, error: activityError } = await supabase
        .from("activities")
        .upsert(
          {
            org_id: params.orgId,
            profile_id: profile.id,
            activity_type: "meeting",
            title: params.title ?? "Calendar meeting",
            summary: null,
            activity_date: activityDate,
            source: "calendar_sync",
            source_ref: params.googleEventId,
          },
          {
            onConflict: "org_id,profile_id,source,source_ref",
            ignoreDuplicates: true,
          },
        )
        .select("id");

      if (activityError) {
        throw new Error(`Failed to create activity: ${activityError.message}`);
      }

      if ((insertedActivities?.length ?? 0) > 0) {
        activitiesCreated += 1;
      }

      const { error: sourceError } = await supabase
        .from("relationship_sources")
        .upsert(
          {
            org_id: params.orgId,
            relationship_id: relationshipId,
            source_type: "meeting",
            source_id: params.eventId,
            source_label: params.title ?? "Calendar meeting",
          },
          {
            onConflict: "relationship_id,source_type,source_id",
            ignoreDuplicates: true,
          },
        );

      if (sourceError) {
        throw new Error(
          `Failed to create relationship source: ${sourceError.message}`,
        );
      }

      continue;
    }

    const { data: insertedReviews, error: reviewError } = await supabase
      .from("calendar_participant_reviews")
      .upsert(
        {
          org_id: params.orgId,
          email,
          display_name: participant.name,
          calendar_event_id: params.eventId,
          status: "pending",
        },
        {
          onConflict: "org_id,email,calendar_event_id",
          ignoreDuplicates: true,
        },
      )
      .select("id");

    if (reviewError) {
      throw new Error(`Failed to queue participant review: ${reviewError.message}`);
    }

    reviewsQueued += insertedReviews?.length ?? 0;
  }

  return { activitiesCreated, reviewsQueued };
}
