import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import { getDecryptedEventbriteToken } from "@/lib/data/eventbrite-accounts";
import { listEventQuestions } from "@/lib/integrations/eventbrite/client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type MappableField = "role" | "company_size" | "phone" | "ignore";

export type QuestionMappingRow = {
  eventbriteQuestionId: string;
  questionText: string;
  targetField: MappableField;
};

export type QuestionMappingList = {
  connected: boolean;
  questions: QuestionMappingRow[];
};

/**
 * Lists an event's Eventbrite registration questions, cross-referenced with
 * any mapping already saved for it (defaulting unmapped ones to "ignore").
 * Powers the one-time "map this event's questions" screen.
 */
export async function listQuestionMappingsForEvent(
  caffeineEventId: string,
): Promise<QuestionMappingList> {
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, eventbrite_event_id")
    .eq("id", caffeineEventId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load event: ${eventError.message}`);
  }
  if (!event?.eventbrite_event_id) {
    return { connected: false, questions: [] };
  }

  const token = await getDecryptedEventbriteToken(orgId);
  if (!token) {
    return { connected: false, questions: [] };
  }

  const [questions, { data: savedMappings, error: mappingError }] = await Promise.all([
    listEventQuestions(token, event.eventbrite_event_id),
    supabase
      .from("eventbrite_question_mappings")
      .select("eventbrite_question_id, target_field")
      .eq("org_id", orgId)
      .eq("event_id", caffeineEventId),
  ]);

  if (mappingError) {
    throw new Error(`Failed to load saved mappings: ${mappingError.message}`);
  }

  const savedByQuestionId = new Map(
    (savedMappings ?? []).map((row) => [row.eventbrite_question_id, row.target_field]),
  );

  return {
    connected: true,
    questions: questions.map((question) => ({
      eventbriteQuestionId: question.id,
      questionText: question.text,
      targetField: (savedByQuestionId.get(question.id) as MappableField) ?? "ignore",
    })),
  };
}

export async function saveQuestionMappings(
  caffeineEventId: string,
  mappings: Array<{
    eventbriteQuestionId: string;
    questionText: string;
    targetField: MappableField;
  }>,
): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const rows = mappings.map((mapping) => ({
    org_id: orgId,
    event_id: caffeineEventId,
    eventbrite_question_id: mapping.eventbriteQuestionId,
    question_text: mapping.questionText,
    target_field: mapping.targetField,
  }));

  const { error } = await supabase
    .from("eventbrite_question_mappings")
    .upsert(rows, { onConflict: "org_id,event_id,eventbrite_question_id" });

  if (error) {
    throw new Error(`Failed to save question mappings: ${error.message}`);
  }
}

/**
 * Quick lookup used by the sync engine: eventbrite_question_id -> target
 * field, excluding anything mapped to "ignore".
 */
export async function loadQuestionFieldMapForSync(
  supabase: SupabaseClient<Database>,
  orgId: string,
  eventId: string,
): Promise<Map<string, MappableField>> {
  const { data, error } = await supabase
    .from("eventbrite_question_mappings")
    .select("eventbrite_question_id, target_field")
    .eq("org_id", orgId)
    .eq("event_id", eventId)
    .neq("target_field", "ignore");

  if (error) {
    throw new Error(`Failed to load question mappings: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.eventbrite_question_id,
      row.target_field as MappableField,
    ]),
  );
}
