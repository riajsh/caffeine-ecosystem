import type { ProfileListItem } from "@/lib/data/profiles";

export type MergeEmailOption = {
  email: string;
  profileId: string;
  profileName: string;
};

export function collectMergeEmailOptions(
  profiles: Pick<ProfileListItem, "id" | "email" | "fullName">[],
): MergeEmailOption[] {
  const seen = new Set<string>();
  const options: MergeEmailOption[] = [];

  for (const profile of profiles) {
    const email = profile.email?.trim();
    if (!email) {
      continue;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({
      email,
      profileId: profile.id,
      profileName: profile.fullName,
    });
  }

  return options;
}

export function hasMergeEmailConflict(
  profiles: Pick<ProfileListItem, "id" | "email" | "fullName">[],
): boolean {
  return collectMergeEmailOptions(profiles).length > 1;
}
