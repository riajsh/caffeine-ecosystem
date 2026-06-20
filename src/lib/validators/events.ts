import { z } from "zod";

import { postgresUuidSchema } from "@/lib/validators/id";

export const eventTypeSchema = z.enum([
  "dinner",
  "roundtable",
  "workshop",
  "retreat",
  "summit",
  "other",
]);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((value) => value || undefined),
    eventType: eventTypeSchema.default("other"),
    eventDate: z.string().min(1, "Date is required"),
    location: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((data, ctx) => {
    if (Number.isNaN(new Date(data.eventDate).getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid date",
        path: ["eventDate"],
      });
    }
  });

export const addEventAttendeeSchema = z.object({
  eventId: postgresUuidSchema,
  profileId: postgresUuidSchema,
  attended: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
});

export const removeEventAttendeeSchema = z.object({
  eventId: postgresUuidSchema,
  profileId: postgresUuidSchema,
});

export const deleteEventSchema = z.object({
  eventId: postgresUuidSchema,
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type AddEventAttendeeInput = z.infer<typeof addEventAttendeeSchema>;
