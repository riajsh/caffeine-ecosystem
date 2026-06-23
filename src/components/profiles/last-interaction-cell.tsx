import { Badge } from "@/components/ui/badge";
import { formatInteractionDate } from "@/lib/format/date";
import type { ProfileListItem } from "@/lib/data/profiles";

type LastInteractionCellProps = {
  profile: Pick<
    ProfileListItem,
    "lastInteractionAt" | "lastCalendarMeeting"
  >;
};

export function LastInteractionCell({ profile }: LastInteractionCellProps) {
  const { lastCalendarMeeting, lastInteractionAt } = profile;
  const displayDate =
    lastCalendarMeeting?.activityDate ?? lastInteractionAt ?? null;

  if (!displayDate && !lastCalendarMeeting) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex max-w-[16rem] flex-col items-start gap-1.5">
      {lastCalendarMeeting ? (
        <Badge
          variant="outline"
          className="max-w-full truncate font-normal"
          title={lastCalendarMeeting.title}
        >
          {lastCalendarMeeting.title}
        </Badge>
      ) : null}
      {displayDate ? (
        <span className="text-caption text-muted-foreground">
          {formatInteractionDate(displayDate)}
        </span>
      ) : null}
    </div>
  );
}
