import "server-only";

export type CalendarSyncCursors = Record<string, string>;

export type CalendarAccountMetadata = {
  syncing?: boolean;
  started_at?: string;
  needs_backfill?: boolean;
  sync_cursors?: CalendarSyncCursors;
  last_run?: {
    at: string;
    stats: unknown;
    error?: string;
    calendars_synced?: number;
  };
};

export function parseCalendarAccountMetadata(
  metadata: unknown,
): CalendarAccountMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return metadata as CalendarAccountMetadata;
}

/** Merge legacy sync_cursor column with metadata.sync_cursors. */
export function loadCalendarSyncCursors(
  metadata: unknown,
  legacySyncCursor: string | null,
): CalendarSyncCursors {
  const parsed = parseCalendarAccountMetadata(metadata);
  const cursors: CalendarSyncCursors = { ...(parsed.sync_cursors ?? {}) };

  if (legacySyncCursor && !cursors.primary) {
    cursors.primary = legacySyncCursor;
  }

  return cursors;
}

export function isCalendarBackfillPending(params: {
  syncEnabled: boolean;
  legacySyncCursor: string | null;
  metadata: unknown;
  calendarIds: string[];
}): boolean {
  if (!params.syncEnabled) {
    return false;
  }

  const parsed = parseCalendarAccountMetadata(params.metadata);
  if (parsed.needs_backfill) {
    return true;
  }

  const cursors = loadCalendarSyncCursors(params.metadata, params.legacySyncCursor);

  if (params.calendarIds.length === 0) {
    return params.legacySyncCursor === null && Object.keys(cursors).length === 0;
  }

  return params.calendarIds.some((calendarId) => !cursors[calendarId]);
}

export function resolvePrimarySyncCursor(
  cursors: CalendarSyncCursors,
  accountEmail: string,
): string | null {
  return cursors.primary ?? cursors[accountEmail.toLowerCase()] ?? null;
}
