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
            // These four should always add up to what Eventbrite reported
            // fetching — every attendee lands in exactly one bucket. If they
            // don't add up, that's a real sign something's being dropped,
            // not just normal steady-state re-syncing (most attendees on a
            // re-sync land in "already handled" and that's expected).
            const accountedFor =
              stats.attendeesMatched +
              stats.attendeesQueuedForReview +
              stats.attendeesSkippedNoEmail +
              stats.attendeesAlreadyHandled;
            const mismatch = stats.attendeesFetched - accountedFor;
            const skippedNote =
              stats.attendeesSkippedNoEmail > 0
                ? `, ${stats.attendeesSkippedNoEmail} skipped (no usable email)`
                : "";
            toastSuccess(
              `Synced ${stats.eventsProcessed} event${stats.eventsProcessed === 1 ? "" : "s"} — ${stats.attendeesFetched} fetched from Eventbrite, ${stats.attendeesMatched} matched, ${stats.attendeesQueuedForReview} new to review${skippedNote}${
                mismatch !== 0
                  ? ` — ${mismatch} unaccounted for, something's wrong, please flag this`
                  : ""
              }`,
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
