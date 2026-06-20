"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MAIN_NAV } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/auth/session";

import { signOut } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

type AppSidebarProps = {
  user: AppUser;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-5">
        <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
          Ecosystem
        </p>
        <p className="mt-1 text-subheading font-medium">{user.full_name}</p>
        <p className="text-caption text-muted-foreground">{user.email}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
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

      <div className="border-t border-sidebar-border p-3">
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
