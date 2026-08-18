"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { syncEventbriteNowAction } from "@/app/(app)/admin/eventbrite/actions";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

export function EventbriteSyncNowButton() {
  const router = useRouter();
  const { isPending, run } = useAsyncAction();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          void run(async () => {
            setError(null);
            const result = await syncEventbriteNowAction();
            if (!("success" in result) || !result.success) {
              setError(
                "error" in result ? result.error : "Sync failed",
              );
              return;
            }
            const stats = result.stats;
            toastSuccess(
              `Synced ${stats.eventsProcessed} event${stats.eventsProcessed === 1 ? "" : "s"} — ${stats.attendeesMatched} matched, ${stats.attendeesQueuedForReview} to review`,
            );
            router.refresh();
          });
        }}
      >
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
      {error ? (
        <p className="mt-1 text-caption text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
