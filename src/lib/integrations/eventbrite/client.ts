import "server-only";

const EVENTBRITE_API_BASE = "https://www.eventbriteapi.com/v3";

export type EventbriteAccountIdentity = {
  name: string | null;
  email: string | null;
};

type EventbriteMeResponse = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  emails?: Array<{ email: string; primary?: boolean; verified?: boolean }>;
};

function friendlyErrorForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "That token wasn't accepted by Eventbrite — double check you copied the whole private token.";
  }
  if (status === 429) {
    return "Eventbrite is rate-limiting requests right now. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "Eventbrite's API is having trouble right now. Try again shortly.";
  }
  return `Eventbrite rejected the request (status ${status}).`;
}

/**
 * Validates an Eventbrite private token by calling GET /users/me/, and
 * returns the account's display name and primary email for confirmation
 * in the Admin UI. Throws a friendly Error on any failure.
 */
export async function validateEventbriteToken(
  token: string,
): Promise<EventbriteAccountIdentity> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Paste your Eventbrite private token first.");
  }

  let response: Response;
  try {
    response = await fetch(`${EVENTBRITE_API_BASE}/users/me/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Couldn't reach Eventbrite to check the token. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new Error(friendlyErrorForStatus(response.status));
  }

  let payload: EventbriteMeResponse;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Eventbrite returned an unexpected response. Try again.");
  }

  const primaryEmail =
    payload.emails?.find((entry) => entry.primary)?.email ??
    payload.emails?.[0]?.email ??
    null;

  const name =
    payload.name ??
    [payload.first_name, payload.last_name].filter(Boolean).join(" ") ??
    null;

  return {
    name: name || null,
    email: primaryEmail,
  };
}
