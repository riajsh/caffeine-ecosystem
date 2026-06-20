"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteEventAction } from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";

type DeleteEventButtonProps = {
  eventId: string;
  eventTitle: string;
};

export function DeleteEventButton({
  eventId,
  eventTitle,
}: DeleteEventButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        if (
          !window.confirm(
            `Delete "${eventTitle}"? Attendees and linked timeline entries will be removed.`,
          )
        ) {
          return;
        }

        startTransition(async () => {
          const result = await deleteEventAction(formData);
          if (result.error) {
            window.alert(result.error);
            return;
          }
          router.push("/events");
        });
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="text-destructive hover:text-destructive"
      >
        {isPending ? "Deleting…" : "Delete event"}
      </Button>
    </form>
  );
}
