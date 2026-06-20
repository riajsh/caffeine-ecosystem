"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ProfileDrawerProps = {
  profileId: string;
  closeHref: string;
  children: React.ReactNode;
};

export function ProfileDrawer({
  profileId,
  closeHref,
  children,
}: ProfileDrawerProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.push(closeHref);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link
        href={closeHref}
        className="absolute inset-0 bg-black/40"
        aria-label="Close profile"
      />

      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => router.push(closeHref)}>
            Close
          </Button>
          <Link
            href={`/profiles/${profileId}`}
            className="text-caption text-interactive-primary hover:underline"
          >
            Open full page
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}
