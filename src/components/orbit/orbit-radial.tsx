"use client";

import Link from "next/link";

import type { OrbitRing } from "@/config/relationship-thresholds";
import { ownerColour } from "@/config/owner-colours";
import { TEAM_MEMBERS } from "@/config/team-members";
import type { OrbitNode } from "@/lib/computed/orbit";

const RING_ORDER: OrbitRing[] = [
  "inner_circle",
  "active_network",
  "extended",
  "dormant",
];

const RING_RADIUS_PERCENT = [18, 32, 46, 60];

const MAX_NODES_PER_RING = 16;

type OrbitRadialProps = {
  nodes: Record<OrbitRing, OrbitNode[]>;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function OrbitRadial({ nodes }: OrbitRadialProps) {
  const totalVisible = RING_ORDER.reduce(
    (sum, ring) => sum + Math.min(nodes[ring].length, MAX_NODES_PER_RING),
    0,
  );

  if (totalVisible === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <p className="text-body text-muted-foreground">
          No profiles to display for the current owner filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative mx-auto aspect-square w-full max-w-2xl">
        {RING_RADIUS_PERCENT.map((radius) => (
          <div
            key={radius}
            className="absolute rounded-full border border-dashed border-border"
            style={{
              width: `${radius * 2}%`,
              height: `${radius * 2}%`,
              left: `${50 - radius}%`,
              top: `${50 - radius}%`,
            }}
          />
        ))}

        <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />

        {RING_ORDER.map((ring, ringIndex) => {
          const ringNodes = nodes[ring].slice(0, MAX_NODES_PER_RING);

          return ringNodes.map((node, index) => {
            const angle =
              (2 * Math.PI * index) / Math.max(ringNodes.length, 1) -
              Math.PI / 2;
            const radius = RING_RADIUS_PERCENT[ringIndex];
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);

            return (
              <Link
                key={node.profileId}
                href={`/profiles/${node.profileId}`}
                title={node.fullName}
                className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-card text-caption font-medium text-foreground shadow-sm transition-transform hover:scale-110"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  borderColor: node.primaryOwnerUserId
                    ? ownerColour(node.primaryOwnerUserId)
                    : "var(--color-border-default)",
                }}
              >
                {initials(node.fullName)}
              </Link>
            );
          });
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-caption text-muted-foreground">
        {RING_ORDER.map((ring) => {
          const count = nodes[ring].length;
          if (count === 0) {
            return null;
          }

          const overflow = count - MAX_NODES_PER_RING;
          return (
            <span key={ring}>
              {ring.replace("_", " ")}: {Math.min(count, MAX_NODES_PER_RING)}
              {overflow > 0 ? ` (+${overflow} in list)` : ""}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {TEAM_MEMBERS.map((member) => (
          <span
            key={member.id}
            className="inline-flex items-center gap-1.5 text-caption text-muted-foreground"
          >
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: member.colourToken }}
            />
            {member.fullName}
          </span>
        ))}
      </div>
    </div>
  );
}
