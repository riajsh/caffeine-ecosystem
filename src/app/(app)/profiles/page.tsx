import { notFound } from "next/navigation";

import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { ProfileDetailView } from "@/components/profiles/profile-detail-view";
import { ProfileDrawer } from "@/components/profiles/profile-drawer";
import { ProfilesListFilters } from "@/components/profiles/profiles-list-filters";
import { ProfilesTable } from "@/components/profiles/profiles-table";
import { ProfilesTagFilter } from "@/components/profiles/profiles-tag-filter";
import { Button } from "@/components/ui/button";
import { getProfileNetworkIntel } from "@/lib/computed/profile-intelligence";
import { getProfileById, listProfiles } from "@/lib/data/profiles";
import { listOrgTags } from "@/lib/data/tags";
import { listOrgUsers } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/session";
import { parseProfileTab } from "@/lib/profiles/tab";
import type { Database } from "@/types/database";

type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];

const VALID_STATUSES: RelationshipStatus[] = [
  "prospect",
  "active",
  "partner",
  "advisor",
  "community",
  "dormant",
  "inactive",
];

type ProfilesPageProps = {
  searchParams: Promise<{
    profile?: string;
    tag?: string;
    tab?: string;
    owner?: string;
    status?: string;
    company?: string;
  }>;
};

export default async function ProfilesPage({ searchParams }: ProfilesPageProps) {
  const {
    profile: drawerProfileId,
    tag: tagId,
    tab,
    owner: ownerUserId,
    status,
    company,
  } = await searchParams;

  const defaultTab = parseProfileTab(tab);
  if (defaultTab === undefined && tab) {
    notFound();
  }

  if (tagId && !/^[0-9a-f-]{36}$/i.test(tagId)) {
    notFound();
  }

  if (ownerUserId && !/^[0-9a-f-]{36}$/i.test(ownerUserId)) {
    notFound();
  }

  if (status && !VALID_STATUSES.includes(status as RelationshipStatus)) {
    notFound();
  }

  const [profiles, orgTags, teamUsers] = await Promise.all([
    listProfiles({
      tagId,
      ownerUserId,
      status: status as RelationshipStatus | undefined,
      company: company?.trim() || undefined,
    }),
    listOrgTags(),
    listOrgUsers(),
  ]);

  let drawerContent = null;

  if (drawerProfileId) {
    if (!/^[0-9a-f-]{36}$/i.test(drawerProfileId)) {
      notFound();
    }

    const [profile, currentUser, networkIntel] = await Promise.all([
      getProfileById(drawerProfileId),
      requireUser(),
      getProfileNetworkIntel(drawerProfileId),
    ]);

    drawerContent = (
      <ProfileDrawer profileId={profile.id} closeHref="/profiles">
        <ProfileDetailView
          profile={profile}
          teamUsers={teamUsers}
          orgTags={orgTags}
          networkIntel={networkIntel}
          currentUserId={currentUser.id}
          defaultTab={defaultTab}
          mode="drawer"
        />
      </ProfileDrawer>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Profiles"
        description="Everyone the org knows — filterable table view of the relationship spine."
      >
        <Button asChild>
          <Link href="/profiles/new">New profile</Link>
        </Button>
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 pb-6 pt-6">
        <ProfilesTagFilter
          tags={orgTags}
          activeTagId={tagId}
          activeOwnerId={ownerUserId}
          activeStatus={status}
          activeCompany={company}
        />
        <ProfilesListFilters
          teamUsers={teamUsers}
          activeTagId={tagId}
          activeOwnerId={ownerUserId}
          activeStatus={status}
          activeCompany={company}
        />
        <ProfilesTable profiles={profiles} />
      </div>
      {drawerContent}
    </div>
  );
}
