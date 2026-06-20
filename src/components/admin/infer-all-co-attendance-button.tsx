"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  inferAllCoAttendanceAction,
  inferSameCompanyAction,
} from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";

export function InferAllCoAttendanceButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          const result = await inferAllCoAttendanceAction();
          if (result.error) {
            window.alert(result.error);
            return;
          }
          window.alert(
            `Co-attendance: ${result.created} created, ${result.skipped} skipped.`,
          );
          router.refresh();
        });
      }}
    >
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Running…" : "Infer co-attendance"}
      </Button>
    </form>
  );
}

export function InferSameCompanyButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          const result = await inferSameCompanyAction();
          if (result.error) {
            window.alert(result.error);
            return;
          }
          window.alert(
            `Same company: ${result.created} created, ${result.skipped} skipped.`,
          );
          router.refresh();
        });
      }}
    >
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Running…" : "Infer same-company"}
      </Button>
    </form>
  );
}
