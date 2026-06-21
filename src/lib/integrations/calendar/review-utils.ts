import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normaliseEmail } from "@/lib/integrations/participant-email";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function loadIgnoredParticipantEmails(
  supabase: AdminClient,
  orgId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("calendar_participant_reviews")
    .select("email")
    .eq("org_id", orgId)
    .eq("status", "ignored");

  if (error) {
    throw new Error(
      `Failed to load ignored calendar participants: ${error.message}`,
    );
  }

  return new Set(
    (data ?? [])
      .map((row) => normaliseEmail(row.email))
      .filter(Boolean),
  );
}

export async function ensureRelationshipForProfile(
  supabase: AdminClient,
  orgId: string,
  profileId: string,
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("relationships")
    .select("id")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load relationship: ${existingError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("relationships")
    .insert({
      org_id: orgId,
      profile_id: profileId,
      status: "prospect",
      relationship_type: "other",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create relationship: ${error.message}`);
  }

  return data.id;
}
