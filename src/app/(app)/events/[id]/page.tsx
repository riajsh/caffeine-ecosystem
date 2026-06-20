import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { AddEventAttendeeForm } from "@/components/events/add-event-attendee-form";
import { EventAttendeesTable } from "@/components/events/event-attendees-table";
import { EventConnectionsSection } from "@/components/events/event-connections-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { InferCoAttendanceButton } from "@/components/events/infer-co-attendance-button";
import { formatInteractionDate } from "@/lib/format/date";
import { formatEnumLabel } from "@/lib/format/enum";
import {
  getProfileEventAttendanceCounts,
} from "@/lib/computed/event-attendance";
import { toAttendanceCountRecord } from "@/lib/event-attendance";
import { getEventById } from "@/lib/data/events";
import { listEventConnections } from "@/lib/data/connections";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const [event, connections, attendanceCounts] = await Promise.all([
    getEventById(id),
    listEventConnections(id),
    getProfileEventAttendanceCounts(),
  ]);
  const attendanceCountRecord = toAttendanceCountRecord(attendanceCounts);

  return (
    <>
      <PageHeader title={event.title}>
        <Button asChild variant="outline">
          <Link href="/events">Back to events</Link>
        </Button>
      </PageHeader>
      <div className="space-y-8 px-8 py-6">
        <section className="space-y-3 rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatEnumLabel(event.eventType)}</Badge>
            <span className="text-body text-muted-foreground">
              {formatInteractionDate(event.eventDate)}
            </span>
            {event.location ? (
              <span className="text-body text-muted-foreground">
                · {event.location}
              </span>
            ) : null}
            <span className="text-body text-muted-foreground">
              · {event.attendeeCount} attendee
              {event.attendeeCount === 1 ? "" : "s"}
            </span>
          </div>
          {event.description ? (
            <p className="max-w-3xl text-body text-foreground">{event.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <InferCoAttendanceButton
              eventId={event.id}
              attendeeCount={event.attendeeCount}
            />
            <DeleteEventButton eventId={event.id} eventTitle={event.title} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-heading font-medium text-foreground">Attendees</h2>
          <AddEventAttendeeForm
            eventId={event.id}
            existingProfileIds={event.attendees.map((attendee) => attendee.profileId)}
          />
          <EventAttendeesTable
            eventId={event.id}
            attendees={event.attendees}
            attendanceCounts={attendanceCountRecord}
          />
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-heading font-medium text-foreground">
              Connections from this event
            </h2>
            <p className="text-caption text-muted-foreground">
              Profile pairs linked via co-attendance inference for this event.
            </p>
          </div>
          <EventConnectionsSection connections={connections} />
        </section>
      </div>
    </>
  );
}
