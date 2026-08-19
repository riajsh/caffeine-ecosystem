import "server-only";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  ensureEventAttendanceEvidence,
  findOrCreateEventTag,
  linkProfileToTag,
} from "@/lib/data/events";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createClient } from "@/lib/supabase/server";
import type { ResolveEventbriteReviewInput } from "@/lib/validators/eventbrite";

export type EventbriteReviewRow = {
  id: string;
  email: string;
  displayName: string | null;
  ticketType: string | null;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  createdAt: string;
};

export async function listPendingEventbriteReviews(): Promise<EventbriteReviewRow[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eventbrite_attendee_reviews")
    .select(
      `
      id,
      email,
      display_name,
      ticket_type,
      created_at,
      events (
        id,
        title,
        event_date
      )
    `,
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load Eventbrite review queue: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const event = row.events;
      if (!event) {
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        ticketType: row.ticket_type,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.event_date,
        createdAt: row.created_at,
      };
    })
    .filter((row): row is EventbriteReviewRow => row !== null);
}

export type EventbriteProfileMatch = {
  id: string;
  fullName: string;
  email: string | null;
};

/** Simple name/email search for linking a review to an existing profile. */
export async function searchProfilesForEventbriteLink(
  query: string,
): Promise<EventbriteProfileMatch[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const term = query.trim().replace(/[%_]/g, "");

  if (term.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("org_id", orgId)
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    .order("full_name")
    .limit(8);

  if (error) {
    throw new Error(`Failed to search profiles: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  }));
}

type MappedProfileFields = Partial<
  Record<"role" | "company_size" | "phone", string>
>;

const FIELD_TO_COLUMN: Record<
  keyof MappedProfileFields,
  "occupation" | "company_size" | "phone"
> = {
  role: "occupation",
  company_size: "company_size",
  phone: "phone",
};

/** Fills in any blank profile fields from the review's mapped Eventbrite
 * answers (role/company size/phone) — never overwrites something already
 * set, since that's what the profile-update review queue is for. */
async function fillBlankFieldsFromMappedAnswers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  profileId: string,
  mappedFields: MappedProfileFields | null | undefined,
): Promise<void> {
  if (!mappedFields || Object.keys(mappedFields).length === 0) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("occupation, company_size, phone")
    .eq("id", profileId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!profile) {
    return;
  }

  const profileValues: Record<string, string | null> = {
    occupation: profile.occupation,
    company_size: profile.company_size,
    phone: profile.phone,
  };

  const fill: { occupation?: string; company_size?: string; phone?: string } = {};
  for (const [field, value] of Object.entries(mappedFields) as Array<
    [keyof MappedProfileFields, string]
  >) {
    const column = FIELD_TO_COLUMN[field];
    if (!profileValues[column]?.trim() && value) {
      fill[column] = value;
    }
  }

  if (Object.keys(fill).length > 0) {
    await supabase.from("profiles").update(fill).eq("id", profileId).eq("org_id", orgId);
  }
}

async function createProfileFromReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  review: { email: string; displayName: string | null; mappedFields?: MappedProfileFields },
): Promise<string> {
  const email = review.email.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    await fillBlankFieldsFromMappedAnswers(supabase, orgId, existing.id, review.mappedFields);
    return existing.id;
  }

  const fullName = review.displayName?.trim() || email;

  const mapped = review.mappedFields ?? {};
  const extraFields: { occupation?: string; company_size?: string; phone?: string } = {};
  for (const [field, value] of Object.entries(mapped) as Array<
    [keyof MappedProfileFields, string]
  >) {
    if (value) {
      extraFields[FIELD_TO_COLUMN[field]] = value;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      org_id: orgId,
      full_name: fullName,
      email,
      organisation_name: null,
      organisation_name_normalised: normaliseOrganisationName(null),
      source: "manual",
      ...extraFields,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: racedProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("org_id", orgId)
        .ilike("email", email)
        .maybeSingle();
      if (racedProfile) {
        return racedProfile.id;
      }
    }
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  return data.id;
}

export async function resolveEventbriteReview(
  input: ResolveEventbriteReviewInput,
): Promise<void> {
  const user = await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: review, error: reviewError } = await supabase
    .from("eventbrite_attendee_reviews")
    .select(
      `
      id,
      email,
      display_name,
      status,
      mapped_fields,
      events (
        id,
        title,
        event_date
      )
    `,
    )
    .eq("id", input.reviewId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (reviewError) {
    throw new Error(`Failed to load review: ${reviewError.message}`);
  }
  if (!review) {
    throw new Error("Review not found");
  }
  if (review.status !== "pending") {
    throw new Error("This attendee has already been reviewed");
  }

  const event = review.events;
  if (!event) {
    throw new Error("The linked event no longer exists");
  }

  if (input.action === "ignore") {
    const { error } = await supabase
      .from("eventbrite_attendee_reviews")
      .update({
        status: "ignored",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.reviewId)
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Failed to update review: ${error.message}`);
    }
    return;
  }

  const mappedFields = (review.mapped_fields ?? {}) as MappedProfileFields;

  let profileId: string;
  if (input.action === "link" && input.profileId) {
    profileId = input.profileId;
    await fillBlankFieldsFromMappedAnswers(supabase, orgId, profileId, mappedFields);
  } else {
    profileId = await createProfileFromReview(supabase, orgId, {
      email: input.email ?? review.email,
      displayName: input.fullName ?? review.display_name,
      mappedFields,
    });
  }

  const { error: attendeeError } = await supabase.from("event_attendees").upsert(
    {
      org_id: orgId,
      event_id: event.id,
      profile_id: profileId,
      attended: false,
    },
    { onConflict: "event_id,profile_id", ignoreDuplicates: true },
  );

  if (attendeeError) {
    throw new Error(`Failed to add attendee: ${attendeeError.message}`);
  }

  await ensureEventAttendanceEvidence(orgId, event, profileId, user.id);

  const tagResult = await findOrCreateEventTag(supabase, orgId, event.title);
  if (tagResult.tagId) {
    await linkProfileToTag(supabase, orgId, profileId, tagResult.tagId);
  }

  const { error: updateError } = await supabase
    .from("eventbrite_attendee_reviews")
    .update({
      status: input.action === "link" ? "linked" : "created",
      profile_id: profileId,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.reviewId)
    .eq("org_id", orgId);

  if (updateError) {
    throw new Error(`Failed to update review: ${updateError.message}`);
  }
}
