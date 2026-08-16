"use client";

import { useState } from "react";

import { commitImportAction, reopenImportAction } from "@/app/(app)/profiles/import/actions";
import type { CommitSummary, ImportDetail } from "@/lib/import/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EventOption = {
  id: string;
  title: string;
};

type ImportCommitPanelProps = {
  detail: ImportDetail;
  events: EventOption[];
};

function AttachToEventFields({
  events,
  initialEventId,
  initialEventTitle,
}: {
  events: EventOption[];
  initialEventId?: string | null;
  initialEventTitle?: string | null;
}) {
  const [choice, setChoice] = useState(initialEventId ?? "none");

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      {initialEventId && initialEventTitle ? (
        <p className="text-body text-foreground">
          Already connected to <strong>{initialEventTitle}</strong> from upload.
          Change the selection below to switch it, or leave as is.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="import-event-choice">Attach to an event (optional)</Label>
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger id="import-event-choice" className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No event</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title}
              </SelectItem>
            ))}
            <SelectItem value="new">+ Create new event</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name="eventId"
          value={choice === "none" || choice === "new" ? "" : choice}
        />
      </div>

      {choice === "new" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-event-title">Event name</Label>
            <Input id="new-event-title" name="newEventTitle" placeholder="e.g. Risk-Reward Equation breakfast" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-event-date">Event date</Label>
            <Input id="new-event-date" name="newEventDate" type="date" />
          </div>
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground">
        Everyone in this file will be linked as an attendee of this event and tagged with its name.
      </p>
    </div>
  );
}

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

export function ImportCommitPanel({ detail, events }: ImportCommitPanelProps) {
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
              ? "Every row was skipped. This usually means the automatic duplicate check didn't finish, or no name column was mapped (map Full name, or map First name + Last name together). Re-upload the file and try again."
              : "Profiles and relationships were saved."}
          </p>
          {detail.eventTitle ? (
            <p className="mt-1 text-body text-muted-foreground">
              Attendees were linked to the event <strong>{detail.eventTitle}</strong>.
            </p>
          ) : null}
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

  if (detail.status === "processing") {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-6">
        <h2 className="text-heading font-medium text-foreground">Completing…</h2>
        <p className="text-body text-muted-foreground">
          {detail.metadata.commit_checkpoint
            ? "This got interrupted partway through. Click below to resume from where it left off."
            : "This import is being completed. If it stalled, refresh and try again."}
        </p>
        <form action={handleSubmit}>
          <input type="hidden" name="importId" value={detail.id} />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Resuming…" : "Resume"}
          </Button>
        </form>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
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

  let helperText = "Checking for duplicates…";

  if (detail.unresolvedSoftMatches > 0) {
    helperText = `Resolve ${detail.unresolvedSoftMatches} row${
      detail.unresolvedSoftMatches === 1 ? "" : "s"
    } above before completing.`;
  } else if (dedupNotRun) {
    helperText = "Still checking for duplicates — this happens automatically, refresh in a moment.";
  } else if (hasPendingRows) {
    helperText = `${detail.pendingRowCount} row${
      detail.pendingRowCount === 1 ? "" : "s"
    } still pending — try fixing the column mapping above.`;
  } else if (noCommittableRows) {
    helperText =
      "No rows are ready. Check that Full name (or First name + Last name) is mapped, using the \"Fix column mapping\" section above.";
  } else if (detail.canCommit) {
    helperText = `Ready to create or update ${detail.committableRowCount} profile${
      detail.committableRowCount === 1 ? "" : "s"
    }.`;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <p className="text-body text-muted-foreground">{helperText}</p>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="importId" value={detail.id} />
        <AttachToEventFields
          events={events}
          initialEventId={detail.eventId}
          initialEventTitle={detail.eventTitle}
        />
        <Button type="submit" disabled={!detail.canCommit || isSubmitting}>
          {isSubmitting ? "Completing…" : "Complete import"}
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
