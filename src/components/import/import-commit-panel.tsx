"use client";

import { useState } from "react";

import { commitImportAction, reopenImportAction } from "@/app/(app)/admin/import/actions";
import type { CommitSummary, ImportDetail } from "@/lib/import/types";
import { Button } from "@/components/ui/button";

type ImportCommitPanelProps = {
  detail: ImportDetail;
};

function CommitSummaryView({ summary }: { summary: CommitSummary }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-caption text-muted-foreground">Created</dt>
        <dd className="text-subheading font-medium">{summary.created}</dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Updated</dt>
        <dd className="text-subheading font-medium">{summary.updated}</dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Skipped</dt>
        <dd className="text-subheading font-medium">{summary.skipped}</dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Owner warnings</dt>
        <dd className="text-subheading font-medium">{summary.ownerWarnings}</dd>
      </div>
    </dl>
  );
}

export function ImportCommitPanel({ detail }: ImportCommitPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await commitImportAction(formData);
      if (result?.error) {
        setError(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReopen(formData: FormData) {
    setError(null);
    const result = await reopenImportAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  if (detail.status === "complete" && detail.commitSummary) {
    const wroteNothing =
      detail.commitSummary.created === 0 && detail.commitSummary.updated === 0;

    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h2 className="text-heading font-medium text-foreground">
            {wroteNothing ? "Import finished with no changes" : "Import complete"}
          </h2>
          <p className="mt-1 text-body text-muted-foreground">
            {wroteNothing
              ? "Every row was skipped. This usually means dedup was not run, or Full name was not mapped. Re-upload the file and run through mapping and dedup again."
              : "Profiles and relationships were written to the graph."}
          </p>
        </div>
        <CommitSummaryView summary={detail.commitSummary} />
        {wroteNothing ? (
          <form action={handleReopen}>
            <input type="hidden" name="importId" value={detail.id} />
            <Button type="submit" variant="outline">
              Reopen import to retry
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  if (detail.status === "failed") {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-card p-6">
        <h2 className="text-heading font-medium text-destructive">Import failed</h2>
        <p className="text-body text-muted-foreground">
          {detail.metadata.errors?.join(", ") ?? "An error occurred during import."}
        </p>
      </div>
    );
  }

  const dedupNotRun = !detail.metadata.dedup_summary;
  const noCommittableRows =
    Boolean(detail.metadata.dedup_summary) && detail.committableRowCount === 0;
  const hasPendingRows = detail.pendingRowCount > 0;

  let helperText = "Confirm mapping and run dedup before committing.";

  if (detail.unresolvedSoftMatches > 0) {
    helperText = `Resolve ${detail.unresolvedSoftMatches} soft match${
      detail.unresolvedSoftMatches === 1 ? "" : "es"
    } before committing.`;
  } else if (dedupNotRun) {
    helperText = "Run dedup after confirming column mapping. Commit stays disabled until then.";
  } else if (hasPendingRows) {
    helperText = `${detail.pendingRowCount} row${
      detail.pendingRowCount === 1 ? "" : "s"
    } still pending — re-run dedup after fixing mapping.`;
  } else if (noCommittableRows) {
    helperText =
      "Dedup found no rows ready to commit. Check that Full name is mapped, fix errors in the preview table, then re-run dedup.";
  } else if (detail.canCommit) {
    helperText = `Ready to write ${detail.committableRowCount} row${
      detail.committableRowCount === 1 ? "" : "s"
    } to the graph.`;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-heading font-medium text-foreground">Commit</h2>
        <p className="mt-1 text-body text-muted-foreground">{helperText}</p>
      </div>

      <form action={handleSubmit}>
        <input type="hidden" name="importId" value={detail.id} />
        <Button type="submit" disabled={!detail.canCommit || isSubmitting}>
          {isSubmitting ? "Committing…" : "Commit import"}
        </Button>
      </form>

      {isSubmitting ? (
        <p className="text-caption text-muted-foreground">
          Large imports can take up to a minute. Do not close this tab.
        </p>
      ) : null}

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
