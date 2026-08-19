import { AdminPage } from "@/components/admin/admin-page";
import { EventbriteProfileUpdateRow } from "@/components/admin/eventbrite-profile-update-row";
import { EventbriteReviewList } from "@/components/admin/eventbrite-review-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { listPendingProfileUpdateReviews } from "@/lib/data/eventbrite-profile-updates";
import { listPendingEventbriteReviews } from "@/lib/data/eventbrite-reviews";

export default async function EventbriteReviewPage() {
  await requireAdmin();

  const [reviews, profileUpdates] = await Promise.all([
    listPendingEventbriteReviews(),
    listPendingProfileUpdateReviews(),
  ]);

  return (
    <AdminPage
      title="Eventbrite review"
      description="Attendees pulled from Eventbrite who didn't match anyone already in Caffeine, plus profiles whose Eventbrite answers don't match what's on file."
    >
      {reviews.length === 0 ? (
        <EmptyState
          variant="dashed"
          title="Nothing to review"
          description="Unmatched Eventbrite attendees will show up here."
        />
      ) : (
        <EventbriteReviewList reviews={reviews} />
      )}

      <div className="space-y-3 pt-4">
        <h2 className="text-heading font-medium text-foreground">
          Possible updates
        </h2>
        <p className="text-body text-muted-foreground">
          Attendees who already have a profile, but whose Eventbrite answers
          this time don&apos;t match what&apos;s on file — a role change, new
          company, or similar.
        </p>
        {profileUpdates.length === 0 ? (
          <EmptyState
            variant="dashed"
            title="Nothing to review"
            description="Profile changes spotted from Eventbrite answers will show up here."
          />
        ) : (
          <div className="space-y-2">
            {profileUpdates.map((review) => (
              <EventbriteProfileUpdateRow key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
