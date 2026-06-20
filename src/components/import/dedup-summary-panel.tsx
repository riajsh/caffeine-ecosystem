"use client";

import { useState } from "react";

import { runDedupAction } from "@/app/(app)/admin/import/actions";
import type { DedupSummary } from "@/lib/import/types";
import { Button } from "@/components/ui/button";

type DedupSummaryPanelProps = {
  importId: string;
  summary: DedupSummary | null;
  mappingConfirmed: boolean;
};

export function DedupSummaryPanel({
  importId,
  summary,
  mappingConfirmed,
}: DedupSummaryPanelProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await runDedupAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-heading font-medium text-foreground">Dedup</h2>
        <p className="mt-1 text-body text-muted-foreground">
          Email matches merge automatically. Name and company matches require review
          before commit.
        </p>
      </div>

      {summary ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-caption text-muted-foreground">Email matches</dt>
            <dd className="text-subheading font-medium">{summary.matched_email}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Soft matches</dt>
            <dd className="text-subheading font-medium">{summary.soft_match}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">New profiles</dt>
            <dd className="text-subheading font-medium">{summary.new}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Errors</dt>
            <dd className="text-subheading font-medium">{summary.error}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-body text-muted-foreground">
          {mappingConfirmed
            ? "Run dedup to classify each row."
            : "Confirm column mapping before running dedup."}
        </p>
      )}

      {mappingConfirmed ? (
        <form action={handleSubmit}>
          <input type="hidden" name="importId" value={importId} />
          <Button type="submit" variant={summary ? "outline" : "default"}>
            {summary ? "Re-run dedup" : "Run dedup"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
