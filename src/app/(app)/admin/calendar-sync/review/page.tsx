import Link from "next/link";

import { CalendarSyncReviewWizard } from "@/components/admin/calendar-sync-review-wizard";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
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
    <>
      <PageHeader
        title="Review calendar sync"
        description="Walk through what Google Calendar pulled in — matched meetings and people who still need a profile."
      >
        <Button asChild variant="outline">
          <Link href="/admin">Back to Admin</Link>
        </Button>
      </PageHeader>

      <div className="px-8 py-6">
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
      </div>
    </>
  );
}
