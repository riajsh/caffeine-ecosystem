"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteImportAction } from "@/app/(app)/admin/import/actions";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { toastSuccess } from "@/lib/toast";

type ImportDeleteButtonProps = {
  importId: string;
  filename: string;
};

export function ImportDeleteButton({ importId, filename }: ImportDeleteButtonProps) {
  const router = useRouter();
  const { confirm, alert } = useAppDialog();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = await confirm({
      title: "Delete import",
      description: `Delete import "${filename}"? Staged rows will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    const formData = new FormData();
    formData.set("importId", importId);

    try {
      const result = await deleteImportAction(formData);
      if (result?.error) {
        setError(result.error);
        await alert({ title: "Could not delete import", description: result.error });
        return;
      }

      toastSuccess("Import deleted");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isDeleting}
        onClick={handleDelete}
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </Button>
      {error ? (
        <p className="text-caption text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
