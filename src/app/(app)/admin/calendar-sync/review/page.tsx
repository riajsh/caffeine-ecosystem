import { AdminPage } from "@/components/admin/admin-page";
import { CalendarSyncReviewWizard } from "@/components/admin/calendar-sync-review-wizard";
import { requireAdmin } from "@/lib/auth/session";
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

  const [summary, unmatchedGroups, matchedMeetings] = await Promise.all([
    getCalendarSyncReviewSummary(),
    listPendingCalendarReviewGroups(),
    listRecentMatchedCalendarMeetings(),
  ]);

  return (
    <AdminPage
      title="Review calendar sync"
      description="Walk through what Google Calendar pulled in — matched meetings and people who still need a profile."
      contentClassName="px-8 py-6"
    >
      {params.connected ? (
        <p className="mb-4 text-body text-foreground">
          Connected {params.connected}. Initial sync is running — refresh in a
          minute if counts are still updating.
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
