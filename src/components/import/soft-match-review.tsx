"use client";

import Link from "next/link";
import { useState } from "react";

import { resolveSoftMatchAction } from "@/app/(app)/admin/import/actions";
import type { ImportRowView } from "@/lib/import/types";
import { Button } from "@/components/ui/button";

type SoftMatchReviewProps = {
  importId: string;
  rows: ImportRowView[];
};

export function SoftMatchReview({ importId, rows }: SoftMatchReviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [resolvingRowId, setResolvingRowId] = useState<string | null>(null);

  async function handleResolve(formData: FormData) {
    const rowId = String(formData.get("rowId") ?? "");
    if (resolvingRowId) {
      return;
    }

    setResolvingRowId(rowId);
    setError(null);

    try {
      const result = await resolveSoftMatchAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setResolvingRowId(null);
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-heading font-medium text-foreground">
          Soft match review
        </h2>
        <p className="mt-1 text-body text-muted-foreground">
          These rows look like existing people by name and company. Confirm before
          merging — never auto-merge on name alone.
        </p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-4 rounded-md border border-border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div>
              <p className="text-caption text-muted-foreground">Incoming</p>
              <p className="text-body font-medium">{row.normalized.full_name}</p>
              <p className="text-body text-muted-foreground">
                {row.normalized.organisation_name ?? "No company"}
              </p>
              <p className="text-caption text-muted-foreground">
                {row.normalized.email ?? "No email"}
              </p>
            </div>

            <div>
              <p className="text-caption text-muted-foreground">Candidate</p>
              {row.matchedProfileId ? (
                <>
                  <Link
                    href={`/profiles/${row.matchedProfileId}`}
                    className="text-body font-medium text-foreground hover:underline"
                  >
                    {row.matchedProfileName}
                  </Link>
                  <p className="text-body text-muted-foreground">
                    {row.matchedProfileCompany ?? "No company"}
                  </p>
                </>
              ) : (
                <p className="text-body text-muted-foreground">No candidate loaded</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 lg:flex-col lg:justify-center">
              {(["confirm", "create", "skip"] as const).map((action) => (
                <form key={action} action={handleResolve}>
                  <input type="hidden" name="importId" value={importId} />
                  <input type="hidden" name="rowId" value={row.id} />
                  <input type="hidden" name="action" value={action} />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={resolvingRowId !== null}
                    variant={action === "confirm" ? "default" : "outline"}
                  >
                    {action === "confirm"
                      ? "Confirm merge"
                      : action === "create"
                        ? "Create new"
                        : "Skip row"}
                  </Button>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
