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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted-foreground">Company:</span>
          <Badge variant="default">{activeCompany}</Badge>
          <Link
            href={buildProfilesHref({
              tag: activeTagId,
              owner: activeOwnerId,
              status: activeStatus,
            })}
          >
            <Badge variant="secondary">Clear company</Badge>
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted-foreground">Owner:</span>
        <Link
          href={buildProfilesHref({
            tag: activeTagId,
            status: activeStatus,
            company: activeCompany,
          })}
        >
          <Badge variant={activeOwnerId ? "secondary" : "default"}>All</Badge>
        </Link>
        {teamUsers.map((user) => (
          <Link
            key={user.id}
            href={buildProfilesHref({
              tag: activeTagId,
              owner: user.id,
              status: activeStatus,
              company: activeCompany,
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
        <Link
          href={buildProfilesHref({
            tag: activeTagId,
            owner: activeOwnerId,
            company: activeCompany,
          })}
        >
          <Badge variant={activeStatus ? "secondary" : "default"}>All</Badge>
        </Link>
        {STATUS_OPTIONS.map((status) => (
          <Link
            key={status}
            href={buildProfilesHref({
              tag: activeTagId,
              owner: activeOwnerId,
              status,
              company: activeCompany,
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
          href={activeTagId ? `/profiles?tag=${activeTagId}` : "/profiles"}
          className="text-caption text-interactive-primary hover:underline"
        >
          Clear all filters
        </Link>
      ) : null}
    </div>
  );
}
