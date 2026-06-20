import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buildSearchTagHref } from "@/components/search/search-filters";
import type { OrgTag } from "@/lib/data/tags";

type SearchTagFilterProps = {
  tags: OrgTag[];
  query: string;
  activeTagId?: string;
  activeOwnerId?: string;
  activeStatus?: string;
};

export function SearchTagFilter({
  tags,
  query,
  activeTagId,
  activeOwnerId,
  activeStatus,
}: SearchTagFilterProps) {
  const filterOptions = {
    q: query || undefined,
    owner: activeOwnerId,
    status: activeStatus,
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-muted-foreground">Tag:</span>
      <Link href={buildSearchTagHref(undefined, filterOptions)}>
        <Badge variant={activeTagId ? "secondary" : "default"}>All</Badge>
      </Link>
      {tags.map((tag) => (
        <Link key={tag.id} href={buildSearchTagHref(tag.id, filterOptions)}>
          <Badge variant={activeTagId === tag.id ? "default" : "secondary"}>
            {tag.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
