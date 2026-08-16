import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ProfileNetworkIntel } from "@/lib/computed/profile-intelligence";

type ProfileNetworkIntelligenceProps = {
  profileId: string;
  intel: ProfileNetworkIntel;
};

export function ProfileNetworkIntelligence({
  profileId,
  intel,
}: ProfileNetworkIntelligenceProps) {
  const items = [
    {
      label: "Connections",
      value: String(intel.connectionCount),
      href: `/profiles/${profileId}?tab=connections`,
    },
    {
      label: "Events attended",
      value: String(intel.eventsAttended),
      href: `/profiles/${profileId}?tab=events`,
    },
    {
      label: intel.sameCompanyName
        ? `Also at ${intel.sameCompanyName}`
        : "Same company",
      value: String(intel.sameCompanyCount),
      href: intel.sameCompanyName
        ? `/profiles?company=${encodeURIComponent(intel.sameCompanyName)}`
        : undefined,
    },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-subheading font-medium text-foreground">
          Network intelligence
        </p>
        <Badge variant="secondary">Automatic</Badge>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className="rounded-md border border-border px-3 py-2">
            <p className="text-caption text-muted-foreground">{item.label}</p>
            {item.href ? (
              <Link
                href={item.href}
                className="text-heading font-medium text-foreground hover:underline"
              >
                {item.value}
              </Link>
            ) : (
              <p className="text-heading font-medium text-foreground">
                {item.value}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
