import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { OrgTag } from "@/lib/data/tags";

type ProfilesTagFilterProps = {
  tags: OrgTag[];
  activeTagId?: string;
  activeOwnerId?: string;
  activeStatus?: string;
  activeCompany?: string;
};

function buildTagHref(
  tagId: string | undefined,
  options?: {
    owner?: string;
    status?: string;
    company?: string;
  },
) {
  const params = new URLSearchParams();
  if (tagId) {
    params.set("tag", tagId);
  }
  if (options?.owner) {
    params.set("owner", options.owner);
  }
  if (options?.status) {
    params.set("status", options.status);
  }
  if (options?.company) {
    params.set("company", options.company);
  }
  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

export function ProfilesTagFilter({
  tags,
  activeTagId,
  activeOwnerId,
  activeStatus,
  activeCompany,
}: ProfilesTagFilterProps) {
  const filterOptions = {
    owner: activeOwnerId,
    status: activeStatus,
    company: activeCompany,
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-muted-foreground">Filter:</span>
      <Link href={buildTagHref(undefined, filterOptions)}>
        <Badge variant={activeTagId ? "secondary" : "default"}>All</Badge>
      </Link>
      {tags.map((tag) => (
        <Link key={tag.id} href={buildTagHref(tag.id, filterOptions)}>
          <Badge variant={activeTagId === tag.id ? "default" : "secondary"}>
            {tag.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
