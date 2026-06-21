import "server-only";

import { z } from "zod";

const calendarEnvSchema = z.object({
  GOOGLE_CALENDAR_CLIENT_ID: z.string().min(1),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(16),
});

export type CalendarEnv = z.infer<typeof calendarEnvSchema>;

let cached: CalendarEnv | null = null;

export function getCalendarEnv(): CalendarEnv {
  if (cached) {
    return cached;
  }

  const parsed = calendarEnvSchema.safeParse({
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  });

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Calendar sync is not configured:\n${formatted}`);
  }

  cached = parsed.data;
  return cached;
}

export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

/** How far back the initial sync pulls events (months). */
export const CALENDAR_BACKFILL_MONTHS = 12;

/** How far ahead the sync window extends (months). Cron keeps this horizon rolling. */
export const CALENDAR_LOOKAHEAD_MONTHS = 3;

export function calendarLookaheadCutoff(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + CALENDAR_LOOKAHEAD_MONTHS);
  return date;
}

export function isBeyondCalendarLookahead(startAt: string | null): boolean {
  if (!startAt) {
    return false;
  }

  return new Date(startAt) > calendarLookaheadCutoff();
}
