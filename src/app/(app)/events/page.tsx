import { PageHeader } from "@/components/app-shell/page-header";
import { CreateEventForm } from "@/components/events/create-event-form";
import { EventsTable } from "@/components/events/events-table";
import { FrequentAttendeesCard } from "@/components/events/frequent-attendees-card";
import { getFrequentEventAttendees } from "@/lib/computed/event-attendance";
import { listEvents } from "@/lib/data/events";

export default async function EventsPage() {
  const [events, frequentAttendees] = await Promise.all([
    listEvents(),
    getFrequentEventAttendees(),
  ]);

  return (
    <>
      <PageHeader
        title="Events"
        description="PU community events — attendance feeds profile timelines and connection signals."
      >
        <CreateEventForm />
      </PageHeader>
      <div className="space-y-6 px-8 py-6">
        <FrequentAttendeesCard attendees={frequentAttendees} />
        <EventsTable events={events} />
      </div>
    </>
  );
}
