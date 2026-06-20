"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeEventAttendeeAction } from "@/app/(app)/events/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventAttendee } from "@/lib/data/events";
import { isRegularEventAttendee } from "@/lib/event-attendance";

type EventAttendeesTableProps = {
  eventId: string;
  attendees: EventAttendee[];
  attendanceCounts: Record<string, number>;
};

export function EventAttendeesTable({
  eventId,
  attendees,
  attendanceCounts,
}: EventAttendeesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (attendees.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-subheading font-medium text-foreground">
          No attendees yet
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          Search for profiles below to record who attended.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendees.map((attendee) => {
            const eventCount = attendanceCounts[attendee.profileId] ?? 0;
            const isRegular = isRegularEventAttendee(
              attendanceCounts,
              attendee.profileId,
            );

            return (
            <TableRow key={attendee.id}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/profiles/${attendee.profileId}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {attendee.fullName}
                  </Link>
                  {isRegular ? (
                    <Badge variant="outline">
                      Regular · {eventCount} events
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {attendee.organisationName ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={attendee.attended ? "default" : "secondary"}>
                  {attendee.attended ? "Attended" : "Registered"}
                </Badge>
              </TableCell>
              <TableCell>
                <form
                  action={(formData) => {
                    if (
                      !window.confirm(
                        `Remove ${attendee.fullName} from this event?`,
                      )
                    ) {
                      return;
                    }

                    startTransition(async () => {
                      const result = await removeEventAttendeeAction(formData);
                      if (result.error) {
                        window.alert(result.error);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="profileId" value={attendee.profileId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
