import { TEAM_MEMBERS } from "@/config/team-members";

export const OWNER_COLOURS: Record<string, string> = Object.fromEntries(
  TEAM_MEMBERS.map((member) => [member.id, member.colourToken]),
);

export function ownerColour(userId: string): string {
  return OWNER_COLOURS[userId] ?? "var(--color-owner-default)";
}

/** @deprecated Use TEAM_MEMBERS from team-members.ts */
export const SEED_USER_IDS = {
  james: TEAM_MEMBERS[0].id,
  henry: TEAM_MEMBERS[1].id,
  simon: TEAM_MEMBERS[2].id,
  ed: TEAM_MEMBERS[3].id,
  chrisP: TEAM_MEMBERS[4].id,
  phoebeS: TEAM_MEMBERS[5].id,
  phoebeD: TEAM_MEMBERS[6].id,
  widerPu: TEAM_MEMBERS[7].id,
} as const;
