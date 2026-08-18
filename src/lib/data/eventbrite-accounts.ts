import "server-only";

import { requireAdmin } from "@/lib/auth/session";
import { validateEventbriteToken } from "@/lib/integrations/eventbrite/client";
import { decryptToken, encryptToken } from "@/lib/integrations/google/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EventbriteAccountSummary = {
  id: string;
  accountName: string | null;
  accountEmail: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  connectedByName: string | null;
};

export async function getEventbriteAccountForOrg(): Promise<EventbriteAccountSummary | null> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eventbrite_accounts")
    .select(
      `
      id,
      account_name,
      account_email,
      sync_enabled,
      last_sync_at,
      users (
        full_name
      )
    `,
    )
    .eq("org_id", user.org_id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Eventbrite account: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    accountName: data.account_name,
    accountEmail: data.account_email,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at,
    connectedByName: data.users?.full_name ?? null,
  };
}

export async function connectEventbriteAccount(
  token: string,
): Promise<EventbriteAccountSummary> {
  const user = await requireAdmin();
  const supabase = await createClient();

  // Validate against Eventbrite first — don't store a token we haven't confirmed works.
  const identity = await validateEventbriteToken(token);
  const encrypted = encryptToken(token.trim());

  const { data, error } = await supabase
    .from("eventbrite_accounts")
    .upsert(
      {
        org_id: user.org_id,
        connected_by: user.id,
        account_name: identity.name,
        account_email: identity.email,
        access_token: encrypted,
        sync_enabled: true,
      },
      { onConflict: "org_id" },
    )
    .select("id, account_name, account_email, sync_enabled, last_sync_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save the Eventbrite connection: ${error?.message ?? "unknown error"}`,
    );
  }

  return {
    id: data.id,
    accountName: data.account_name,
    accountEmail: data.account_email,
    syncEnabled: data.sync_enabled,
    lastSyncAt: data.last_sync_at,
    connectedByName: user.full_name,
  };
}

export async function disconnectEventbriteAccount(): Promise<void> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("eventbrite_accounts")
    .update({ sync_enabled: false })
    .eq("org_id", user.org_id);

  if (error) {
    throw new Error(`Failed to disconnect Eventbrite: ${error.message}`);
  }
}

/**
 * Reads and decrypts the stored token, scoped by the caller's own RLS
 * session (admin only, per eventbrite_accounts' policies).
 */
export async function getDecryptedEventbriteToken(
  orgId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eventbrite_accounts")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("sync_enabled", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Eventbrite token: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return decryptToken(data.access_token);
}

/**
 * Same as above, but via the admin (service-role) client — for the cron
 * sync job, which has no logged-in user session to rely on RLS with.
 */
export async function getDecryptedEventbriteTokenForSync(
  orgId: string,
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("eventbrite_accounts")
    .select("access_token")
    .eq("org_id", orgId)
    .eq("sync_enabled", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Eventbrite token: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return decryptToken(data.access_token);
}
