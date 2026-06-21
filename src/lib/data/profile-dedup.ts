import "server-only";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createClient } from "@/lib/supabase/server";

export type DuplicateProfileGroup = {
  id: string;
  reason: "same_email" | "same_name_organisation";
  reasonLabel: string;
  profiles: Array<{
    id: string;
    fullName: string;
    email: string | null;
    organisationName: string | null;
  }>;
};

function groupKeyNameOrganisation(
  fullName: string,
  organisationName: string | null,
): string {
  const name = fullName.trim().toLowerCase();
  const org = normaliseOrganisationName(organisationName) ?? "";
  return `${name}::${org}`;
}

export async function findDuplicateProfileGroups(): Promise<{
  totalProfiles: number;
  groups: DuplicateProfileGroup[];
}> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, organisation_name")
    .eq("org_id", orgId)
    .order("full_name");

  if (error) {
    throw new Error(`Failed to load profiles for dedup: ${error.message}`);
  }

  const profiles = data ?? [];
  const emailGroups = new Map<string, DuplicateProfileGroup["profiles"]>();
  const nameOrgGroups = new Map<string, DuplicateProfileGroup["profiles"]>();

  for (const profile of profiles) {
    const entry = {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      organisationName: profile.organisation_name,
    };

    if (profile.email?.trim()) {
      const emailKey = profile.email.trim().toLowerCase();
      const existing = emailGroups.get(emailKey) ?? [];
      existing.push(entry);
      emailGroups.set(emailKey, existing);
    }

    const nameOrgKey = groupKeyNameOrganisation(
      profile.full_name,
      profile.organisation_name,
    );
    const nameExisting = nameOrgGroups.get(nameOrgKey) ?? [];
    nameExisting.push(entry);
    nameOrgGroups.set(nameOrgKey, nameExisting);
  }

  const groups: DuplicateProfileGroup[] = [];
  let groupIndex = 0;

  for (const [email, members] of emailGroups) {
    if (members.length < 2) {
      continue;
    }

    groupIndex += 1;
    groups.push({
      id: `email-${groupIndex}`,
      reason: "same_email",
      reasonLabel: `Same email: ${email}`,
      profiles: members,
    });
  }

  for (const [, members] of nameOrgGroups) {
    if (members.length < 2) {
      continue;
    }

    const emails = new Set(
      members.map((member) => member.email?.trim().toLowerCase()).filter(Boolean),
    );
    if (emails.size > 1 && emails.size === members.length) {
      continue;
    }

    const alreadyCovered = groups.some(
      (group) =>
        group.reason === "same_email" &&
        group.profiles.every((profile) =>
          members.some((member) => member.id === profile.id),
        ),
    );

    if (alreadyCovered) {
      continue;
    }

    groupIndex += 1;
    const sample = members[0];
    groups.push({
      id: `name-org-${groupIndex}`,
      reason: "same_name_organisation",
      reasonLabel: `Same name + organisation: ${sample.fullName}${
        sample.organisationName ? ` · ${sample.organisationName}` : ""
      }`,
      profiles: members,
    });
  }

  groups.sort((a, b) => b.profiles.length - a.profiles.length);

  return {
    totalProfiles: profiles.length,
    groups,
  };
}
