import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatInteractionDate } from "@/lib/format/date";
import { formatEnumLabel } from "@/lib/format/enum";
import type { RecentActivityItem } from "@/lib/data/activities";

type RecentActivityCardProps = {
  activities: RecentActivityItem[];
};

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-6">
        <p className="text-subheading font-medium text-foreground">
          Recent activity
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Log notes and meetings on profiles, or add event attendance — activity
          will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card px-5 py-6">
      <p className="text-subheading font-medium text-foreground">
        Recent activity
      </p>
      <ul className="mt-4 space-y-3">
        {activities.map((activity) => (
          <li key={activity.id}>
            <Link
              href={`/profiles/${activity.profileId}`}
              className="block rounded-md px-1 py-1 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body font-medium text-foreground">
                  {activity.profileName}
                </span>
                <Badge variant="outline">
                  {formatEnumLabel(activity.activityType)}
                </Badge>
                <span className="text-caption text-muted-foreground">
                  {formatInteractionDate(activity.activityDate)}
                </span>
              </div>
              <p className="text-body text-muted-foreground">{activity.title}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
