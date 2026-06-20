"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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

import { OwnerDot } from "./owner-dot";
import { StrengthBadge } from "./strength-badge";

type ProfilesTableProps = {
  profiles: ProfileListItem[];
};

export function ProfilesTable({ profiles }: ProfilesTableProps) {
  const router = useRouter();

  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
        <p className="text-subheading font-medium text-foreground">
          No profiles yet
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Import a CSV or add profiles manually to start building the graph.
        </p>
      </div>
    );
  }

  function openProfile(profileId: string) {
    router.push(`/profiles?profile=${profileId}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card [&_tr]:border-b [&_tr]:shadow-[inset_0_-1px_0_var(--color-border-default)]">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Occupation</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Primary owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead>Last interaction</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow
                key={profile.id}
                tabIndex={0}
                role="link"
                aria-label={`Open profile for ${profile.fullName}`}
                className="cursor-pointer hover:bg-muted/50"
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
