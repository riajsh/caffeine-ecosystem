/** PU team — single source for owner colours and local seed UUIDs. */
export const PU_ORG_ID = "11111111-1111-1111-1111-111111111111";

export const TEAM_MEMBERS = [
  {
    id: "22222222-2222-2222-2222-222222222221",
    email: "james@seed.test",
    fullName: "James",
    role: "admin" as const,
    colourToken: "var(--color-owner-james)",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "henry@seed.test",
    fullName: "Henry",
    role: "member" as const,
    colourToken: "var(--color-owner-henry)",
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    email: "simon@seed.test",
    fullName: "Simon",
    role: "member" as const,
    colourToken: "var(--color-owner-simon)",
  },
  {
    id: "22222222-2222-2222-2222-222222222224",
    email: "ed@seed.test",
    fullName: "Ed",
    role: "member" as const,
    colourToken: "var(--color-owner-ed)",
  },
  {
    id: "22222222-2222-2222-2222-222222222225",
    email: "chrisp@seed.test",
    fullName: "Chris P",
    role: "member" as const,
    colourToken: "var(--color-owner-chris-p)",
  },
  {
    id: "22222222-2222-2222-2222-222222222226",
    email: "phoebes@seed.test",
    fullName: "Phoebe S",
    role: "member" as const,
    colourToken: "var(--color-owner-phoebe-s)",
  },
  {
    id: "22222222-2222-2222-2222-222222222227",
    email: "phoebed@seed.test",
    fullName: "Phoebe D",
    role: "member" as const,
    colourToken: "var(--color-owner-phoebe-d)",
  },
  {
    id: "22222222-2222-2222-2222-222222222228",
    email: "widerpu@seed.test",
    fullName: "Wider PU",
    role: "member" as const,
    colourToken: "var(--color-owner-wider-pu)",
  },
] as const;

export type TeamMember = (typeof TEAM_MEMBERS)[number];
