"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { OrgUser } from "@/lib/data/users";
import { TEAM_MEMBER_TITLES } from "@/config/team-members";

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
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-subheading font-medium text-foreground">
          Add team member
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          V1 provisions sign-in via Supabase Auth and{" "}
          <code className="text-caption">scripts/sync-pu-team.mjs</code>. Inline
          add/edit ships in a later pass.
        </p>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(
              "Team provisioning is script-driven in V1. Run sync-pu-team.mjs after adding someone in Supabase Auth.",
            );
          }}
        >
          <label className="space-y-1 text-body">
            <span className="text-caption text-muted-foreground">Name</span>
            <input
              disabled
              placeholder="Full name"
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-body">
            <span className="text-caption text-muted-foreground">Email</span>
            <input
              disabled
              placeholder="name@previously.co"
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-body">
            <span className="text-caption text-muted-foreground">Role</span>
            <input
              disabled
              placeholder="e.g. Partnerships"
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled
              className="rounded-md bg-muted px-4 py-2 text-body text-muted-foreground"
            >
              Add
            </button>
          </div>
        </form>
        {message ? (
          <p className="mt-3 text-body text-muted-foreground">{message}</p>
        ) : null}
      </section>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {users.map((user) => {
          const title =
            TEAM_MEMBER_TITLES[user.email.toLowerCase()] ??
            (user.role === "admin" ? "Admin" : "Member");

          return (
            <li
              key={user.id}
              className="flex items-center gap-4 px-4 py-4"
            >
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

      {users.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No team users found. Run{" "}
          <button
            type="button"
            className="underline"
            disabled={isPending}
            onClick={() => startTransition(() => router.refresh())}
          >
            refresh
          </button>{" "}
          after seeding or sync.
        </p>
      ) : null}
    </div>
  );
}
