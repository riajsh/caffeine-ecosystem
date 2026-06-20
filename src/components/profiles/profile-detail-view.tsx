import Link from "next/link";

import { EditProfileForm } from "@/components/profiles/edit-profile-form";
import { EditRelationshipForm } from "@/components/profiles/edit-relationship-form";
import { ProfileDetailTabs } from "@/components/profiles/profile-detail-tabs";
import { ProfileHeader } from "@/components/profiles/profile-header";
import { ProfileNetworkIntelligence } from "@/components/profiles/profile-network-intelligence";
import { ProfileOwnersSection } from "@/components/profiles/profile-owners-section";
import type { ProfileNetworkIntel } from "@/lib/computed/profile-intelligence";
import { ProfileTagsSection } from "@/components/profiles/profile-tags-section";
import type { ProfileDetail } from "@/lib/data/profiles";
import type { OrgTag } from "@/lib/data/tags";
import type { OrgUser } from "@/lib/data/users";

type ProfileDetailViewProps = {
  profile: ProfileDetail;
  teamUsers: OrgUser[];
  orgTags: OrgTag[];
  networkIntel: ProfileNetworkIntel;
  currentUserId: string;
  defaultTab?: "activity" | "connections" | "events" | "notes";
  mode?: "page" | "drawer";
};

export function ProfileDetailView({
  profile,
  teamUsers,
  orgTags,
  networkIntel,
  currentUserId,
  defaultTab,
  mode = "page",
}: ProfileDetailViewProps) {
  return (
    <div className={mode === "drawer" ? "space-y-8" : "space-y-8 px-8 py-6"}>
      <ProfileHeader profile={profile} mode={mode} />

      <ProfileNetworkIntelligence profileId={profile.id} intel={networkIntel} />

      <section className="space-y-3">
        <h2 className="text-heading font-medium text-foreground">Details</h2>
        <EditProfileForm profile={profile} />
      </section>

      <section className="space-y-3">
        <h2 className="text-heading font-medium text-foreground">Relationship</h2>
        <EditRelationshipForm profile={profile} />
      </section>

      <section className="space-y-3">
        <h2 className="text-heading font-medium text-foreground">Owners</h2>
        <ProfileOwnersSection
          profileId={profile.id}
          owners={profile.owners}
          teamUsers={teamUsers}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-heading font-medium text-foreground">Tags</h2>
        <ProfileTagsSection
          profileId={profile.id}
          tags={profile.tags}
          orgTags={orgTags}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-heading font-medium text-foreground">Timeline</h2>
        <ProfileDetailTabs
          profile={profile}
          teamUsers={teamUsers}
          currentUserId={currentUserId}
          defaultTab={defaultTab}
        />
      </section>

      {mode === "drawer" ? (
        <div className="border-t border-border pt-4">
          <Link
            href={`/profiles/${profile.id}`}
            className="text-body text-interactive-primary hover:underline"
          >
            View full profile page →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
