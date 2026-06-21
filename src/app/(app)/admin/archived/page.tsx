import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { formatInteractionDate } from "@/lib/format/date";
import { listArchivedProfiles } from "@/lib/data/archived-profiles";

export default async function AdminArchivedPage() {
  const profiles = await listArchivedProfiles();

  return (
    <>
      <PageHeader
        title="Archived Profiles"
        description={`${profiles.length} archived contact${profiles.length === 1 ? "" : "s"}`}
      />
      <div className="space-y-4 px-8 py-6">
        <p className="text-body text-muted-foreground">
          V1 uses relationship status Inactive as the archive equivalent. A
          dedicated archive flag is a schema discussion for Phase 2.
        </p>

        {profiles.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <p className="text-subheading font-medium text-foreground">
              No archived profiles
            </p>
            <p className="mt-2 text-body text-muted-foreground">
              Profiles marked Inactive on the relationship will appear here.
            </p>
          </div>
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
      </div>
    </>
  );
}
