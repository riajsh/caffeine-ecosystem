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
      getReconnectSuggestions(5),
      getOwnershipSummary(),
    ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Search is the centre of gravity. Start here, then drill into profiles."
      />
      <div className="space-y-8 px-8 py-6">
        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Search</h2>
          <SearchForm />
          <p className="text-caption text-muted-foreground">
            Searches profiles, tags, activity, events, and email subjects.
            Email body matches appear for owners and admins only.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <RecentActivityCard activities={recentActivity} />
          </div>
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
          </Link>{" "}
          or review{" "}
          <Link href="/events" className="text-foreground underline">
            Events
          </Link>
          .
        </p>
      </div>
    </>
  );
}
