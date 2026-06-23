import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const IGNORED_EMAIL_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^calendar-notification@/i,
  /^mailer-daemon@/i,
];

/** Google Workspace rooms, desks, and shared calendars — not people. */
const NON_PERSON_EMAIL_PATTERNS = [
  ...IGNORED_EMAIL_PATTERNS,
  /@resource\.calendar\.google\.com$/i,
  /@group\.calendar\.google\.com$/i,
];

type AdminClient = SupabaseClient<Database>;

export type OrgParticipantFilters = {
  teamEmails: Set<string>;
  internalDomains: Set<string>;
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) {
    return null;
  }

  return email.slice(at + 1);
}

const DEFAULT_PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "fastmail.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
]);

function loadPersonalEmailDomains(): Set<string> {
  const raw = process.env.CALENDAR_PERSONAL_EMAIL_DOMAINS?.trim();
  if (!raw) {
    return DEFAULT_PERSONAL_EMAIL_DOMAINS;
  }

  return new Set(
    raw
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Consumer email domains (gmail.com, etc.) — usually personal, not work contacts. */
export function isPersonalEmailDomain(email: string): boolean {
  const domain = extractEmailDomain(normaliseEmail(email));
  if (!domain) {
    return false;
  }

  return loadPersonalEmailDomains().has(domain);
}

export function isIgnoredEmail(email: string): boolean {
  return IGNORED_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

export function isNonPersonParticipant(email: string): boolean {
  const normalised = normaliseEmail(email);
  if (!normalised) {
    return true;
  }

  return NON_PERSON_EMAIL_PATTERNS.some((pattern) => pattern.test(normalised));
}

function collectDomains(emails: Iterable<string>): Set<string> {
  const domains = new Set<string>();

  for (const email of emails) {
    const domain = extractEmailDomain(normaliseEmail(email));
    if (domain) {
      domains.add(domain);
    }
  }

  return domains;
}

function loadConfiguredInternalDomains(): Set<string> {
  const raw = process.env.ORG_INTERNAL_EMAIL_DOMAINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function loadOrgParticipantFilters(
  supabase: AdminClient,
  orgId: string,
): Promise<OrgParticipantFilters> {
  const [usersResult, gmailResult, calendarResult] = await Promise.all([
    supabase.from("users").select("email").eq("org_id", orgId),
    supabase.from("gmail_accounts").select("email").eq("org_id", orgId),
    supabase.from("calendar_accounts").select("email").eq("org_id", orgId),
  ]);

  if (usersResult.error) {
    throw new Error(`Failed to load org team emails: ${usersResult.error.message}`);
  }

  if (gmailResult.error) {
    throw new Error(
      `Failed to load org gmail account emails: ${gmailResult.error.message}`,
    );
  }

  if (calendarResult.error) {
    throw new Error(
      `Failed to load org calendar account emails: ${calendarResult.error.message}`,
    );
  }

  const teamEmails = new Set(
    (usersResult.data ?? [])
      .map((row) => row.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  const internalDomains = collectDomains([
    ...teamEmails,
    ...(gmailResult.data ?? []).map((row) => row.email),
    ...(calendarResult.data ?? []).map((row) => row.email),
  ]);

  for (const domain of loadConfiguredInternalDomains()) {
    internalDomains.add(domain);
  }

  return { teamEmails, internalDomains };
}

export function isInternalParticipant(
  email: string,
  filters: OrgParticipantFilters,
): boolean {
  const normalised = normaliseEmail(email);
  if (!normalised) {
    return true;
  }

  if (filters.teamEmails.has(normalised)) {
    return true;
  }

  const domain = extractEmailDomain(normalised);
  if (domain && filters.internalDomains.has(domain)) {
    return true;
  }

  return isNonPersonParticipant(normalised);
}

/** Env-domain check only — for nav/account routing without a DB round-trip. */
export function isInternalParticipantEmail(email: string): boolean {
  const normalised = normaliseEmail(email);
  if (!normalised || isNonPersonParticipant(normalised)) {
    return true;
  }

  const domain = extractEmailDomain(normalised);
  if (!domain) {
    return true;
  }

  return loadConfiguredInternalDomains().has(domain);
}

export function hasExternalParticipant(
  participants: Array<{ email: string }>,
  filters: OrgParticipantFilters,
): boolean {
  return participants.some((participant) => {
    const email = normaliseEmail(participant.email);
    return email && !isInternalParticipant(email, filters);
  });
}
