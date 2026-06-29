"use client";

import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { OrgUser } from "@/lib/data/users";
import { TEAM_MEMBER_TITLES } from "@/config/team-members";
import { useAsyncAction } from "@/lib/use-async-action";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type TeamMembersListProps = {
  users: OrgUser[];
};

export function TeamMembersList({ users }: TeamMembersListProps) {
  const router = useRouter();
  const { isPending, run } = useAsyncAction();

  if (users.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        title="No team members yet"
        description="V1 provisions sign-in via Supabase Auth and npm run sync:team. Run the sync script after adding someone in Supabase Auth."
      >
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => void run(async () => router.refresh())}
        >
          Refresh
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
        <h2 className="text-subheading font-medium text-foreground">
          Adding team members
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          V1 provisions sign-in via Supabase Auth and{" "}
          <code className="text-caption">npm run sync:team</code>. Edit{" "}
          <code className="text-caption">src/config/team-members.json</code>{" "}
          then sync. Inline add/edit ships in a later pass.
        </p>
      </section>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {users.map((user) => {
          const title =
            TEAM_MEMBER_TITLES[user.email.toLowerCase()] ??
            (user.role === "admin" ? "Admin" : "Member");

          return (
            <li key={user.id} className="flex items-center gap-4 px-4 py-4">
              <div
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-body font-medium text-foreground"
              >
                {initials(user.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body font-medium text-foreground">
                  {user.fullName}
                </p>
                <p className="text-caption text-muted-foreground">
                  {title} · {user.email}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
