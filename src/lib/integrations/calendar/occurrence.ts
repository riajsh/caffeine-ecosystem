import "server-only";

/** Stable idempotency key for the same meeting across calendar copies. */
export function calendarOccurrenceKey(
  icalUid: string | null | undefined,
  startAt: string | null | undefined,
): string | null {
  if (!icalUid?.trim() || !startAt) {
    return null;
  }

  return `${icalUid.trim()}#${startAt}`;
}

/** Activity and review idempotency — occurrence key when available, else google event id. */
export function calendarActivitySourceRef(
  icalUid: string | null | undefined,
  startAt: string | null | undefined,
  googleEventId: string,
): string {
  return calendarOccurrenceKey(icalUid, startAt) ?? googleEventId;
}
