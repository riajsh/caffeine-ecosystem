"use client";

import { useRouter } from "next/navigation";

import { runCalendarSyncAction } from "@/app/(app)/admin/integrations/actions";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

export function RunCalendarSyncButton() {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { isPending, run } = useAsyncAction();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        void run(async () => {
          const result = await runCalendarSyncAction();
          if ("error" in result && result.error) {
            await alert({
              title: "Calendar sync failed",
              description: result.error,
            });
            return;
          }
          if (!("success" in result)) {
            return;
          }
          const warningCount = result.stats.errors.length;
          toastSuccess(
            warningCount > 0
              ? "Calendar sync finished with warnings"
              : "Calendar sync finished",
          );
          router.push("/admin/calendar-sync/review");
        });
      }}
    >
      {isPending ? "Syncing…" : "Run calendar sync now"}
    </Button>
  );
}
