"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV } from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-1 border-b border-border px-8 pb-4"
    >
      {ADMIN_NAV.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)) ||
          (item.href === "/admin/datasets" &&
            pathname.startsWith("/admin/import")) ||
          (item.href === "/admin/calendar-sync/review" &&
            pathname.startsWith("/admin/calendar-sync"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-body transition-colors",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.label}
            {item.phase ? (
              <span className="ml-1.5 text-caption text-muted-foreground">
                (Phase {item.phase})
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
