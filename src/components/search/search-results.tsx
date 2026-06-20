import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatInteractionDate } from "@/lib/format/date";
import {
  groupSearchResults,
  type SearchResult,
} from "@/lib/data/search";

const GROUP_ORDER = [
  "profile",
  "activity",
  "event",
  "thread",
  "message",
] as const;

const GROUP_TITLES: Record<(typeof GROUP_ORDER)[number], string> = {
  profile: "Profiles",
  activity: "Activity",
  event: "Events",
  thread: "Email threads",
  message: "Email messages",
};

type SearchResultsProps = {
  query: string;
  results: SearchResult[];
  hasProfileFilters?: boolean;
};

export function SearchResults({
  query,
  results,
  hasProfileFilters = false,
}: SearchResultsProps) {
  if (!query.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-subheading font-medium text-foreground">
          Search the graph
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Find people, activity, events, tags, and email subjects across the
          org.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    const createHref = `/profiles/new?name=${encodeURIComponent(query)}`;

    return (
      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
        <p className="text-subheading font-medium text-foreground">
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Try a name, company, tag, or email subject — or add them to the graph.
          {hasProfileFilters
            ? " Profile filters may also be hiding matches."
            : ""}
        </p>
        <Button asChild className="mt-6">
          <Link href={createHref}>Add &ldquo;{query}&rdquo; as new profile</Link>
        </Button>
      </div>
    );
  }

  const groups = groupSearchResults(results);

  return (
    <div className="space-y-8">
      {GROUP_ORDER.map((entityType) => {
        const items = groups[entityType];
        if (items.length === 0) {
          return null;
        }

        return (
          <section key={entityType} className="space-y-3">
            <h2 className="text-heading font-medium text-foreground">
              {GROUP_TITLES[entityType]}
            </h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {items.map((result) => (
                <li key={`${result.entityType}-${result.id}`}>
                  <Link
                    href={result.href}
                    className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-body font-medium text-foreground">
                        {result.title}
                      </p>
                      {result.subtitle ? (
                        <p className="text-body text-muted-foreground">
                          {result.subtitle}
                        </p>
                      ) : null}
                      <p className="text-caption text-muted-foreground">
                        {result.contextLabel}
                        {result.primaryOwnerName
                          ? ` · Owner: ${result.primaryOwnerName}`
                          : ""}
                        {result.lastInteractionAt
                          ? ` · Last: ${formatInteractionDate(result.lastInteractionAt)}`
                          : ""}
                        {result.activityDate
                          ? ` · ${formatInteractionDate(result.activityDate)}`
                          : ""}
                        {result.eventDate
                          ? ` · ${formatInteractionDate(result.eventDate)}`
                          : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
