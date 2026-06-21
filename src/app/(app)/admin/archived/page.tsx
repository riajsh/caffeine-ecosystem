import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { EmptyState } from "@/components/ui/empty-state";
import { formatInteractionDate } from "@/lib/format/date";
import { listArchivedProfiles } from "@/lib/data/archived-profiles";

export default async function AdminArchivedPage() {
  const profiles = await listArchivedProfiles();

  return (
    <AdminPage
      title="Archived Profiles"
      description={`${profiles.length} archived contact${profiles.length === 1 ? "" : "s"}`}
    >
      <p className="text-body text-muted-foreground">
        V1 uses relationship status Inactive as the archive equivalent. A
        dedicated archive flag is a schema discussion for Phase 2.
      </p>

      {profiles.length === 0 ? (
        <EmptyState
          title="No archived profiles"
          description="Profiles marked Inactive on the relationship will appear here."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/profiles?profile=${profile.id}`}
                  className="text-body font-medium text-foreground hover:underline"
                >
                  {profile.fullName}
                </Link>
                <p className="text-caption text-muted-foreground">
                  {profile.email ?? "No email"}
                  {profile.organisationName
                    ? ` · ${profile.organisationName}`
                    : ""}
                </p>
              </div>
              {profile.archivedAt ? (
                <time className="text-caption text-muted-foreground">
                  {formatInteractionDate(profile.archivedAt)}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
