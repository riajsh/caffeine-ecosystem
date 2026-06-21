import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { OwnershipDistributionCard } from "@/components/overview/ownership-distribution-card";
import { OverviewEventsCard } from "@/components/overview/overview-events-card";
import { RecentActivityCard } from "@/components/overview/recent-activity-card";
import { ReconnectPromptsCard } from "@/components/overview/reconnect-prompts-card";
import { SearchForm } from "@/components/search/search-form";
import { listRecentOrgActivities } from "@/lib/data/activities";
import { getOwnershipSummary } from "@/lib/computed/ownership";
import { getReconnectSuggestions } from "@/lib/computed/connect";
import { listRecentPastEvents, listUpcomingEvents } from "@/lib/data/events";

export default async function OverviewPage() {
  const [recentActivity, upcomingEvents, recentEvents, reconnect, ownership] =
    await Promise.all([
      listRecentOrgActivities(8),
      listUpcomingEvents(5),
      listRecentPastEvents(5),
      getReconnectSuggestions(3),
      getOwnershipSummary(),
    ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Start with search, then follow signals into profiles, Connect, and Events."
      />
      <div className="space-y-8 px-8 py-6">
        <section className="space-y-3">
          <SearchForm />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caption text-muted-foreground">
              Profiles, tags, activity, events, and email subjects. Body matches
              for owners and admins only.
            </p>
            <Link
              href="/search"
              className="text-caption text-interactive-primary hover:underline"
            >
              Advanced search with filters →
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <RecentActivityCard activities={recentActivity} />
          <OverviewEventsCard
            upcomingEvents={upcomingEvents}
            recentEvents={recentEvents}
          />
          <ReconnectPromptsCard suggestions={reconnect} />
          <OwnershipDistributionCard summary={ownership} />
        </section>

        <p className="text-body text-muted-foreground">
          Browse the full graph in{" "}
          <Link href="/profiles" className="text-foreground underline">
            Profiles
          </Link>
          , review suggestions on{" "}
          <Link href="/connect" className="text-foreground underline">
            Connect
          </Link>
          , or explore{" "}
          <Link href="/orbit" className="text-foreground underline">
            Orbit
          </Link>
          .
        </p>
      </div>
    </>
  );
}
