import Link from "next/link";

import { FilterChipLink } from "@/components/filters/filter-chips";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountLabel, ListMeta } from "@/components/ui/list-meta";
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

const EXAMPLE_SEARCHES = [
  "network",
  "partner",
  "London",
  "founder",
] as const;

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
      <EmptyState
        variant="dashed"
        title="Search the graph"
        description="Find people, activity, events, tags, and email subjects across the org."
      >
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_SEARCHES.map((example) => (
            <FilterChipLink
              key={example}
              href={`/search?q=${encodeURIComponent(example)}`}
              isActive={false}
            >
              {example}
            </FilterChipLink>
          ))}
        </div>
      </EmptyState>
    );
  }

  if (results.length === 0) {
    const createHref = `/profiles/new?name=${encodeURIComponent(query)}`;

    return (
      <EmptyState
        title={`No results for "${query}"`}
        description={`Try a name, company, tag, or email subject — or add them to the graph.${
          hasProfileFilters ? " Profile filters may also be hiding matches." : ""
        }`}
      >
        <Button asChild>
          <Link href={createHref}>Add &ldquo;{query}&rdquo; as new profile</Link>
        </Button>
      </EmptyState>
    );
  }

  const groups = groupSearchResults(results);

  return (
    <div className="space-y-8">
      <ListMeta>
        {formatCountLabel(results.length, "result")} for &ldquo;{query}&rdquo;
      </ListMeta>
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
                    className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:flex-row sm:items-start sm:justify-between"
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
