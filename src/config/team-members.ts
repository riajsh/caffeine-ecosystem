/** PU team — single source for owner colours and local seed UUIDs. */
export const PU_ORG_ID = "11111111-1111-1111-1111-111111111111";

export const TEAM_MEMBERS = [
  {
    id: "22222222-2222-2222-2222-222222222229",
    email: "ce@previously.co",
    fullName: "Chris E",
    role: "admin" as const,
    colourToken: "var(--color-owner-chris-e)",
  },
  {
    id: "22222222-2222-2222-2222-222222222221",
    email: "jh@previously.co",
    fullName: "James",
    role: "admin" as const,
    colourToken: "var(--color-owner-james)",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "hk@previously.co",
    fullName: "Henry",
    role: "member" as const,
    colourToken: "var(--color-owner-henry)",
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    email: "sp@previously.co",
    fullName: "Simon",
    role: "member" as const,
    colourToken: "var(--color-owner-simon)",
  },
  {
    id: "22222222-2222-2222-2222-222222222230",
    email: "rs@previously.co",
    fullName: "Ria",
    role: "member" as const,
    colourToken: "var(--color-owner-ria)",
  },
  {
    id: "22222222-2222-2222-2222-222222222224",
    email: "ed@previously.co",
    fullName: "Ed",
    role: "member" as const,
    colourToken: "var(--color-owner-ed)",
  },
  {
    id: "22222222-2222-2222-2222-222222222225",
    email: "cp@previously.co",
    fullName: "Chris P",
    role: "member" as const,
    colourToken: "var(--color-owner-chris-p)",
  },
  {
    id: "22222222-2222-2222-2222-222222222226",
    email: "ps@previously.co",
    fullName: "Phoebe S",
    role: "member" as const,
    colourToken: "var(--color-owner-phoebe-s)",
  },
  {
    id: "22222222-2222-2222-2222-222222222227",
    email: "pd@previously.co",
    fullName: "Phoebe D",
    role: "member" as const,
    colourToken: "var(--color-owner-phoebe-d)",
  },
  {
    id: "22222222-2222-2222-2222-222222222228",
    email: "team@previously.co",
    fullName: "Wider PU",
    role: "member" as const,
    colourToken: "var(--color-owner-wider-pu)",
  },
] as const;

export type TeamMember = (typeof TEAM_MEMBERS)[number];

/** Display titles for team members (not stored in DB in V1). */
export const TEAM_MEMBER_TITLES: Record<string, string> = {
  "cp@previously.co": "Co-CEO",
  "sp@previously.co": "Co-CEO",
  "ed@previously.co": "Chief Venturing Officer",
  "hk@previously.co": "Chief Strategy Officer",
  "jh@previously.co": "Founding Partner",
  "pd@previously.co": "Chief Design Officer",
  "ps@previously.co": "Chief Impact Officer",
  "tp@previously.co": "Chief Operating Officer",
  "ce@previously.co": "Admin",
  "team@previously.co": "Member",
};
