"use client";

import { useRouter } from "next/navigation";

import {
  applyPeerCompanyEnrichmentAction,
  inferAllCoAttendanceAction,
  inferSameCompanyAction,
} from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

export function InferAllCoAttendanceButton() {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { isPending, run } = useAsyncAction();

  return (
    <form
      action={() => {
        void run(async () => {
          const result = await inferAllCoAttendanceAction();
          if (result.error) {
            await alert({ title: "Inference failed", description: result.error });
            return;
          }
          toastSuccess(
            "Co-attendance inference complete",
            `${result.created} created, ${result.skipped} skipped.`,
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
  const { alert } = useAppDialog();
  const { isPending, run } = useAsyncAction();

  return (
    <form
      action={() => {
        void run(async () => {
          const result = await inferSameCompanyAction();
          if (result.error) {
            await alert({ title: "Inference failed", description: result.error });
            return;
          }
          toastSuccess(
            "Same-company inference complete",
            `${result.created} created, ${result.skipped} skipped.`,
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

export function ApplyPeerCompanyEnrichmentButton() {
  const router = useRouter();
  const { alert } = useAppDialog();
  const { isPending, run } = useAsyncAction();

  return (
    <form
      action={() => {
        void run(async () => {
          const result = await applyPeerCompanyEnrichmentAction();
          if (result.error) {
            await alert({
              title: "Company enrichment failed",
              description: result.error,
            });
            return;
          }
          toastSuccess(
            "Company enrichment complete",
            `${result.updated} profiles updated.`,
          );
          router.refresh();
        });
      }}
    >
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Running…" : "Fill companies from domains"}
      </Button>
    </form>
  );
}
