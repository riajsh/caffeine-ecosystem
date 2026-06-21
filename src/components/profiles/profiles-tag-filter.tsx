import {
  FilterChipLink,
  FilterChipRow,
} from "@/components/filters/filter-chips";
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
    <FilterChipRow label="Tags:">
      <FilterChipLink
        href={buildTagHref(undefined, filterOptions)}
        isActive={!activeTagId}
      >
        All
      </FilterChipLink>
      {tags.map((tag) => (
        <FilterChipLink
          key={tag.id}
          href={buildTagHref(tag.id, filterOptions)}
          isActive={activeTagId === tag.id}
        >
          {tag.name}
        </FilterChipLink>
      ))}
    </FilterChipRow>
  );
}
