import { Badge } from "@/components/ui/badge";
import type { ProfileListItem } from "@/lib/data/profiles";

type LastMeetingCellProps = {
  profile: Pick<ProfileListItem, "lastCalendarMeeting">;
};

export function LastMeetingCell({ profile }: LastMeetingCellProps) {
  const meeting = profile.lastCalendarMeeting;

  if (!meeting?.title) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Badge
      variant="outline"
      className="max-w-[16rem] truncate font-normal"
      title={meeting.title}
    >
      {meeting.title}
    </Badge>
  );
}
