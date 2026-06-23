import "server-only";

import {
  loadCalendarSyncCursors,
  parseCalendarAccountMetadata,
} from "@/lib/integrations/calendar/sync-cursors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getOrgId, requireUser } from "@/lib/auth/session";

export type CalendarAccountSummary = {
  id: string;
  email: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  backfillPending: boolean;
  userId: string;
  userName: string | null;
};

function formatSyncStatus(
  lastSyncAt: string | null,
  metadata: unknown,
  backfillPending: boolean,
): string {
  if (backfillPending) {
    return "Backfill pending — run calendar sync";
  }

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
      sync_cursor,
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

  return (data ?? []).map((row) => {
    const metadata = parseCalendarAccountMetadata(row.metadata);
    const cursors = loadCalendarSyncCursors(row.metadata, row.sync_cursor);
    const backfillPending =
      row.sync_enabled &&
      (metadata.needs_backfill === true ||
        (row.sync_cursor === null && Object.keys(cursors).length === 0));

    return {
      id: row.id,
      email: row.email,
      syncEnabled: row.sync_enabled,
      lastSyncAt: row.last_sync_at,
      backfillPending,
      syncStatus: formatSyncStatus(row.last_sync_at, row.metadata, backfillPending),
      userId: row.user_id,
      userName: row.users?.full_name ?? null,
    };
  });
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
    backfillPending: false,
    syncStatus: formatSyncStatus(data.last_sync_at, null, false),
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
