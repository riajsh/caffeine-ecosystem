import { z } from "zod";

import { postgresUuidSchema } from "@/lib/validators/id";

const ownerStrength = z.enum([
  "inner_circle",
  "strong",
  "warm",
  "weak",
  "unknown",
]);

const relationshipStatus = z.enum([
  "prospect",
  "active",
  "partner",
  "advisor",
  "community",
  "dormant",
  "inactive",
]);

const relationshipType = z.enum([
  "founder",
  "investor",
  "operator",
  "advisor",
  "partner",
  "sponsor",
  "media",
  "other",
]);

export const assignOwnerSchema = z.object({
  profileId: postgresUuidSchema,
  userId: postgresUuidSchema,
  strength: ownerStrength.default("unknown"),
  isPrimary: z.coerce.boolean().default(false),
});

export const updateOwnerSchema = z.object({
  profileId: postgresUuidSchema,
  ownerId: postgresUuidSchema,
  strength: ownerStrength,
  isPrimary: z.coerce.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});

export const updateRelationshipSchema = z.object({
  profileId: postgresUuidSchema,
  relationshipId: postgresUuidSchema,
  status: relationshipStatus,
  relationshipType: relationshipType,
  notes: z.string().trim().max(5000).optional(),
});

export type AssignOwnerInput = z.infer<typeof assignOwnerSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerSchema>;
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;
