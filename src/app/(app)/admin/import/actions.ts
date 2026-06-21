"use server";

import { revalidatePath } from "next/cache";

import {
  applyColumnMappingToImport,
  backfillImportProfiles,
  commitImport,
  deleteImport,
  reopenImport,
  resolveSoftMatch,
  runImportDedup,
  saveColumnMapping,
  uploadAndParseImport,
} from "@/lib/data/imports";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/import/constants";
import type { ColumnMapping } from "@/lib/import/types";
import {
  columnMappingSchema,
  importIdSchema,
  softMatchActionSchema,
  uploadImportSchema,
} from "@/lib/validators/imports";

function revalidateImport(importId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/datasets");
  revalidatePath("/admin/import");
  revalidatePath(`/admin/import/${importId}`);
  revalidatePath("/profiles");
}

export async function uploadImportAction(formData: FormData) {
  const parsed = uploadImportSchema.safeParse({
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid source" };
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload" };
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "Only CSV files are supported in V1" };
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { error: "File exceeds the 10 MB limit" };
  }

  let importId: string;

  try {
    const csvText = await file.text();
    importId = await uploadAndParseImport({
      filename: file.name,
      source: parsed.data.source,
      csvText,
    });

    revalidateImport(importId);
    return { importId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function saveMappingAction(formData: FormData) {
  const importId = formData.get("importId");
  const parsedId = importIdSchema.safeParse(importId);

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  const mapping: ColumnMapping = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("map:")) {
      continue;
    }

    const header = key.slice(4);
    if (typeof value === "string") {
      mapping[header] = value as ColumnMapping[string];
    }
  }

  const parsedMapping = columnMappingSchema.safeParse(mapping);
  if (!parsedMapping.success) {
    return { error: "Invalid column mapping" };
  }

  try {
    await saveColumnMapping(parsedId.data, parsedMapping.data as ColumnMapping);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save mapping",
    };
  }
}

export async function applyMappingAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    await applyColumnMappingToImport(parsedId.data);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to apply mapping",
    };
  }
}

export async function runDedupAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    await runImportDedup(parsedId.data);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to run dedup",
    };
  }
}

export async function resolveSoftMatchAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));
  const parsedRowId = importIdSchema.safeParse(formData.get("rowId"));
  const parsedAction = softMatchActionSchema.safeParse(formData.get("action"));

  if (!parsedId.success || !parsedRowId.success || !parsedAction.success) {
    return { error: "Invalid soft match request" };
  }

  try {
    await resolveSoftMatch(parsedRowId.data, parsedAction.data);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to resolve soft match",
    };
  }
}

export async function commitImportAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    await commitImport(parsedId.data);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to commit import",
    };
  }
}

export async function deleteImportAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    await deleteImport(parsedId.data);
    revalidatePath("/admin");
    revalidatePath("/admin/import");
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete import",
    };
  }
}

export async function backfillImportProfilesAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    const summary = await backfillImportProfiles(parsedId.data);
    revalidateImport(parsedId.data);
    revalidatePath("/profiles");
    return { summary };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to apply import data",
    };
  }
}

export async function reopenImportAction(formData: FormData) {
  const parsedId = importIdSchema.safeParse(formData.get("importId"));

  if (!parsedId.success) {
    return { error: "Invalid import ID" };
  }

  try {
    await reopenImport(parsedId.data);
    revalidateImport(parsedId.data);
    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reopen import",
    };
  }
}
