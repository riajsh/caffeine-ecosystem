export type CalendarParticipant = {
  email: string;
  name: string | null;
  responseStatus: string | null;
  organizer: boolean;
};

export type ParsedCalendarEvent = {
  googleEventId: string;
  title: string | null;
  description: string | null;
  participants: CalendarParticipant[];
  startAt: string | null;
  endAt: string | null;
  isDeleted: boolean;
};

export type CalendarSyncStats = {
  eventsProcessed: number;
  activitiesCreated: number;
  reviewsQueued: number;
  errors: string[];
  rateLimited?: boolean;
};
