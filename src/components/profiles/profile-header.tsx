import { Badge } from "@/components/ui/badge";
import { formatProfileProvenance } from "@/lib/format/provenance";
import { formatEnumLabel } from "@/lib/format/enum";
import type { ProfileDetail } from "@/lib/data/profiles";

import { OwnerDot } from "./owner-dot";
import { StrengthBadge } from "./strength-badge";

type ProfileHeaderProps = {
  profile: ProfileDetail;
};

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const primaryOwner =
    profile.owners.find((owner) => owner.isPrimary) ?? profile.owners[0];

  return (
    <div className="space-y-6">
      {profile.isInternalProfile ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-body text-muted-foreground">
          Team member — calendar sync does not track internal meetings on
          this profile.
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display font-medium text-foreground">
              {profile.fullName}
            </h1>
            {profile.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>

          <div className="space-y-1 text-body text-muted-foreground">
            {profile.occupation ? <p>{profile.occupation}</p> : null}
            {profile.organisationName ? <p>{profile.organisationName}</p> : null}
            {profile.location ? <p>{profile.location}</p> : null}
          </div>

          {profile.bio ? (
            <p className="max-w-3xl text-body text-foreground">{profile.bio}</p>
          ) : null}

          <div className="flex flex-wrap gap-4 text-caption text-muted-foreground">
            {profile.email ? <span>{profile.email}</span> : null}
            {profile.phone ? <span>{profile.phone}</span> : null}
            {profile.linkedinUrl ? (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${profile.fullName} on LinkedIn`}
                className="text-interactive-primary hover:underline"
              >
                LinkedIn
              </a>
            ) : null}
            {profile.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${profile.fullName} website`}
                className="text-interactive-primary hover:underline"
              >
                Website
              </a>
            ) : null}
          </div>
        </div>

        <div className="min-w-64 space-y-3 rounded-lg border border-border bg-card p-4">
          {profile.relationship ? (
            <>
              <div className="space-y-1">
                <p className="text-label text-muted-foreground">Status</p>
                <p className="text-body font-medium text-foreground">
                  {formatEnumLabel(profile.relationship.status)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-label text-muted-foreground">Type</p>
                <p className="text-body font-medium text-foreground">
                  {formatEnumLabel(profile.relationship.relationshipType)}
                </p>
              </div>
            </>
          ) : null}

          {primaryOwner ? (
            <div className="space-y-1">
              <p className="text-label text-muted-foreground">Primary owner</p>
              <div className="flex items-center gap-2">
                <OwnerDot userId={primaryOwner.userId} />
                <span className="text-body font-medium text-foreground">
                  {primaryOwner.fullName}
                </span>
              </div>
              <StrengthBadge strength={primaryOwner.strength} />
            </div>
          ) : null}

          {profile.sources.length > 0 ? (
            <div className="space-y-1">
              <p className="text-label text-muted-foreground">Where this came from</p>
              <p className="text-caption text-muted-foreground">
                {formatProfileProvenance(profile.sources)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
