/**
 * Sync PU team users to Supabase (local or remote).
 * Usage: node --env-file=.env.local scripts/sync-pu-team.mjs
 */
import { createClient } from "@supabase/supabase-js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

const TEAM = [
  {
    id: "22222222-2222-2222-2222-222222222221",
    email: "james@seed.test",
    fullName: "James",
    role: "admin",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "henry@seed.test",
    fullName: "Henry",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    email: "simon@seed.test",
    fullName: "Simon",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222224",
    email: "ed@seed.test",
    fullName: "Ed",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222225",
    email: "chrisp@seed.test",
    fullName: "Chris P",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222226",
    email: "phoebes@seed.test",
    fullName: "Phoebe S",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222227",
    email: "phoebed@seed.test",
    fullName: "Phoebe D",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222228",
    email: "widerpu@seed.test",
    fullName: "Wider PU",
    role: "member",
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function ensureAuthUser(member) {
  const { data: existing, error: lookupError } =
    await supabase.auth.admin.getUserById(member.id);

  if (lookupError && lookupError.status !== 404) {
    throw lookupError;
  }

  if (existing?.user) {
    const { error } = await supabase.auth.admin.updateUserById(member.id, {
      email: member.email,
      user_metadata: { full_name: member.fullName },
      app_metadata: {
        provider: "email",
        providers: ["email"],
        org_id: ORG_ID,
      },
    });

    if (error) {
      throw error;
    }

    return "updated";
  }

  const { error } = await supabase.auth.admin.createUser({
    id: member.id,
    email: member.email,
    password: "password123",
    email_confirm: true,
    user_metadata: { full_name: member.fullName },
    app_metadata: {
      provider: "email",
      providers: ["email"],
      org_id: ORG_ID,
    },
  });

  if (error) {
    throw error;
  }

  return "created";
}

async function ensurePublicUser(member) {
  const { error } = await supabase.from("users").upsert(
    {
      id: member.id,
      org_id: ORG_ID,
      email: member.email,
      full_name: member.fullName,
      role: member.role,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

async function main() {
  for (const member of TEAM) {
    const authResult = await ensureAuthUser(member);
    await ensurePublicUser(member);
    console.log(`${member.fullName}: auth ${authResult}, public.users ok`);
  }

  const { data: users } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("org_id", ORG_ID)
    .order("full_name");

  console.log("\nTeam in database:");
  for (const user of users ?? []) {
    console.log(`  - ${user.full_name} (${user.email})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
