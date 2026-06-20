import "server-only";

import { getOrgId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ProfileNetworkIntel = {
  connectionCount: number;
  eventsAttended: number;
  sameCompanyCount: number;
  sameCompanyName: string | null;
};

export async function getProfileNetworkIntel(
  profileId: string,
): Promise<ProfileNetworkIntel> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organisation_name, organisation_name_normalised")
    .eq("org_id", orgId)
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load profile intel: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error("Profile not found");
  }

  const [connectionsResult, eventsResult, companyResult] = await Promise.all([
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .or(`profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`),
    supabase
      .from("event_attendees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("profile_id", profileId),
    profile.organisation_name_normalised
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq(
            "organisation_name_normalised",
            profile.organisation_name_normalised,
          )
          .neq("id", profileId)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (connectionsResult.error) {
    throw new Error(
      `Failed to count connections: ${connectionsResult.error.message}`,
    );
  }

  if (eventsResult.error) {
    throw new Error(`Failed to count events: ${eventsResult.error.message}`);
  }

  if (companyResult.error) {
    throw new Error(
      `Failed to count company peers: ${companyResult.error.message}`,
    );
  }

  return {
    connectionCount: connectionsResult.count ?? 0,
    eventsAttended: eventsResult.count ?? 0,
    sameCompanyCount: companyResult.count ?? 0,
    sameCompanyName: profile.organisation_name,
  };
}
