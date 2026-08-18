import { AdminPage } from "@/components/admin/admin-page";
import { EventbriteReviewRow } from "@/components/admin/eventbrite-review-row";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { listPendingEventbriteReviews } from "@/lib/data/eventbrite-reviews";

export default async function EventbriteReviewPage() {
  await requireAdmin();

  const reviews = await listPendingEventbriteReviews();

  return (
    <AdminPage
      title="Eventbrite review"
      description="Attendees pulled from Eventbrite who didn't match anyone already in Caffeine. Link each one to an existing profile, create a new profile, or ignore it."
    >
      {reviews.length === 0 ? (
        <EmptyState
          variant="dashed"
          title="Nothing to review"
          description="Unmatched Eventbrite attendees will show up here."
        />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <EventbriteReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </AdminPage>
  );
}
