"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { bulkCreateProfilesFromReviewsAction } from "@/app/(app)/admin/eventbrite/actions";
import { EventbriteReviewRow } from "@/components/admin/eventbrite-review-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EventbriteReviewRow as EventbriteReviewRowData } from "@/lib/data/eventbrite-reviews";
import { toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/lib/use-async-action";

type RowState = { fullName: string; email: string; selected: boolean };

export function EventbriteReviewList({
  reviews,
}: {
  reviews: EventbriteReviewRowData[];
}) {
  const router = useRouter();
  const { isPending, run } = useAsyncAction();
  const [error, setError] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      reviews.map((review) => [
        review.id,
        {
          fullName: review.displayName ?? "",
          email: review.email,
          selected: false,
        },
      ]),
    ),
  );

  const selectedIds = useMemo(
    () => reviews.filter((review) => (rowState[review.id]?.selected ?? false)).map((review) => review.id),
    [reviews, rowState],
  );
  const allSelected = reviews.length > 0 && selectedIds.length === reviews.length;

  function toggleAll(value: boolean) {
    setRowState((current) =>
      Object.fromEntries(
        reviews.map((review) => [
          review.id,
          { ...(current[review.id] ?? defaultRowFor(review.id)), selected: value },
        ]),
      ),
    );
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRowState((current) => ({
      ...current,
      [id]: { ...defaultRowFor(id), ...current[id], ...patch },
    }));
  }

  function defaultRowFor(id: string): RowState {
    const review = reviews.find((entry) => entry.id === id);
    return { fullName: review?.displayName ?? "", email: review?.email ?? "", selected: false };
  }

  function rowFor(id: string): RowState {
    return rowState[id] ?? defaultRowFor(id);
  }

  function handleBulkCreate() {
    if (selectedIds.length === 0) {
      return;
    }
    void run(async () => {
      setError(null);
      const items = selectedIds.map((reviewId) => ({
        reviewId,
        fullName: rowFor(reviewId).fullName,
        email: rowFor(reviewId).email,
      }));
      const result = await bulkCreateProfilesFromReviewsAction(items);

      if (result.createdCount > 0) {
        toastSuccess(
          `Created ${result.createdCount} profile${result.createdCount === 1 ? "" : "s"}`,
        );
      }
      if (result.errors.length > 0) {
        setError(
          `${result.errors.length} couldn't be created: ${result.errors
            .map((entry) => entry.message)
            .join("; ")}`,
        );
      }
      router.refresh();
    });
  }

  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <label className="flex items-center gap-2 text-body text-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(value) => toggleAll(value === true)}
            aria-label="Select all"
          />
          Select all
        </label>
        <Button
          type="button"
          size="sm"
          disabled={selectedIds.length === 0 || isPending}
          onClick={handleBulkCreate}
        >
          {isPending
            ? "Creating…"
            : `Create ${selectedIds.length > 0 ? `${selectedIds.length} ` : ""}new profile${
                selectedIds.length === 1 ? "" : "s"
              }`}
        </Button>
      </div>

      {error ? (
        <p className="text-caption text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {reviews.map((review) => (
          <EventbriteReviewRow
            key={review.id}
            review={review}
            fullName={rowFor(review.id).fullName}
            email={rowFor(review.id).email}
            onFullNameChange={(value) => updateRow(review.id, { fullName: value })}
            onEmailChange={(value) => updateRow(review.id, { email: value })}
            selected={rowFor(review.id).selected}
            onToggleSelected={(value) => updateRow(review.id, { selected: value })}
          />
        ))}
      </div>
    </div>
  );
}
