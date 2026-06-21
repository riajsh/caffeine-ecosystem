"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { signOut } from "@/app/(auth)/login/actions";
import { MAIN_NAV } from "@/config/navigation";
import type { AppUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AppSidebarProps = {
  user: AppUser;
  profileId: string | null;
};

export function AppSidebar({ user, profileId }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const meHref = profileId ? `/profiles/${profileId}` : "/me";
  const drawerProfileId = searchParams.get("profile");
  const isMeActive =
    pathname === "/me" ||
    (profileId != null &&
      (pathname === `/profiles/${profileId}` ||
        pathname.startsWith(`/profiles/${profileId}/`) ||
        (pathname === "/profiles" && drawerProfileId === profileId)));

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="shrink-0 border-b border-sidebar-border px-4 py-4">
        <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
          Ecosystem
        </p>
        <Link
          href={meHref}
          className={cn(
            "mt-2 block rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent/70",
            isMeActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          <p className="text-subheading font-medium">{user.full_name}</p>
          <p className="text-caption text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-caption text-interactive-primary">
            {profileId ? "My profile →" : "My account →"}
          </p>
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {MAIN_NAV.filter(
          (item) => !item.adminOnly || user.role === "admin",
        ).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if (item.disabled) {
            return (
              <span
                key={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-body text-muted-foreground opacity-60"
                aria-disabled="true"
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                {item.phase ? (
                  <span className="ml-auto text-label">Phase {item.phase}</span>
                ) : null}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-body transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/70",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
        <Link
          href={meHref}
          className={cn(
            "flex items-center rounded-md px-3 py-2 text-body transition-colors",
            isMeActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/70",
          )}
        >
          {profileId ? "My profile" : "My account"}
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
