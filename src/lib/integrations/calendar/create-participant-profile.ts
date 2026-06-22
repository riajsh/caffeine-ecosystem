import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normaliseEmail } from "@/lib/integrations/participant-email";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export async function createCalendarParticipantProfile(
  supabase: AdminClient,
  params: {
    orgId: string;
    email: string;
    fullName: string;
    organisationName?: string | null;
    occupation?: string | null;
  },
): Promise<string> {
  const email = normaliseEmail(params.email);
  const organisationName = params.organisationName?.trim() || null;
  const occupation = params.occupation?.trim() || null;

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", params.orgId)
    .ilike("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check existing profile: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      org_id: params.orgId,
      full_name: params.fullName,
      email,
      occupation,
      organisation_name: organisationName,
      organisation_name_normalised: normaliseOrganisationName(organisationName),
      source: "manual",
    })
    .select("id")
    .single();

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  return profile.id;
}
