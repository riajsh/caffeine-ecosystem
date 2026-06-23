import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCalendarParticipantProfile } from "@/lib/integrations/calendar/create-participant-profile";
import type { CalendarParticipant } from "@/lib/integrations/calendar/types";
import { isBeyondCalendarLookahead } from "@/lib/integrations/calendar/env";
import { calendarActivitySourceRef } from "@/lib/integrations/calendar/occurrence";
import { canAutoCreateProfileFromCalendarParticipant, parseCalendarDisplayName } from "@/lib/integrations/calendar/parse-display-name";
import { isPostgresUniqueViolation, calendarActivityExistsForOccurrence } from "@/lib/integrations/calendar/idempotent-insert";
import { resolveCalendarReviewsForEmail } from "@/lib/integrations/calendar/resolve-calendar-reviews";
import {
  ensureRelationshipsForProfiles,
  type OrgRelationshipsByProfileId,
} from "@/lib/integrations/calendar/review-utils";
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
    icalUid: string | null;
    startAt: string | null;
    title: string | null;
    participants: CalendarParticipant[];
    participantFilters: OrgParticipantFilters;
    ignoredParticipantEmails: ReadonlySet<string>;
    profilesByEmail: OrgProfileByEmail;
    relationshipsByProfileId: OrgRelationshipsByProfileId;
  },
): Promise<{
  activitiesCreated: number;
  reviewsQueued: number;
  profilesAutoCreated: number;
}> {
  const meetingIsPast =
    !params.startAt || new Date(params.startAt).getTime() <= Date.now();
  const activityDate = params.startAt ?? new Date().toISOString();
  const activityTitle = params.title ?? "Calendar meeting";
  const activitySourceRef = calendarActivitySourceRef(
    params.icalUid,
    params.startAt,
    params.googleEventId,
  );

  const matchedProfileIds = new Set<string>();
  let profilesAutoCreated = 0;
  const reviewRows: Array<{
    org_id: string;
    email: string;
    display_name: string | null;
    calendar_event_id: string;
    status: "pending";
  }> = [];

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
      if (!meetingIsPast) {
        continue;
      }

      matchedProfileIds.add(profile.id);
      continue;
    }

    if (canAutoCreateProfileFromCalendarParticipant(email, participant.name)) {
      const parsedName = parseCalendarDisplayName(participant.name);
      if (parsedName) {
        const profileId = await createCalendarParticipantProfile(supabase, {
          orgId: params.orgId,
          email,
          fullName: parsedName.fullName,
        });

        params.profilesByEmail.set(email, { id: profileId, email });
        profilesAutoCreated += 1;

        await resolveCalendarReviewsForEmail(supabase, {
          orgId: params.orgId,
          email,
          status: "created",
          profileId,
          reviewedByUserId: null,
        });

        if (meetingIsPast) {
          matchedProfileIds.add(profileId);
        }

        continue;
      }
    }

    reviewRows.push({
      org_id: params.orgId,
      email,
      display_name: participant.name,
      calendar_event_id: params.eventId,
      status: "pending",
    });
  }

  if (matchedProfileIds.size === 0 && reviewRows.length === 0) {
    return { activitiesCreated: 0, reviewsQueued: 0, profilesAutoCreated };
  }

  let activitiesCreated = 0;
  let reviewsQueued = 0;

  if (matchedProfileIds.size > 0) {
    const profileIds = [...matchedProfileIds];

    await ensureRelationshipsForProfiles(
      supabase,
      params.orgId,
      profileIds,
      params.relationshipsByProfileId,
    );

    for (const profileId of profileIds) {
      const alreadyLogged = await calendarActivityExistsForOccurrence(supabase, {
        orgId: params.orgId,
        profileId,
        icalUid: params.icalUid,
        startAt: params.startAt,
        googleEventId: params.googleEventId,
      });

      if (alreadyLogged) {
        continue;
      }

      const { error: activityError } = await supabase.from("activities").insert({
        org_id: params.orgId,
        profile_id: profileId,
        activity_type: "meeting" as const,
        title: activityTitle,
        summary: null,
        activity_date: activityDate,
        source: "calendar_sync" as const,
        source_ref: activitySourceRef,
      });

      if (activityError) {
        if (!isPostgresUniqueViolation(activityError)) {
          throw new Error(`Failed to create activities: ${activityError.message}`);
        }
      } else {
        activitiesCreated += 1;
      }
    }

    for (const profileId of profileIds) {
      const relationshipId = params.relationshipsByProfileId.get(profileId);
      if (!relationshipId) {
        continue;
      }

      const { error: sourceError } = await supabase
        .from("relationship_sources")
        .insert({
          org_id: params.orgId,
          relationship_id: relationshipId,
          source_type: "meeting" as const,
          source_id: params.eventId,
          source_label: activityTitle,
        });

      if (sourceError && !isPostgresUniqueViolation(sourceError)) {
        throw new Error(
          `Failed to create relationship sources: ${sourceError.message}`,
        );
      }
    }
  }

  if (reviewRows.length > 0) {
    const { data: insertedReviews, error: reviewError } = await supabase
      .from("calendar_participant_reviews")
      .upsert(reviewRows, {
        onConflict: "org_id,email,calendar_event_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (reviewError) {
      throw new Error(`Failed to queue participant reviews: ${reviewError.message}`);
    }

    reviewsQueued = insertedReviews?.length ?? 0;
  }

  return { activitiesCreated, reviewsQueued, profilesAutoCreated };
}
