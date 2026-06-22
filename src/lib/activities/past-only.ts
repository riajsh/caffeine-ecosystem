/** ISO timestamp for queries: activities at or before now count as "happened". */
export function pastActivityCutoffIso(): string {
  return new Date().toISOString();
}

export function isPastOrPresentActivityDate(
  activityDate: string | null | undefined,
): boolean {
  if (!activityDate) {
    return false;
  }

  return new Date(activityDate).getTime() <= Date.now();
}
