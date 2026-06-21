"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInteractionDate } from "@/lib/format/date";
import { formatEnumLabel } from "@/lib/format/enum";
import type { ProfileListItem } from "@/lib/data/profiles";
import type { ProfileSortKey, SortOrder } from "@/lib/profiles/list-sort";
import { cn } from "@/lib/utils";

import { OwnerDot } from "./owner-dot";
import { StrengthBadge } from "./strength-badge";

type ProfilesTableProps = {
  profiles: ProfileListItem[];
  sort: ProfileSortKey;
  order: SortOrder;
  hasActiveFilters?: boolean;
  canImportDatasets?: boolean;
};

type SortableHeadProps = {
  label: string;
  sortKey: ProfileSortKey;
  currentSort: ProfileSortKey;
  currentOrder: SortOrder;
  searchParams: URLSearchParams;
};

function SortableTableHead({
  label,
  sortKey,
  currentSort,
  currentOrder,
  searchParams,
}: SortableHeadProps) {
  const isActive = currentSort === sortKey;
  const nextOrder = isActive && currentOrder === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(searchParams.toString());
  params.set("sort", sortKey);
  params.set("order", nextOrder);
  params.delete("page");

  const SortIcon = isActive
    ? currentOrder === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon
    : ChevronsUpDownIcon;

  return (
    <TableHead>
      <Link
        href={`/profiles?${params.toString()}`}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        <SortIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">
          {isActive
            ? `Sorted ${currentOrder === "asc" ? "ascending" : "descending"}`
            : "Sortable"}
        </span>
      </Link>
    </TableHead>
  );
}

export function ProfilesTable({
  profiles,
  sort,
  order,
  hasActiveFilters = false,
  canImportDatasets = false,
}: ProfilesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastOpenedProfileId = useRef<string | null>(null);
  const drawerProfileId = searchParams.get("profile");

  useEffect(() => {
    if (drawerProfileId || !lastOpenedProfileId.current) {
      return;
    }

    const row = document.querySelector<HTMLElement>(
      `[data-profile-row="${lastOpenedProfileId.current}"]`,
    );
    row?.focus();
    lastOpenedProfileId.current = null;
  }, [drawerProfileId]);

  if (profiles.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? "No profiles match these filters" : "No profiles yet"}
        description={
          hasActiveFilters
            ? "Try clearing filters or broadening your search."
            : "Import a CSV or add profiles manually to start building the graph."
        }
      >
        <div className="flex flex-wrap justify-center gap-3">
          {hasActiveFilters ? (
            <Button asChild variant="outline">
              <Link href="/profiles">Clear filters</Link>
            </Button>
          ) : null}
          {canImportDatasets ? (
            <Button asChild variant="outline">
              <Link href="/admin/datasets">Import dataset</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/profiles/new">New profile</Link>
          </Button>
        </div>
      </EmptyState>
    );
  }

  function openProfile(profileId: string) {
    lastOpenedProfileId.current = profileId;
    const params = new URLSearchParams(searchParams.toString());
    params.set("profile", profileId);
    router.push(`/profiles?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card [&_tr]:border-b [&_tr]:shadow-[inset_0_-1px_0_var(--color-border-default)]">
            <TableRow>
              <SortableTableHead
                label="Name"
                sortKey="name"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Company"
                sortKey="company"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Occupation"
                sortKey="occupation"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Location"
                sortKey="location"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Primary owner"
                sortKey="owner"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Status"
                sortKey="status"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Strength"
                sortKey="strength"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <SortableTableHead
                label="Last interaction"
                sortKey="last_interaction"
                currentSort={sort}
                currentOrder={order}
                searchParams={searchParams}
              />
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow
                key={profile.id}
                data-profile-row={profile.id}
                tabIndex={0}
                role="button"
                aria-label={`Open profile for ${profile.fullName}`}
                className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => openProfile(profile.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProfile(profile.id);
                  }
                }}
              >
                <TableCell className="font-medium text-foreground">
                  {profile.fullName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.organisationName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.occupation ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.location ?? "—"}
                </TableCell>
                <TableCell>
                  {profile.primaryOwner ? (
                    <span className="inline-flex items-center gap-2">
                      <OwnerDot userId={profile.primaryOwner.userId} />
                      <span>{profile.primaryOwner.fullName}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.relationshipStatus
                    ? formatEnumLabel(profile.relationshipStatus)
                    : "—"}
                </TableCell>
                <TableCell>
                  <StrengthBadge strength={profile.strength} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatInteractionDate(profile.lastInteractionAt)}
                </TableCell>
                <TableCell>
                  {profile.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {profile.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
