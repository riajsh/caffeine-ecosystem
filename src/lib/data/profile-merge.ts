import "server-only";

import { getOrgId, requireUser } from "@/lib/auth/session";
import {
  isInternalParticipant,
  loadOrgParticipantFilters,
} from "@/lib/integrations/participant-email";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OwnerStrength = Database["public"]["Enums"]["owner_strength"];

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const STRENGTH_RANK: Record<OwnerStrength, number> = {
  inner_circle: 0,
  strong: 1,
  warm: 2,
  weak: 3,
  unknown: 4,
};

function orderProfileIds(
  profileAId: string,
  profileBId: string,
): [string, string] {
  return profileAId < profileBId
    ? [profileAId, profileBId]
    : [profileBId, profileAId];
}

function strongerStrength(
  left: OwnerStrength,
  right: OwnerStrength,
): OwnerStrength {
  return STRENGTH_RANK[left] <= STRENGTH_RANK[right] ? left : right;
}

function mergeProfileFields(
  survivor: ProfileRow,
  duplicate: ProfileRow,
): Partial<ProfileRow> {
  const organisationName =
    survivor.organisation_name?.trim() || duplicate.organisation_name?.trim() || null;

  const update: Partial<ProfileRow> = {
    full_name: survivor.full_name?.trim() || duplicate.full_name,
    email: survivor.email?.trim() || duplicate.email?.trim() || null,
    phone: survivor.phone?.trim() || duplicate.phone?.trim() || null,
    linkedin_url: survivor.linkedin_url?.trim() || duplicate.linkedin_url?.trim() || null,
    website_url: survivor.website_url?.trim() || duplicate.website_url?.trim() || null,
    organisation_name: organisationName,
    organisation_name_normalised: normaliseOrganisationName(organisationName),
    occupation: survivor.occupation?.trim() || duplicate.occupation?.trim() || null,
    location_city:
      survivor.location_city?.trim() || duplicate.location_city?.trim() || null,
    location_country:
      survivor.location_country?.trim() || duplicate.location_country?.trim() || null,
    bio: survivor.bio?.trim() || duplicate.bio?.trim() || null,
  };

  if (
    survivor.email?.trim() &&
    duplicate.email?.trim() &&
    survivor.email.trim().toLowerCase() !== duplicate.email.trim().toLowerCase()
  ) {
    throw new Error(
      `Cannot merge profiles with different emails (${survivor.email} and ${duplicate.email}). Pick the profile with the correct email as primary.`,
    );
  }

  return update;
}

async function getOrCreateSurvivorRelationship(
  survivorId: string,
  orgId: string,
  createdBy: string,
) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("relationships")
    .select("id")
    .eq("profile_id", survivorId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load survivor relationship: ${existingError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("relationships")
    .insert({
      org_id: orgId,
      profile_id: survivorId,
      status: "prospect",
      relationship_type: "other",
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(`Failed to create survivor relationship: ${createError.message}`);
  }

  const { error: sourceError } = await supabase.from("relationship_sources").insert({
    org_id: orgId,
    relationship_id: created.id,
    source_type: "manual",
    source_label: "Relationship created during profile merge",
    created_by: createdBy,
  });

  if (sourceError) {
    throw new Error(`Failed to create relationship source: ${sourceError.message}`);
  }

  return created.id;
}

async function mergeRelationshipData(
  survivorId: string,
  duplicateId: string,
  orgId: string,
  createdBy: string,
) {
  const supabase = await createClient();
  const survivorRelationshipId = await getOrCreateSurvivorRelationship(
    survivorId,
    orgId,
    createdBy,
  );

  const { data: duplicateRelationship, error: duplicateRelationshipError } =
    await supabase
      .from("relationships")
      .select("id, notes")
      .eq("profile_id", duplicateId)
      .eq("org_id", orgId)
      .maybeSingle();

  if (duplicateRelationshipError) {
    throw new Error(
      `Failed to load duplicate relationship: ${duplicateRelationshipError.message}`,
    );
  }

  if (!duplicateRelationship) {
    return;
  }

  const { data: survivorRelationship, error: survivorRelationshipError } =
    await supabase
      .from("relationships")
      .select("notes")
      .eq("id", survivorRelationshipId)
      .eq("org_id", orgId)
      .single();

  if (survivorRelationshipError) {
    throw new Error(
      `Failed to load survivor relationship notes: ${survivorRelationshipError.message}`,
    );
  }

  if (!survivorRelationship.notes?.trim() && duplicateRelationship.notes?.trim()) {
    const { error: notesError } = await supabase
      .from("relationships")
      .update({ notes: duplicateRelationship.notes })
      .eq("id", survivorRelationshipId)
      .eq("org_id", orgId);

    if (notesError) {
      throw new Error(`Failed to merge relationship notes: ${notesError.message}`);
    }
  }

  const { data: duplicateOwners, error: ownersError } = await supabase
    .from("relationship_owners")
    .select("user_id, strength, is_primary, notes, last_interaction_at")
    .eq("relationship_id", duplicateRelationship.id)
    .eq("org_id", orgId);

  if (ownersError) {
    throw new Error(`Failed to load duplicate owners: ${ownersError.message}`);
  }

  for (const owner of duplicateOwners ?? []) {
    const { data: existingOwner, error: existingOwnerError } = await supabase
      .from("relationship_owners")
      .select("id, strength, notes, is_primary, last_interaction_at")
      .eq("relationship_id", survivorRelationshipId)
      .eq("user_id", owner.user_id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existingOwnerError) {
      throw new Error(`Failed to check existing owner: ${existingOwnerError.message}`);
    }

    if (existingOwner) {
      const { error: updateOwnerError } = await supabase
        .from("relationship_owners")
        .update({
          strength: strongerStrength(existingOwner.strength, owner.strength),
          is_primary: existingOwner.is_primary || owner.is_primary,
          notes: existingOwner.notes?.trim() || owner.notes?.trim() || null,
          last_interaction_at:
            [existingOwner.last_interaction_at, owner.last_interaction_at]
              .filter(Boolean)
              .sort()
              .at(-1) ?? null,
        })
        .eq("id", existingOwner.id)
        .eq("org_id", orgId);

      if (updateOwnerError) {
        throw new Error(`Failed to merge owner: ${updateOwnerError.message}`);
      }
      continue;
    }

    const { error: insertOwnerError } = await supabase
      .from("relationship_owners")
      .insert({
        org_id: orgId,
        relationship_id: survivorRelationshipId,
        user_id: owner.user_id,
        strength: owner.strength,
        is_primary: owner.is_primary,
        notes: owner.notes,
        last_interaction_at: owner.last_interaction_at,
      });

    if (insertOwnerError) {
      throw new Error(`Failed to move owner: ${insertOwnerError.message}`);
    }
  }

  const { error: moveSourcesError } = await supabase
    .from("relationship_sources")
    .update({ relationship_id: survivorRelationshipId })
    .eq("relationship_id", duplicateRelationship.id)
    .eq("org_id", orgId);

  if (moveSourcesError) {
    throw new Error(`Failed to move relationship sources: ${moveSourcesError.message}`);
  }

  const { error: deleteRelationshipError } = await supabase
    .from("relationships")
    .delete()
    .eq("id", duplicateRelationship.id)
    .eq("org_id", orgId);

  if (deleteRelationshipError) {
    throw new Error(
      `Failed to delete duplicate relationship: ${deleteRelationshipError.message}`,
    );
  }
}

async function mergeConnections(
  survivorId: string,
  duplicateId: string,
  orgId: string,
) {
  const supabase = await createClient();

  const { data: connections, error } = await supabase
    .from("connections")
    .select("id, profile_a_id, profile_b_id")
    .eq("org_id", orgId)
    .or(
      `profile_a_id.eq.${duplicateId},profile_b_id.eq.${duplicateId}`,
    );

  if (error) {
    throw new Error(`Failed to load connections: ${error.message}`);
  }

  for (const connection of connections ?? []) {
    const otherProfileId =
      connection.profile_a_id === duplicateId
        ? connection.profile_b_id
        : connection.profile_a_id;

    if (otherProfileId === survivorId) {
      const { error: deleteSelfConnectionError } = await supabase
        .from("connections")
        .delete()
        .eq("id", connection.id)
        .eq("org_id", orgId);

      if (deleteSelfConnectionError) {
        throw new Error(
          `Failed to remove self connection: ${deleteSelfConnectionError.message}`,
        );
      }
      continue;
    }

    const [profileAId, profileBId] = orderProfileIds(survivorId, otherProfileId);

    const { data: existingConnection, error: existingConnectionError } =
      await supabase
        .from("connections")
        .select("id")
        .eq("org_id", orgId)
        .eq("profile_a_id", profileAId)
        .eq("profile_b_id", profileBId)
        .maybeSingle();

    if (existingConnectionError) {
      throw new Error(
        `Failed to check existing connection: ${existingConnectionError.message}`,
      );
    }

    if (existingConnection) {
      const { error: deleteDuplicateConnectionError } = await supabase
        .from("connections")
        .delete()
        .eq("id", connection.id)
        .eq("org_id", orgId);

      if (deleteDuplicateConnectionError) {
        throw new Error(
          `Failed to remove duplicate connection: ${deleteDuplicateConnectionError.message}`,
        );
      }
      continue;
    }

    const { error: updateConnectionError } = await supabase
      .from("connections")
      .update({
        profile_a_id: profileAId,
        profile_b_id: profileBId,
      })
      .eq("id", connection.id)
      .eq("org_id", orgId);

    if (updateConnectionError) {
      throw new Error(`Failed to reassign connection: ${updateConnectionError.message}`);
    }
  }
}

async function mergeTags(
  survivorId: string,
  duplicateId: string,
  orgId: string,
) {
  const supabase = await createClient();

  const { data: duplicateTags, error } = await supabase
    .from("profile_tags")
    .select("id, tag_id")
    .eq("profile_id", duplicateId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to load duplicate tags: ${error.message}`);
  }

  for (const profileTag of duplicateTags ?? []) {
    const { data: existingTag, error: existingTagError } = await supabase
      .from("profile_tags")
      .select("id")
      .eq("profile_id", survivorId)
      .eq("tag_id", profileTag.tag_id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existingTagError) {
      throw new Error(`Failed to check existing tag: ${existingTagError.message}`);
    }

    if (existingTag) {
      const { error: deleteTagError } = await supabase
        .from("profile_tags")
        .delete()
        .eq("id", profileTag.id)
        .eq("org_id", orgId);

      if (deleteTagError) {
        throw new Error(`Failed to remove duplicate tag: ${deleteTagError.message}`);
      }
      continue;
    }

    const { error: moveTagError } = await supabase
      .from("profile_tags")
      .update({ profile_id: survivorId })
      .eq("id", profileTag.id)
      .eq("org_id", orgId);

    if (moveTagError) {
      throw new Error(`Failed to move tag: ${moveTagError.message}`);
    }
  }
}

async function mergeEventAttendance(
  survivorId: string,
  duplicateId: string,
  orgId: string,
) {
  const supabase = await createClient();

  const { data: duplicateAttendance, error } = await supabase
    .from("event_attendees")
    .select("id, event_id")
    .eq("profile_id", duplicateId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to load event attendance: ${error.message}`);
  }

  for (const attendance of duplicateAttendance ?? []) {
    const { data: existingAttendance, error: existingAttendanceError } =
      await supabase
        .from("event_attendees")
        .select("id")
        .eq("profile_id", survivorId)
        .eq("event_id", attendance.event_id)
        .eq("org_id", orgId)
        .maybeSingle();

    if (existingAttendanceError) {
      throw new Error(
        `Failed to check event attendance: ${existingAttendanceError.message}`,
      );
    }

    if (existingAttendance) {
      const { error: deleteAttendanceError } = await supabase
        .from("event_attendees")
        .delete()
        .eq("id", attendance.id)
        .eq("org_id", orgId);

      if (deleteAttendanceError) {
        throw new Error(
          `Failed to remove duplicate attendance: ${deleteAttendanceError.message}`,
        );
      }
      continue;
    }

    const { error: moveAttendanceError } = await supabase
      .from("event_attendees")
      .update({ profile_id: survivorId })
      .eq("id", attendance.id)
      .eq("org_id", orgId);

    if (moveAttendanceError) {
      throw new Error(`Failed to move event attendance: ${moveAttendanceError.message}`);
    }
  }
}

async function reassignProfileReferences(
  survivorId: string,
  duplicateId: string,
  orgId: string,
) {
  const supabase = await createClient();

  const updates = [
    supabase
      .from("activities")
      .update({ profile_id: survivorId })
      .eq("profile_id", duplicateId)
      .eq("org_id", orgId),
    supabase
      .from("calendar_participant_reviews")
      .update({ profile_id: survivorId })
      .eq("profile_id", duplicateId)
      .eq("org_id", orgId),
    supabase
      .from("email_participant_reviews")
      .update({ profile_id: survivorId })
      .eq("profile_id", duplicateId)
      .eq("org_id", orgId),
    supabase
      .from("import_rows")
      .update({ matched_profile_id: survivorId })
      .eq("matched_profile_id", duplicateId)
      .eq("org_id", orgId),
  ] as const;

  for (const update of updates) {
    const { error } = await update;
    if (error) {
      throw new Error(`Failed to reassign profile references: ${error.message}`);
    }
  }
}

export async function mergeProfiles(
  survivorId: string,
  duplicateIds: string[],
): Promise<{ mergedCount: number }> {
  const currentUser = await requireUser();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const participantFilters = await loadOrgParticipantFilters(
    createAdminClient(),
    orgId,
  );

  const uniqueDuplicateIds = [
    ...new Set(
      duplicateIds
        .map((id) => id.trim())
        .filter((id) => id && id !== survivorId),
    ),
  ];

  if (uniqueDuplicateIds.length === 0) {
    throw new Error("Select at least one other profile to merge.");
  }

  const profileIds = [survivorId, ...uniqueDuplicateIds];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .eq("org_id", orgId)
    .in("id", profileIds);

  if (profilesError) {
    throw new Error(`Failed to load profiles: ${profilesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const survivor = profileById.get(survivorId);

  if (!survivor) {
    throw new Error("Primary profile not found.");
  }

  const duplicates = uniqueDuplicateIds.map((id) => {
    const profile = profileById.get(id);
    if (!profile) {
      throw new Error("One or more selected profiles could not be found.");
    }
    return profile;
  });

  for (const duplicate of duplicates) {
    if (
      duplicate.email &&
      isInternalParticipant(duplicate.email, participantFilters)
    ) {
      throw new Error(
        `Team member profile ${duplicate.full_name} cannot be merged away.`,
      );
    }
  }

  let mergedCount = 0;

  for (const duplicate of duplicates) {
    const mergedFields = mergeProfileFields(survivor, duplicate);
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update(mergedFields)
      .eq("id", survivorId)
      .eq("org_id", orgId);

    if (updateProfileError) {
      if (updateProfileError.code === "23505") {
        throw new Error(
          "Another profile already uses the email address from the merged profile.",
        );
      }
      throw new Error(`Failed to update primary profile: ${updateProfileError.message}`);
    }

    Object.assign(survivor, mergedFields);

    await reassignProfileReferences(survivorId, duplicate.id, orgId);
    await mergeRelationshipData(survivorId, duplicate.id, orgId, currentUser.id);
    await mergeConnections(survivorId, duplicate.id, orgId);
    await mergeTags(survivorId, duplicate.id, orgId);
    await mergeEventAttendance(survivorId, duplicate.id, orgId);

    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", duplicate.id)
      .eq("org_id", orgId);

    if (deleteProfileError) {
      throw new Error(`Failed to delete merged profile: ${deleteProfileError.message}`);
    }

    mergedCount += 1;
  }

  return { mergedCount };
}
