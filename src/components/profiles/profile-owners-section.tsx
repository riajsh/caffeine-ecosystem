import { AssignOwnerForm } from "@/components/profiles/assign-owner-form";
import { ProfileOwnerRow } from "@/components/profiles/profile-owner-row";
import type { ProfileOwner } from "@/lib/data/profiles";
import type { OrgUser } from "@/lib/data/users";

type ProfileOwnersSectionProps = {
  profileId: string;
  owners: ProfileOwner[];
  teamUsers: OrgUser[];
};

export function ProfileOwnersSection({
  profileId,
  owners,
  teamUsers,
}: ProfileOwnersSectionProps) {
  const assignedUserIds = owners.map((owner) => owner.userId);

  return (
    <div className="space-y-6">
      {owners.length > 0 ? (
        <div className="space-y-4">
          {owners.map((owner) => (
            <ProfileOwnerRow key={owner.id} profileId={profileId} owner={owner} />
          ))}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          No relationship owners assigned yet.
        </p>
      )}

      <AssignOwnerForm
        profileId={profileId}
        teamUsers={teamUsers}
        assignedUserIds={assignedUserIds}
      />
    </div>
  );
}
