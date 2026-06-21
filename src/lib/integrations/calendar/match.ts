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

export { hasExternalParticipant };

async function ensureRelationship(
  supabase: AdminClient,
  orgId: string,
  profileId: string,
): Promise<string> {
  return ensureRelationshipForProfile(supabase, orgId, profileId);
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
  },
): Promise<{ activitiesCreated: number; reviewsQueued: number }> {
  let activitiesCreated = 0;
  let reviewsQueued = 0;

  for (const participant of params.participants) {
    const email = normaliseEmail(participant.email);
    if (!email || isInternalParticipant(email, params.participantFilters)) {
      continue;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("org_id", params.orgId)
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to match profile by email: ${profileError.message}`);
    }

    if (
      profile?.email &&
      isInternalParticipant(profile.email, params.participantFilters)
    ) {
      continue;
    }

    if (isBeyondCalendarLookahead(params.startAt)) {
      continue;
    }

    if (profile) {
      const relationshipId = await ensureRelationship(
        supabase,
        params.orgId,
        profile.id,
      );

      const { data: existingActivity, error: activityLookupError } =
        await supabase
          .from("activities")
          .select("id")
          .eq("org_id", params.orgId)
          .eq("profile_id", profile.id)
          .eq("source", "calendar_sync")
          .eq("source_ref", params.googleEventId)
          .maybeSingle();

      if (activityLookupError) {
        throw new Error(
          `Failed to check existing activity: ${activityLookupError.message}`,
        );
      }

      if (!existingActivity) {
        const activityDate = params.startAt ?? new Date().toISOString();
        const { error: activityError } = await supabase.from("activities").insert({
          org_id: params.orgId,
          profile_id: profile.id,
          activity_type: "meeting",
          title: params.title ?? "Calendar meeting",
          summary: null,
          activity_date: activityDate,
          source: "calendar_sync",
          source_ref: params.googleEventId,
        });

        if (activityError) {
          throw new Error(`Failed to create activity: ${activityError.message}`);
        }

        activitiesCreated += 1;
      }

      const { data: existingSource, error: sourceLookupError } = await supabase
        .from("relationship_sources")
        .select("id")
        .eq("relationship_id", relationshipId)
        .eq("source_type", "meeting")
        .eq("source_id", params.eventId)
        .maybeSingle();

      if (sourceLookupError) {
        throw new Error(
          `Failed to check relationship source: ${sourceLookupError.message}`,
        );
      }

      if (!existingSource) {
        const { error: sourceError } = await supabase
          .from("relationship_sources")
          .insert({
            org_id: params.orgId,
            relationship_id: relationshipId,
            source_type: "meeting",
            source_id: params.eventId,
            source_label: params.title ?? "Calendar meeting",
          });

        if (sourceError) {
          throw new Error(
            `Failed to create relationship source: ${sourceError.message}`,
          );
        }
      }

      continue;
    }

    const { error: reviewError } = await supabase
      .from("calendar_participant_reviews")
      .upsert(
        {
          org_id: params.orgId,
          email,
          display_name: participant.name,
          calendar_event_id: params.eventId,
          status: "pending",
        },
        { onConflict: "org_id,email,calendar_event_id" },
      );

    if (reviewError) {
      throw new Error(`Failed to queue participant review: ${reviewError.message}`);
    }

    reviewsQueued += 1;
  }

  return { activitiesCreated, reviewsQueued };
}
