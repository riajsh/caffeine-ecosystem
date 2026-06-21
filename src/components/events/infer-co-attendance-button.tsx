"use client";

import { useRouter } from "next/navigation";

import { inferCoAttendanceAction } from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

type InferCoAttendanceButtonProps = {
  eventId: string;
  attendeeCount: number;
};

export function InferCoAttendanceButton({
  eventId,
  attendeeCount,
}: InferCoAttendanceButtonProps) {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { isPending, run } = useAsyncAction();

  if (attendeeCount < 2) {
    return null;
  }

  return (
    <form
      action={(formData) => {
        void run(async () => {
          const result = await inferCoAttendanceAction(formData);
          if (result.error) {
            await alert({ title: "Inference failed", description: result.error });
            return;
          }
          toastSuccess(
            "Co-attendance inference complete",
            `Created ${result.created} connection${result.created === 1 ? "" : "s"} (${result.skipped} skipped).`,
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
