"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { runCalendarSyncAction } from "@/app/(app)/admin/integrations/actions";
import { Button } from "@/components/ui/button";

export function RunCalendarSyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await runCalendarSyncAction();
          if ("error" in result && result.error) {
            window.alert(result.error);
            return;
          }

          router.push("/admin/calendar-sync/review");
        });
      }}
    >
      {isPending ? "Starting sync…" : "Run calendar sync now"}
    </Button>
  );
}
