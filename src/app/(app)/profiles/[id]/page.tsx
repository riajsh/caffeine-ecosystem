import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { ProfileDetailView } from "@/components/profiles/profile-detail-view";
import { getProfileById } from "@/lib/data/profiles";
import { getProfileNetworkIntel } from "@/lib/computed/profile-intelligence";
import { listOrgTags } from "@/lib/data/tags";
import { listOrgUsers } from "@/lib/data/users";
import { requireUser } from "@/lib/auth/session";
import { parseProfileTab } from "@/lib/profiles/tab";

type ProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const defaultTab = parseProfileTab(tab);

  if (defaultTab === undefined && tab) {
    notFound();
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const [profile, teamUsers, orgTags, currentUser, networkIntel] =
    await Promise.all([
      getProfileById(id),
      listOrgUsers(),
      listOrgTags(),
      requireUser(),
      getProfileNetworkIntel(id),
    ]);

  return (
    <>
      <PageHeader title="Profile" />
      <ProfileDetailView
        profile={profile}
        teamUsers={teamUsers}
        orgTags={orgTags}
        networkIntel={networkIntel}
        currentUserId={currentUser.id}
        defaultTab={defaultTab}
        mode="page"
      />
    </>
  );
}
