"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { inferCoAttendanceAction } from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";

type InferCoAttendanceButtonProps = {
  eventId: string;
  attendeeCount: number;
};

export function InferCoAttendanceButton({
  eventId,
  attendeeCount,
}: InferCoAttendanceButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (attendeeCount < 2) {
    return null;
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await inferCoAttendanceAction(formData);
          if (result.error) {
            window.alert(result.error);
            return;
          }
          window.alert(
            `Created ${result.created} inferred connection${result.created === 1 ? "" : "s"} (${result.skipped} skipped).`,
          );
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Inferring…" : "Infer co-attendance connections"}
      </Button>
    </form>
  );
}
