"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireUser } from "@/lib/auth/session";
import { disconnectCalendarAccount } from "@/lib/data/calendar-accounts";
import { syncAllCalendarAccounts } from "@/lib/integrations/calendar/sync";

export async function disconnectCalendarAccountAction(accountId: string) {
  await requireUser();

  try {
    await disconnectCalendarAccount(accountId);
    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");
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

  try {
    const result = await syncAllCalendarAccounts();
    revalidatePath("/admin");
    revalidatePath("/admin/calendar-sync/review");
    return { success: true as const, ...result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Calendar sync failed",
    };
  }
}
