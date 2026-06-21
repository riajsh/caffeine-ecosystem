import Link from "next/link";
import { notFound } from "next/navigation";

import { Suspense } from "react";

import { PageHeader } from "@/components/app-shell/page-header";
import { ProfileDetailView } from "@/components/profiles/profile-detail-view";
import { ProfileDrawer } from "@/components/profiles/profile-drawer";
import { ProfilesListFilters } from "@/components/profiles/profiles-list-filters";
import { ProfilesTable } from "@/components/profiles/profiles-table";
import { ProfilesTagFilter } from "@/components/profiles/profiles-tag-filter";
import { formatCountLabel, ListMeta } from "@/components/ui/list-meta";
import { Button } from "@/components/ui/button";
import { getProfileNetworkIntel } from "@/lib/computed/profile-intelligence";
import { getProfileById, listProfileCompanies, listProfiles, PROFILES_PAGE_SIZE } from "@/lib/data/profiles";
import { listOrgTags } from "@/lib/data/tags";
import { listOrgUsers } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/session";
import { parseProfileSort, parseSortOrder } from "@/lib/profiles/list-sort";
import { parseProfileTabOrDefault } from "@/lib/profiles/tab";
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

type ProfilesPageProps = {
  searchParams: Promise<{
    profile?: string;
    tag?: string;
    tab?: string;
    owner?: string;
    status?: string;
    company?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
};

function buildListHref(options: {
  tag?: string;
  owner?: string;
  status?: string;
  company?: string;
  sort?: string;
  order?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (options.tag) params.set("tag", options.tag);
  if (options.owner) params.set("owner", options.owner);
  if (options.status) params.set("status", options.status);
  if (options.company) params.set("company", options.company);
  if (options.sort && options.sort !== "name") params.set("sort", options.sort);
  if (options.order && options.order !== "asc") params.set("order", options.order);
  if (options.page && options.page > 1) params.set("page", String(options.page));
  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

function buildCloseHref(options: {
  tag?: string;
  owner?: string;
  status?: string;
  company?: string;
  sort?: string;
  order?: string;
}) {
  const params = new URLSearchParams();
  if (options.tag) params.set("tag", options.tag);
  if (options.owner) params.set("owner", options.owner);
  if (options.status) params.set("status", options.status);
  if (options.company) params.set("company", options.company);
  if (options.sort && options.sort !== "name") params.set("sort", options.sort);
  if (options.order && options.order !== "asc") params.set("order", options.order);
  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

export default async function ProfilesPage({ searchParams }: ProfilesPageProps) {
  const {
    profile: drawerProfileId,
    tag: tagId,
    tab,
    owner: ownerUserId,
    status,
    company,
    sort: sortParam,
    order: orderParam,
    page: pageParam,
  } = await searchParams;

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const listLimit = page * PROFILES_PAGE_SIZE;
  const sort = parseProfileSort(sortParam);
  const order = parseSortOrder(orderParam);

  const defaultTab = parseProfileTabOrDefault(tab);

  if (tagId && !/^[0-9a-f-]{36}$/i.test(tagId)) {
    notFound();
  }

  if (ownerUserId && !/^[0-9a-f-]{36}$/i.test(ownerUserId)) {
    notFound();
  }

  if (status && !VALID_STATUSES.includes(status as RelationshipStatus)) {
    notFound();
  }

  const [{ profiles, total, hasMore }, orgTags, teamUsers, currentUser, companies] =
    await Promise.all([
      listProfiles({
        tagId,
        ownerUserId,
        status: status as RelationshipStatus | undefined,
        company: company?.trim() || undefined,
        sort,
        order,
        limit: listLimit,
        offset: 0,
      }),
      listOrgTags(),
      listOrgUsers(),
      requireUser(),
      listProfileCompanies(),
    ]);

  const hasActiveFilters = Boolean(tagId || ownerUserId || status || company);
  const closeHref = buildCloseHref({
    tag: tagId,
    owner: ownerUserId,
    status,
    company,
    sort: sortParam,
    order: orderParam,
  });

  let drawerContent = null;

  if (drawerProfileId) {
    if (!/^[0-9a-f-]{36}$/i.test(drawerProfileId)) {
      notFound();
    }

    const [profile, networkIntel] = await Promise.all([
      getProfileById(drawerProfileId),
      getProfileNetworkIntel(drawerProfileId),
    ]);

    drawerContent = (
      <ProfileDrawer
        profileId={profile.id}
        profileName={profile.fullName}
        closeHref={closeHref}
        canDelete={!profile.isInternalProfile}
      >
        <ProfileDetailView
          profile={profile}
          teamUsers={teamUsers}
          orgTags={orgTags}
          networkIntel={networkIntel}
          currentUserId={currentUser.id}
          defaultTab={defaultTab}
          mode="drawer"
        />
      </ProfileDrawer>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 bg-background">
        <PageHeader
          title="Profiles"
          description="Everyone the org knows — filterable table view of the relationship spine."
        >
          <Button asChild>
            <Link href="/profiles/new">New profile</Link>
          </Button>
        </PageHeader>
        <div className="shrink-0 space-y-3 border-b border-border px-8 pb-4">
          <ProfilesTagFilter
            tags={orgTags}
            activeTagId={tagId}
            activeOwnerId={ownerUserId}
            activeStatus={status}
            activeCompany={company}
            activeSort={sort}
            activeOrder={order}
          />
          <ProfilesListFilters
            teamUsers={teamUsers}
            companies={companies}
            activeTagId={tagId}
            activeOwnerId={ownerUserId}
            activeStatus={status}
            activeCompany={company}
            activeSort={sort}
            activeOrder={order}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-6 pt-4">
        <ListMeta className="mb-3">
          {formatCountLabel(profiles.length, "profile")}
          {total > profiles.length ? ` of ${total}` : ""}
          {hasActiveFilters ? " matching filters" : ""}
        </ListMeta>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/30" />}>
          <ProfilesTable
            profiles={profiles}
            sort={sort}
            order={order}
            hasActiveFilters={hasActiveFilters}
            canImportDatasets={currentUser.role === "admin"}
          />
        </Suspense>
        {hasMore ? (
          <div className="mt-4 flex justify-center">
            <Button asChild variant="outline">
              <Link
                href={buildListHref({
                  tag: tagId,
                  owner: ownerUserId,
                  status,
                  company,
                  sort: sortParam,
                  order: orderParam,
                  page: page + 1,
                })}
              >
                Load more
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
      {drawerContent}
    </div>
  );
}
