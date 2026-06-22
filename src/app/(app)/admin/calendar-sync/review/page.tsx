import { AdminPage } from "@/components/admin/admin-page";
import { CalendarSyncReviewWizard } from "@/components/admin/calendar-sync-review-wizard";
import { requireAdmin } from "@/lib/auth/session";
import { autoResolveNamedCalendarReviews } from "@/lib/data/calendar-sync-auto-resolve";
import {
  getCalendarSyncReviewSummary,
  listPendingCalendarReviewGroups,
  listRecentMatchedCalendarMeetings,
} from "@/lib/data/calendar-sync-review";

type CalendarSyncReviewPageProps = {
  searchParams: Promise<{ connected?: string }>;
};

export default async function CalendarSyncReviewPage({
  searchParams,
}: CalendarSyncReviewPageProps) {
  await requireAdmin();
  const params = await searchParams;

  await autoResolveNamedCalendarReviews();

  const [summary, unmatchedGroups, matchedMeetings] = await Promise.all([
    getCalendarSyncReviewSummary(),
    listPendingCalendarReviewGroups(),
    listRecentMatchedCalendarMeetings(),
  ]);

  return (
    <AdminPage
      title="Review calendar sync"
      description="Walk through what Google Calendar pulled in — matched meetings and people who still need a profile. Attendees with a first and last name on Google Calendar are added automatically."
      contentClassName="px-8 py-6"
    >
      {params.connected ? (
        <p className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-body text-foreground">
          Connected {params.connected}. Initial sync runs on the next scheduled
          sync (usually within a few minutes) — refresh this page to see
          meetings and people to review.
        </p>
      ) : null}
      <CalendarSyncReviewWizard
        summary={summary}
        unmatchedGroups={unmatchedGroups}
        matchedMeetings={matchedMeetings}
      />
    </AdminPage>
  );
}
