import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, requireUser } from "@/lib/auth/session";

export type CalendarAccountSummary = {
  id: string;
  email: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  userId: string;
  userName: string | null;
};

function formatSyncStatus(
  lastSyncAt: string | null,
  metadata: unknown,
): string {
  if (
    metadata &&
    typeof metadata === "object" &&
    "syncing" in metadata &&
    metadata.syncing === true
  ) {
    return "Syncing in background…";
  }

  if (lastSyncAt) {
    return `Last synced ${new Date(lastSyncAt).toLocaleString()}`;
  }

  return "Never synced";
}

export async function listCalendarAccountsForOrg(): Promise<CalendarAccountSummary[]> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendar_accounts")
    .select(
      `
      id,
      email,
      sync_enabled,
      last_sync_at,
      metadata,
      user_id,
      users (
        full_name
      )
    `,
    )
    .eq("org_id", orgId)
    .order("email");

  if (error) {
    throw new Error(`Failed to list calendar accounts: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    syncEnabled: row.sync_enabled,
    lastSyncAt: row.last_sync_at,
    syncStatus: formatSyncStatus(row.last_sync_at, row.metadata),
    userId: row.user_id,
    userName: row.users?.full_name ?? null,
  }));
}

export async function getCurrentUserCalendarAccount(): Promise<CalendarAccountSummary | null> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calendar_accounts")
    .select("id, email, sync_enabled, last_sync_at, user_id")
    .eq("org_id", user.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar account: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at,
    syncStatus: formatSyncStatus(data.last_sync_at, null),
    userId: data.user_id,
    userName: user.full_name,
  };
}

export async function disconnectCalendarAccount(accountId: string) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("calendar_accounts")
    .update({ sync_enabled: false })
    .eq("id", accountId)
    .eq("org_id", user.org_id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to disconnect calendar account: ${error.message}`);
  }
}
