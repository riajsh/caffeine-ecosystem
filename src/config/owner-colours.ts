import { TEAM_MEMBERS } from "@/config/team-members";

export const OWNER_COLOURS: Record<string, string> = Object.fromEntries(
  TEAM_MEMBERS.map((member) => [member.id, member.colourToken]),
);

export function ownerColour(userId: string): string {
  return OWNER_COLOURS[userId] ?? "var(--color-owner-default)";
}

/** @deprecated Use TEAM_MEMBERS from team-members.ts */
export const SEED_USER_IDS = {
  chrisE: TEAM_MEMBERS[0].id,
  james: TEAM_MEMBERS[1].id,
  henry: TEAM_MEMBERS[2].id,
  simon: TEAM_MEMBERS[3].id,
  ed: TEAM_MEMBERS[4].id,
  chrisP: TEAM_MEMBERS[5].id,
  phoebeS: TEAM_MEMBERS[6].id,
  phoebeD: TEAM_MEMBERS[7].id,
  widerPu: TEAM_MEMBERS[8].id,
} as const;
