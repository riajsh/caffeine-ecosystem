"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  removeConnectionAction,
  searchProfilesForPickerAction,
} from "@/app/(app)/profiles/[id]/actions";
import { AddConnectionForm } from "@/components/profiles/add-connection-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEnumLabel } from "@/lib/format/enum";
import type { ProfileConnection } from "@/lib/data/profiles";
import type { OrgUser } from "@/lib/data/users";
import { cn } from "@/lib/utils";

type ProfileConnectionsSectionProps = {
  profileId: string;
  connections: ProfileConnection[];
  teamUsers: OrgUser[];
  currentUserId: string;
};

function isInferredConnection(source: string): boolean {
  return source.startsWith("inferred_");
}

export function ProfileConnectionsSection({
  profileId,
  connections,
  teamUsers,
  currentUserId,
}: ProfileConnectionsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const excludedProfileIds = [
    profileId,
    ...connections.map((connection) => connection.otherProfileId),
  ];

  return (
    <div className="space-y-6">
      <AddConnectionForm
        profileId={profileId}
        excludedProfileIds={excludedProfileIds}
        teamUsers={teamUsers}
        currentUserId={currentUserId}
        onSearch={searchProfilesForPickerAction}
      />

      {connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <p className="text-subheading font-medium text-foreground">
            No connections recorded
          </p>
          <p className="mt-2 text-body text-muted-foreground">
            Manual and inferred profile-to-person edges appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {connections.map((connection) => {
            const inferred = isInferredConnection(connection.source);
            const canRemove = connection.source === "manual";

            return (
              <li
                key={connection.id}
                className={cn(
                  "rounded-lg bg-card px-4 py-3",
                  inferred
                    ? "border-2 border-dashed border-border text-[var(--color-data-inferred)]"
                    : "border border-border text-foreground",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/profiles/${connection.otherProfileId}`}
                      className="text-body font-medium hover:underline"
                    >
                      {connection.otherFullName}
                    </Link>
                    <Badge variant="outline">
                      {formatEnumLabel(connection.connectionType)}
                    </Badge>
                    <Badge variant="secondary">
                      {formatEnumLabel(connection.strength)}
                    </Badge>
                    {inferred ? (
                      <Badge variant="secondary">Inferred</Badge>
                    ) : null}
                  </div>

                  {canRemove ? (
                    <form
                      action={(formData) => {
                        if (
                          !window.confirm(
                            `Remove connection to ${connection.otherFullName}?`,
                          )
                        ) {
                          return;
                        }

                        startTransition(async () => {
                          const result = await removeConnectionAction(formData);
                          if (result.error) {
                            window.alert(result.error);
                            return;
                          }
                          router.refresh();
                        });
                      }}
                    >
                      <input type="hidden" name="profileId" value={profileId} />
                      <input
                        type="hidden"
                        name="connectionId"
                        value={connection.id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </form>
                  ) : null}
                </div>
                {connection.notes ? (
                  <p className="mt-2 text-body text-muted-foreground">
                    {connection.notes}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
