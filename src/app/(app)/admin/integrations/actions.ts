"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdmin, requireUser } from "@/lib/auth/session";
import { disconnectCalendarAccount } from "@/lib/data/calendar-accounts";
import { syncAllCalendarAccounts } from "@/lib/integrations/calendar/sync";

export async function disconnectCalendarAccountAction(accountId: string) {
  await requireUser();

  try {
    await disconnectCalendarAccount(accountId);
    revalidatePath("/admin");
    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to disconnect calendar account",
    };
  }
}

export async function runCalendarSyncAction() {
  await requireAdmin();

  after(async () => {
    try {
      await syncAllCalendarAccounts();
      revalidatePath("/admin");
    } catch (error) {
      console.error("Background calendar sync failed:", error);
    }
  });

  revalidatePath("/admin");
  return { success: true as const, started: true as const };
}
