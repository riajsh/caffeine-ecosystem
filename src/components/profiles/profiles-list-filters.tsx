import Link from "next/link";

import {
  FilterChipLink,
  FilterChipRow,
} from "@/components/filters/filter-chips";
import { Badge } from "@/components/ui/badge";
import type { OrgUser } from "@/lib/data/users";
import { formatEnumLabel } from "@/lib/format/enum";
import type { Database } from "@/types/database";

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
  activeTagId?: string;
  activeOwnerId?: string;
  activeStatus?: string;
  activeCompany?: string;
};

function buildProfilesHref(options: {
  tag?: string;
  owner?: string;
  status?: string;
  company?: string;
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
  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

export function ProfilesListFilters({
  teamUsers,
  activeTagId,
  activeOwnerId,
  activeStatus,
  activeCompany,
}: ProfilesListFiltersProps) {
  const hasFilters = activeOwnerId || activeStatus || activeCompany;

  return (
    <div className="space-y-3">
      {activeCompany ? (
        <FilterChipRow label="Company:">
          <Badge variant="default">{activeCompany}</Badge>
          <FilterChipLink
            href={buildProfilesHref({
              tag: activeTagId,
              owner: activeOwnerId,
              status: activeStatus,
            })}
            isActive={false}
          >
            Clear company
          </FilterChipLink>
        </FilterChipRow>
      ) : null}

      <FilterChipRow label="Owner:">
        <FilterChipLink
          href={buildProfilesHref({
            tag: activeTagId,
            status: activeStatus,
            company: activeCompany,
          })}
          isActive={!activeOwnerId}
        >
          All
        </FilterChipLink>
        {teamUsers.map((user) => (
          <FilterChipLink
            key={user.id}
            href={buildProfilesHref({
              tag: activeTagId,
              owner: user.id,
              status: activeStatus,
              company: activeCompany,
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
            tag: activeTagId,
            owner: activeOwnerId,
            company: activeCompany,
          })}
          isActive={!activeStatus}
        >
          All
        </FilterChipLink>
        {STATUS_OPTIONS.map((status) => (
          <FilterChipLink
            key={status}
            href={buildProfilesHref({
              tag: activeTagId,
              owner: activeOwnerId,
              status,
              company: activeCompany,
            })}
            isActive={activeStatus === status}
          >
            {formatEnumLabel(status)}
          </FilterChipLink>
        ))}
      </FilterChipRow>

      {hasFilters ? (
        <Link
          href={activeTagId ? `/profiles?tag=${activeTagId}` : "/profiles"}
          className="text-caption text-interactive-primary hover:underline"
        >
          Clear all filters
        </Link>
      ) : null}
    </div>
  );
}
