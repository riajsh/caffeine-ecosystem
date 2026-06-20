"use client";

import Link from "next/link";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatInteractionDate } from "@/lib/format/date";
import { formatEnumLabel } from "@/lib/format/enum";
import type { ProfileDetail } from "@/lib/data/profiles";
import type { OrgUser } from "@/lib/data/users";

import { ActivityTimeline } from "./activity-timeline";
import { LogActivityForm } from "./log-activity-form";
import { ProfileConnectionsSection } from "./profile-connections-section";

type ProfileDetailTabsProps = {
  profile: ProfileDetail;
  teamUsers: OrgUser[];
  currentUserId: string;
  defaultTab?: "activity" | "connections" | "events" | "notes";
};

export function ProfileDetailTabs({
  profile,
  teamUsers,
  currentUserId,
  defaultTab = "activity",
}: ProfileDetailTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="space-y-6">
        <LogActivityForm
          profileId={profile.id}
          teamUsers={teamUsers}
          currentUserId={currentUserId}
        />
        <ActivityTimeline activities={profile.activities} />
      </TabsContent>

      <TabsContent value="connections">
        <ProfileConnectionsSection
          profileId={profile.id}
          connections={profile.connections}
          teamUsers={teamUsers}
          currentUserId={currentUserId}
        />
      </TabsContent>

      <TabsContent value="events">
        {profile.events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-subheading font-medium text-foreground">
              No events attended
            </p>
            <p className="mt-2 text-body text-muted-foreground">
              Add this profile as an attendee on an{" "}
              <Link href="/events" className="text-foreground underline">
                event
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {profile.events.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <Link
                  href={`/events/${event.id}`}
                  className="text-body font-medium text-foreground hover:underline"
                >
                  {event.title}
                </Link>
                <p className="text-caption text-muted-foreground">
                  {formatEnumLabel(event.eventType)} ·{" "}
                  {formatInteractionDate(event.eventDate)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="notes" className="space-y-3">
        <h2 className="text-subheading font-medium text-foreground">
          Relationship notes
        </h2>
        {profile.relationship?.notes ? (
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-body text-foreground">
            {profile.relationship.notes}
          </p>
        ) : (
          <p className="text-body text-muted-foreground">
            No org-level relationship notes yet.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
