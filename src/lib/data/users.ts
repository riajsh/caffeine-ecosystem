import "server-only";

import { getOrgId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type OrgUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export async function listOrgUsers(): Promise<OrgUser[]> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .eq("org_id", orgId)
    .order("full_name");

  if (error) {
    throw new Error(`Failed to list org users: ${error.message}`);
  }

  return (data ?? []).map((user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  }));
}
