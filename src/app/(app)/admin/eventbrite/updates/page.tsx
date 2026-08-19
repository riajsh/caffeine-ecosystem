import { AdminPage } from "@/components/admin/admin-page";
import { EventbriteProfileUpdateRow } from "@/components/admin/eventbrite-profile-update-row";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth/session";
import { listPendingProfileUpdateReviews } from "@/lib/data/eventbrite-profile-updates";

export default async function EventbriteProfileUpdatesPage() {
  await requireAdmin();

  const reviews = await listPendingProfileUpdateReviews();

  return (
    <AdminPage
      title="Possible updates"
      description="Attendees who already have a profile, but whose Eventbrite answers this time don't match what's on file — a role change, new company, or similar. Review each and decide whether to update the profile."
    >
      {reviews.length === 0 ? (
        <EmptyState
          variant="dashed"
          title="Nothing to review"
          description="Profile changes spotted from Eventbrite answers will show up here."
        />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <EventbriteProfileUpdateRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </AdminPage>
  );
}
