"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteImportAction } from "@/app/(app)/admin/import/actions";
import { Button } from "@/components/ui/button";

type ImportDeleteButtonProps = {
  importId: string;
  filename: string;
};

export function ImportDeleteButton({ importId, filename }: ImportDeleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete import "${filename}"? Staged rows will be removed. This cannot be undone.`,
      )
    ) {
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
        return;
      }

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
