import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatInteractionDate } from "@/lib/format/date";
import { formatEnumLabel } from "@/lib/format/enum";
import type { ReconnectSuggestion } from "@/lib/computed/connect";

type ReconnectPromptsCardProps = {
  suggestions: ReconnectSuggestion[];
};

export function ReconnectPromptsCard({ suggestions }: ReconnectPromptsCardProps) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-6">
        <p className="text-subheading font-medium text-foreground">
          Reconnect prompts
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Strong relationships going quiet will surface here once activity ages
          past six months.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-subheading font-medium text-foreground">
          Reconnect prompts
        </p>
        <Link href="/connect" className="text-caption text-interactive-primary hover:underline">
          View Connect
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {suggestions.map((item) => (
          <li key={item.profileId} className="rounded-md px-1 py-1">
            <Link
              href={`/profiles/${item.profileId}`}
              className="block transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body font-medium text-foreground">
                  {item.fullName}
                </span>
                <Badge variant="outline">
                  {formatEnumLabel(item.ownerStrength)}
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                {item.primaryOwnerName ? `${item.primaryOwnerName} · ` : ""}
                Last: {formatInteractionDate(item.lastInteractionAt)} (
                {item.monthsSinceInteraction} mo)
              </p>
            </Link>
            <Link
              href={`/profiles/${item.profileId}?tab=activity`}
              className="mt-1 inline-block text-caption text-interactive-primary hover:underline"
            >
              Log reconnect
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
