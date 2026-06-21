import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { findDuplicateProfileGroups } from "@/lib/data/profile-dedup";

export default async function AdminDedupPage() {
  const { totalProfiles, groups } = await findDuplicateProfileGroups();
  const redundantProfiles = groups.reduce(
    (sum, group) => sum + (group.profiles.length - 1),
    0,
  );

  return (
    <>
      <PageHeader
        title="Duplicate Cleanup"
        description="Detect duplicate profiles across all imported datasets."
      />
      <div className="space-y-6 px-8 py-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Total profiles</dt>
            <dd className="text-subheading font-medium">{totalProfiles}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Duplicate groups</dt>
            <dd className="text-subheading font-medium">{groups.length}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Redundant profiles</dt>
            <dd className="text-subheading font-medium">{redundantProfiles}</dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-caption text-muted-foreground">Merged so far</dt>
            <dd className="text-subheading font-medium">0</dd>
          </div>
        </dl>

        <p className="text-body text-muted-foreground">
          Merge and dismiss actions from the Loveable build are not wired yet.
          Per-import dedup still runs during CSV upload.
        </p>

        {groups.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <p className="text-subheading font-medium text-foreground">
              No duplicate groups detected
            </p>
            <p className="mt-2 text-body text-muted-foreground">
              Email and name+organisation matches will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {groups.map((group) => (
              <li
                key={group.id}
                className="space-y-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body font-medium text-foreground">
                      {group.profiles[0]?.fullName}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {group.profiles.length} duplicates · {group.reasonLabel}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled>
                      Merge
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled>
                      Dismiss
                    </Button>
                  </div>
                </div>
                <ul className="space-y-1 text-body text-muted-foreground">
                  {group.profiles.map((profile) => (
                    <li key={profile.id}>
                      <Link
                        href={`/profiles?profile=${profile.id}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {profile.fullName}
                        {profile.email ? ` · ${profile.email}` : ""}
                        {profile.organisationName
                          ? ` · ${profile.organisationName}`
                          : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
