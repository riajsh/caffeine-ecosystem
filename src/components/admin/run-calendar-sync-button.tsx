"use client";

import { useRouter } from "next/navigation";

import { runCalendarSyncAction } from "@/app/(app)/admin/integrations/actions";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

export function RunCalendarSyncButton() {
  const router = useRouter();
  const { isPending, run } = useAsyncAction();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        void run(async () => {
          await runCalendarSyncAction();
          toastSuccess("Calendar sync started");
          router.push("/admin/calendar-sync/review");
        });
      }}
    >
      {isPending ? "Starting sync…" : "Run calendar sync now"}
    </Button>
  );
}
