import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { SearchFilters } from "@/components/search/search-filters";
import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { SearchTagFilter } from "@/components/search/search-tag-filter";
import { search } from "@/lib/data/search";
import { listOrgTags } from "@/lib/data/tags";
import { listOrgUsers } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/session";
import { resolveViewAsOwnerId } from "@/lib/view-as/resolve";
import type { Database } from "@/types/database";

type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];

const VALID_STATUSES: RelationshipStatus[] = [
  "prospect",
  "active",
  "partner",
  "advisor",
  "community",
  "dormant",
  "inactive",
];

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    owner?: string;
    status?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const {
    q,
    tag: tagId,
    owner: ownerParam,
    status,
  } = await searchParams;
  const query = q?.trim() ?? "";

  if (tagId && !/^[0-9a-f-]{36}$/i.test(tagId)) {
    notFound();
  }

  if (ownerParam && !/^[0-9a-f-]{36}$/i.test(ownerParam)) {
    notFound();
  }

  if (status && !VALID_STATUSES.includes(status as RelationshipStatus)) {
    notFound();
  }

  const [currentUser, teamUsers, orgTags] = await Promise.all([
    requireUser(),
    listOrgUsers(),
    listOrgTags(),
  ]);

  const ownerUserId = await resolveViewAsOwnerId(ownerParam, currentUser, teamUsers);

  const results = query
    ? await search(query, {
        tagId,
        ownerUserId,
        status: status as RelationshipStatus | undefined,
      })
    : [];

  const hasProfileFilters = Boolean(tagId || ownerUserId || status);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-20 shrink-0 bg-background">
        <PageHeader
          title="Search"
          description="Evidence-rich results across profiles, activity, events, and email."
        />
        <div className="space-y-3 border-b border-border px-8 pb-4">
          <SearchForm
            defaultQuery={query}
            autoFocus
            preserveParams={{
              tag: tagId,
              owner: ownerUserId,
              status,
            }}
          />
          <SearchTagFilter
            tags={orgTags}
            query={query}
            activeTagId={tagId}
            activeOwnerId={ownerUserId}
            activeStatus={status}
          />
          <SearchFilters
            query={query}
            teamUsers={teamUsers}
            activeTagId={tagId}
            activeOwnerId={ownerUserId}
            activeStatus={status}
          />
        </div>
      </div>
      <div className="px-8 py-6">
        <SearchResults
          query={query}
          results={results}
          hasProfileFilters={hasProfileFilters}
        />
      </div>
    </div>
  );
}
