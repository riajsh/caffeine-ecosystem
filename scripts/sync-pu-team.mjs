/**
 * Sync PU team users to Supabase (local or remote).
 * Usage: node --env-file=.env.local scripts/sync-pu-team.mjs
 */
import { createClient } from "@supabase/supabase-js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

const TEAM = [
  {
    id: "22222222-2222-2222-2222-222222222229",
    email: "ce@previously.co",
    fullName: "Chris E",
    role: "admin",
  },
  {
    id: "22222222-2222-2222-2222-222222222221",
    email: "jh@previously.co",
    fullName: "James",
    role: "admin",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "hk@previously.co",
    fullName: "Henry",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    email: "sp@previously.co",
    fullName: "Simon",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222224",
    email: "ed@previously.co",
    fullName: "Ed",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222225",
    email: "cp@previously.co",
    fullName: "Chris P",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222226",
    email: "ps@previously.co",
    fullName: "Phoebe S",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222227",
    email: "pd@previously.co",
    fullName: "Phoebe D",
    role: "member",
  },
  {
    id: "22222222-2222-2222-2222-222222222228",
    email: "team@previously.co",
    fullName: "Wider PU",
    role: "member",
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function authUserPayload(member) {
  return {
    email: member.email,
    user_metadata: { full_name: member.fullName },
    app_metadata: {
      provider: "email",
      providers: ["email"],
      org_id: ORG_ID,
    },
  };
}

async function findAuthUserByEmail(email) {
  const normalised = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalised,
    );

    if (match) {
      return match;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function ensureAuthUser(member) {
  const { data: byId, error: lookupError } =
    await supabase.auth.admin.getUserById(member.id);

  if (lookupError && lookupError.status !== 404) {
    throw lookupError;
  }

  if (byId?.user) {
    const { error } = await supabase.auth.admin.updateUserById(
      member.id,
      authUserPayload(member),
    );

    if (error) {
      throw error;
    }

    return { result: "updated", userId: member.id };
  }

  const byEmail = await findAuthUserByEmail(member.email);

  if (byEmail) {
    const { error } = await supabase.auth.admin.updateUserById(
      byEmail.id,
      authUserPayload(member),
    );

    if (error) {
      throw error;
    }

    return { result: "updated-by-email", userId: byEmail.id };
  }

  const { error } = await supabase.auth.admin.createUser({
    id: member.id,
    email: member.email,
    password: "password123",
    email_confirm: true,
    ...authUserPayload(member),
  });

  if (error) {
    throw error;
  }

  return { result: "created", userId: member.id };
}

async function ensurePublicUser(member, userId) {
  if (userId !== member.id) {
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", member.id)
      .eq("org_id", ORG_ID);

    if (deleteError) {
      throw deleteError;
    }
  }

  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
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
    const { result, userId } = await ensureAuthUser(member);
    await ensurePublicUser(member, userId);
    console.log(`${member.fullName}: auth ${result}, public.users ok (${userId})`);
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
