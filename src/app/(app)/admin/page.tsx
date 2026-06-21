import Link from "next/link";

import {
  InferAllCoAttendanceButton,
  InferSameCompanyButton,
} from "@/components/admin/infer-all-co-attendance-button";
import { CalendarAccountRow } from "@/components/admin/calendar-account-row";
import { CalendarConnectButton } from "@/components/admin/calendar-connect-button";
import { DeployChecklist } from "@/components/admin/deploy-checklist";
import { RunCalendarSyncButton } from "@/components/admin/run-calendar-sync-button";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { listCalendarAccountsForOrg } from "@/lib/data/calendar-accounts";
import { getDeployChecklist } from "@/lib/deploy/checklist";

type AdminPageProps = {
  searchParams: Promise<{
    calendar_connected?: string;
    connected?: string;
    calendar_error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireAdmin();
  const params = await searchParams;
  const deployChecks = getDeployChecklist();
  let calendarAccounts: Awaited<ReturnType<typeof listCalendarAccountsForOrg>> =
    [];

  try {
    calendarAccounts = await listCalendarAccountsForOrg();
  } catch {
    calendarAccounts = [];
  }

  return (
    <>
      <PageHeader
        title="Admin"
        description="Import data, manage review queues, and configure the workspace."
      />
      <div className="space-y-6 px-8 py-6">
        <DeployChecklist items={deployChecks} />

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Datasets</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Upload CSV exports, map columns, review dedup matches, and commit
            profiles into the graph.
          </p>
          <Button asChild>
            <Link href="/admin/datasets">Open datasets</Link>
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Team</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Relationship owners, tags, dedup, and archived contacts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/team-members">Team members</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/tags">Tags</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/dedup">Dedup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/archived">Archived</Link>
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">
            Google Calendar
          </h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Connect a Google Calendar account to sync meetings with external
            participants. Matched attendees become meeting activities on profile
            timelines; unmatched emails go to a review queue.
          </p>
          {(params.calendar_connected ?? params.connected) ? (
            <p className="text-body text-foreground">
              Connected {params.calendar_connected ?? params.connected}. Initial
              sync is running in the background.
            </p>
          ) : null}
          {params.calendar_error ? (
            <p className="text-body text-destructive">
              Calendar connect failed: {params.calendar_error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <CalendarConnectButton />
            <RunCalendarSyncButton />
            <Button asChild variant="outline">
              <Link href="/admin/calendar-sync/review">Review sync results</Link>
            </Button>
          </div>
          {calendarAccounts.length > 0 ? (
            <div className="space-y-2 pt-2">
              {calendarAccounts.map((account) => (
                <CalendarAccountRow
                  key={account.id}
                  accountId={account.id}
                  email={account.email}
                  userName={account.userName}
                  syncStatus={account.syncStatus}
                  syncEnabled={account.syncEnabled}
                  isCurrentUser={account.userId === user.id}
                />
              ))}
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">
              No calendar accounts connected yet.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Inference</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Infer profile-to-profile connections from shared event attendance
            and normalised company names. Co-attendance also runs automatically
            when attendees are added.
          </p>
          <div className="flex flex-wrap gap-3">
            <InferAllCoAttendanceButton />
            <InferSameCompanyButton />
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-heading font-medium text-foreground">Deferred</h2>
          <ul className="list-disc space-y-1 pl-5 text-body text-muted-foreground">
            <li>Email participant review queue (requires Gmail sync)</li>
          </ul>
        </section>
      </div>
    </>
  );
}
