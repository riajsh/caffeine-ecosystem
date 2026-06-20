import { formatInteractionDate } from "@/lib/format/date";
import type { ProfileOwner } from "@/lib/data/profiles";

import { OwnerDot } from "./owner-dot";
import { StrengthBadge } from "./strength-badge";

type ProfileOwnersListProps = {
  owners: ProfileOwner[];
};

export function ProfileOwnersList({ owners }: ProfileOwnersListProps) {
  if (owners.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        No relationship owners assigned yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {owners.map((owner) => (
        <li
          key={owner.userId}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2">
            <OwnerDot userId={owner.userId} />
            <div>
              <p className="text-body font-medium text-foreground">
                {owner.fullName}
                {owner.isPrimary ? (
                  <span className="ml-2 text-caption font-normal text-muted-foreground">
                    Primary
                  </span>
                ) : null}
              </p>
              {owner.notes ? (
                <p className="text-caption text-muted-foreground">
                  {owner.notes}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StrengthBadge strength={owner.strength} />
            <span className="text-caption text-muted-foreground">
              Last: {formatInteractionDate(owner.lastInteractionAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
