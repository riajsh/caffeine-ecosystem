"use client";

import { useTransition } from "react";

import { disconnectCalendarAccountAction } from "@/app/(app)/admin/integrations/actions";
import { Button } from "@/components/ui/button";

type CalendarAccountRowProps = {
  accountId: string;
  email: string;
  userName: string | null;
  syncStatus: string;
  syncEnabled: boolean;
  isCurrentUser: boolean;
};

export function CalendarAccountRow({
  accountId,
  email,
  userName,
  syncStatus,
  syncEnabled,
  isCurrentUser,
}: CalendarAccountRowProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-body font-medium text-foreground">{email}</p>
        <p className="text-caption text-muted-foreground">
          {userName ? `Connected by ${userName}` : "Unknown user"} · {syncStatus}
          {!syncEnabled ? " · disconnected" : ""}
        </p>
      </div>
      {isCurrentUser && syncEnabled ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await disconnectCalendarAccountAction(accountId);
            });
          }}
        >
          {isPending ? "Disconnecting…" : "Disconnect"}
        </Button>
      ) : null}
    </div>
  );
}
