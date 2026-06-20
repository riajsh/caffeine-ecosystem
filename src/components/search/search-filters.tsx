import Link from "next/link";

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

type SearchFiltersProps = {
  query: string;
  teamUsers: OrgUser[];
  activeTagId?: string;
  activeOwnerId?: string;
  activeStatus?: string;
};

function buildSearchHref(options: {
  q?: string;
  tag?: string;
  owner?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (options.tag) {
    params.set("tag", options.tag);
  }
  if (options.owner) {
    params.set("owner", options.owner);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export function SearchFilters({
  query,
  teamUsers,
  activeTagId,
  activeOwnerId,
  activeStatus,
}: SearchFiltersProps) {
  const hasFilters = activeOwnerId || activeStatus || activeTagId;
  const filterBase = { q: query || undefined };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted-foreground">Owner:</span>
        <Link href={buildSearchHref({ ...filterBase, tag: activeTagId, status: activeStatus })}>
          <Badge variant={activeOwnerId ? "secondary" : "default"}>All</Badge>
        </Link>
        {teamUsers.map((user) => (
          <Link
            key={user.id}
            href={buildSearchHref({
              ...filterBase,
              tag: activeTagId,
              owner: user.id,
              status: activeStatus,
            })}
          >
            <Badge variant={activeOwnerId === user.id ? "default" : "secondary"}>
              {user.fullName}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted-foreground">Status:</span>
        <Link href={buildSearchHref({ ...filterBase, tag: activeTagId, owner: activeOwnerId })}>
          <Badge variant={activeStatus ? "secondary" : "default"}>All</Badge>
        </Link>
        {STATUS_OPTIONS.map((status) => (
          <Link
            key={status}
            href={buildSearchHref({
              ...filterBase,
              tag: activeTagId,
              owner: activeOwnerId,
              status,
            })}
          >
            <Badge variant={activeStatus === status ? "default" : "secondary"}>
              {formatEnumLabel(status)}
            </Badge>
          </Link>
        ))}
      </div>

      {hasFilters ? (
        <Link
          href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
          className="text-caption text-interactive-primary hover:underline"
        >
          Clear profile filters
        </Link>
      ) : null}

      <p className="text-caption text-muted-foreground">
        Filters apply to profile and activity results. Events and email matches
        are not owner-scoped.
      </p>
    </div>
  );
}

export function buildSearchTagHref(
  tagId: string | undefined,
  options: { q?: string; owner?: string; status?: string },
) {
  return buildSearchHref({
    q: options.q,
    tag: tagId,
    owner: options.owner,
    status: options.status,
  });
}
