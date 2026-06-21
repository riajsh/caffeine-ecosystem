import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { EmptyState } from "@/components/ui/empty-state";
import { findDuplicateProfileGroups } from "@/lib/data/profile-dedup";

export default async function AdminDedupPage() {
  const { totalProfiles, groups } = await findDuplicateProfileGroups();
  const redundantProfiles = groups.reduce(
    (sum, group) => sum + (group.profiles.length - 1),
    0,
  );

  return (
    <AdminPage
      title="Duplicate Cleanup"
      description="Detect duplicate profiles across all imported datasets."
    >
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
        Org-wide merge and dismiss actions ship in a future release. Per-import
        dedup still runs during CSV upload.
      </p>

      {groups.length === 0 ? (
        <EmptyState
          title="No duplicate groups detected"
          description="Email and name+organisation matches will appear here."
        />
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li
              key={group.id}
              className="space-y-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="text-body font-medium text-foreground">
                  {group.profiles[0]?.fullName}
                </p>
                <p className="text-caption text-muted-foreground">
                  {group.profiles.length} duplicates · {group.reasonLabel}
                </p>
                {group.hasConflictingEmails ? (
                  <p className="mt-1 text-caption text-amber-700 dark:text-amber-400">
                    These profiles have different emails. Review carefully before
                    merging — org-wide merge is not available yet.
                  </p>
                ) : null}
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
    </AdminPage>
  );
}
