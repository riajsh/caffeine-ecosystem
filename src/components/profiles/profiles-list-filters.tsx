import Link from "next/link";
import { Suspense } from "react";

import {
  FilterChipLink,
  FilterChipRow,
} from "@/components/filters/filter-chips";
import { ProfilesCompanyFilter } from "@/components/profiles/profiles-company-filter";
import type { OrgUser } from "@/lib/data/users";
import { formatEnumLabel } from "@/lib/format/enum";
import type { Database } from "@/types/database";
import type { ProfileSortKey, SortOrder } from "@/lib/profiles/list-sort";

type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];

const STATUS_OPTIONS: RelationshipStatus[] = [
  "prospect",
  "active",
  "partner",
  "advisor",
  "community",
  "dormant",
  "inactive",
];

type ProfilesListFiltersProps = {
  teamUsers: OrgUser[];
  companies: string[];
  activeTagId?: string;
  activeOwnerId?: string;
  activeStatus?: string;
  activeCompany?: string;
  activeSort?: ProfileSortKey;
  activeOrder?: SortOrder;
};

function buildProfilesHref(options: {
  tag?: string;
  owner?: string;
  status?: string;
  company?: string;
  sort?: ProfileSortKey;
  order?: SortOrder;
}) {
  const params = new URLSearchParams();
  if (options.tag) {
    params.set("tag", options.tag);
  }
  if (options.owner) {
    params.set("owner", options.owner);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.company) {
    params.set("company", options.company);
  }
  if (options.sort && options.sort !== "name") {
    params.set("sort", options.sort);
  }
  if (options.order && options.order !== "asc") {
    params.set("order", options.order);
  }
  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

export function ProfilesListFilters({
  teamUsers,
  companies,
  activeTagId,
  activeOwnerId,
  activeStatus,
  activeCompany,
  activeSort = "name",
  activeOrder = "asc",
}: ProfilesListFiltersProps) {
  const preserved = {
    tag: activeTagId,
    company: activeCompany,
    sort: activeSort,
    order: activeOrder,
  };
  const hasFilters = activeOwnerId || activeStatus || activeCompany;

  return (
    <div className="space-y-3">
      <Suspense
        fallback={
          <div className="flex items-center gap-2">
            <span className="text-caption text-muted-foreground">Company:</span>
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted/40" />
          </div>
        }
      >
        <ProfilesCompanyFilter companies={companies} activeCompany={activeCompany} />
      </Suspense>

      <FilterChipRow label="Owner:">
        <FilterChipLink
          href={buildProfilesHref({
            ...preserved,
            status: activeStatus,
          })}
          isActive={!activeOwnerId}
        >
          All
        </FilterChipLink>
        {teamUsers.map((user) => (
          <FilterChipLink
            key={user.id}
            href={buildProfilesHref({
              ...preserved,
              owner: user.id,
              status: activeStatus,
            })}
            isActive={activeOwnerId === user.id}
          >
            {user.fullName}
          </FilterChipLink>
        ))}
      </FilterChipRow>

      <FilterChipRow label="Status:">
        <FilterChipLink
          href={buildProfilesHref({
            ...preserved,
            owner: activeOwnerId,
          })}
          isActive={!activeStatus}
        >
          All
        </FilterChipLink>
        {STATUS_OPTIONS.map((status) => (
          <FilterChipLink
            key={status}
            href={buildProfilesHref({
              ...preserved,
              owner: activeOwnerId,
              status,
            })}
            isActive={activeStatus === status}
          >
            {formatEnumLabel(status)}
          </FilterChipLink>
        ))}
      </FilterChipRow>

      {hasFilters ? (
        <Link
          href={
            activeTagId
              ? buildProfilesHref({ tag: activeTagId, sort: activeSort, order: activeOrder })
              : buildProfilesHref({ sort: activeSort, order: activeOrder })
          }
          className="text-caption text-interactive-primary hover:underline"
        >
          Clear all filters
        </Link>
      ) : null}
    </div>
  );
}
