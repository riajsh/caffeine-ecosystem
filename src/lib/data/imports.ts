import "server-only";

import { notFound } from "next/navigation";

import { getOrgId, requireAdmin } from "@/lib/auth/session";
import {
  guessColumnMapping,
  MAX_IMPORT_ROWS,
  PREVIEW_ROW_LIMIT,
} from "@/lib/import/constants";
import {
  assignOwnerFromNormalized,
  backfillProfileFieldsFromNormalized,
  backfillRelationshipFromNormalized,
  linkProfileTagsFromNormalized,
  resolveProfileIdForImportRow,
} from "@/lib/import/backfill-row";
import { parseCsv } from "@/lib/import/csv";
import {
  applyColumnMapping,
  normalizeRowFromImport,
  parseTags,
  validateNormalizedRow,
} from "@/lib/import/mapping";
import { nameCompanyDedupKey } from "@/lib/dedup/name-company";
import {
  getInFileMatchRowNumber,
  withMergeInFileRowNumber,
  withInFileMatchRowNumber,
} from "@/lib/import/in-file-dedup";
import { resolveOrgUserId, type OrgUserRecord } from "@/lib/import/resolve-owner";
import type {
  ColumnMapping,
  CommitSummary,
  DedupSummary,
  ImportDetail,
  ImportListItem,
  ImportMetadata,
  ImportRowView,
  ImportStatus,
  NormalizedImportRow,
  SoftMatchAction,
} from "@/lib/import/types";
import { normaliseOrganisationName } from "@/lib/normalise/organisation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DedupStatus = Database["public"]["Enums"]["dedup_status"];
type RelationshipStatus = Database["public"]["Enums"]["relationship_status"];
type RelationshipType = Database["public"]["Enums"]["relationship_type"];
type OwnerStrength = Database["public"]["Enums"]["owner_strength"];

type ImportRowRecord = {
  id: string;
  row_number: number;
  raw: Record<string, string>;
  normalized: NormalizedImportRow;
  dedup_status: DedupStatus;
  matched_profile_id: string | null;
  error: string | null;
  matched_profile?: {
    full_name: string;
    organisation_name: string | null;
  } | null;
};

function parseMetadata(metadata: unknown): ImportMetadata {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return metadata as ImportMetadata;
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      record[key] = entry;
    } else if (entry != null) {
      record[key] = String(entry);
    }
  }
  return record;
}

function asNormalized(value: unknown): NormalizedImportRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as NormalizedImportRow;
}

function mapImportRow(
  row: ImportRowRecord,
  rowsByNumber?: Map<number, ImportRowRecord>,
): ImportRowView {
  const inFileRowNumber = getInFileMatchRowNumber(row.normalized);
  const inFileRow = inFileRowNumber ? rowsByNumber?.get(inFileRowNumber) : undefined;

  return {
    id: row.id,
    rowNumber: row.row_number,
    raw: row.raw,
    normalized: row.normalized,
    dedupStatus: row.dedup_status,
    matchedProfileId: row.matched_profile_id,
    matchedProfileName:
      row.matched_profile?.full_name ??
      inFileRow?.normalized.full_name ??
      null,
    matchedProfileCompany:
      row.matched_profile?.organisation_name ??
      inFileRow?.normalized.organisation_name ??
      null,
    matchedInFileRowNumber: inFileRowNumber,
    matchedInFileRowEmail: inFileRow?.normalized.email ?? null,
    error: row.error,
  };
}

function canDeleteImport(
  status: ImportStatus,
  commitSummary: CommitSummary | null | undefined,
): boolean {
  if (status === "complete") {
    if (!commitSummary) {
      return true;
    }
    return commitSummary.created + commitSummary.updated === 0;
  }

  return true;
}

function importStatusHint(
  status: ImportStatus,
  metadata: ImportMetadata,
): string {
  if (status === "pending") {
    return "Not started";
  }

  if (status === "failed") {
    return metadata.errors?.[0] ?? "Failed";
  }

  if (status === "complete") {
    const summary = metadata.commit_summary;
    if (!summary) {
      return "Complete";
    }
    return `${summary.created} created, ${summary.updated} updated`;
  }

  if (!metadata.mapping_confirmed) {
    return "Map columns";
  }

  if (!metadata.dedup_summary) {
    return "Run dedup";
  }

  const dedup = metadata.dedup_summary;
  if (dedup.soft_match > 0) {
    return `${dedup.soft_match} soft match${dedup.soft_match === 1 ? "" : "es"} to review`;
  }

  const ready = dedup.matched_email + dedup.new;
  if (ready === 0) {
    return "No rows ready — check errors";
  }

  return `Ready to commit (${ready} rows)`;
}

function emptyDedupSummary(): DedupSummary {
  return { matched_email: 0, soft_match: 0, new: 0, error: 0 };
}

function countDedupStatuses(rows: Array<{ dedup_status: DedupStatus }>): DedupSummary {
  const summary = emptyDedupSummary();

  for (const row of rows) {
    if (row.dedup_status === "matched_email") {
      summary.matched_email += 1;
    } else if (row.dedup_status === "soft_match") {
      summary.soft_match += 1;
    } else if (row.dedup_status === "new") {
      summary.new += 1;
    } else if (row.dedup_status === "error") {
      summary.error += 1;
    }
  }

  return summary;
}

async function getImportRecord(importId: string, orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("imports")
    .select(
      `
      id,
      filename,
      source,
      row_count,
      status,
      metadata,
      created_at,
      created_by,
      users!imports_created_by_fkey (
        full_name
      )
    `,
    )
    .eq("id", importId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load import: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  return data;
}

async function loadImportRows(importId: string, orgId: string): Promise<ImportRowRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_rows")
    .select(
      `
      id,
      row_number,
      raw,
      normalized,
      dedup_status,
      matched_profile_id,
      error,
      matched_profile:profiles!import_rows_matched_profile_id_fkey (
        full_name,
        organisation_name
      )
    `,
    )
    .eq("import_id", importId)
    .eq("org_id", orgId)
    .order("row_number");

  if (error) {
    throw new Error(`Failed to load import rows: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    row_number: row.row_number,
    raw: asRecord(row.raw),
    normalized: asNormalized(row.normalized),
    dedup_status: row.dedup_status,
    matched_profile_id: row.matched_profile_id,
    error: row.error,
    matched_profile: row.matched_profile,
  }));
}

export async function listImports(): Promise<ImportListItem[]> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("imports")
    .select(
      `
      id,
      filename,
      source,
      row_count,
      status,
      metadata,
      created_at,
      users!imports_created_by_fkey (
        full_name
      )
    `,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list imports: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const metadata = parseMetadata(row.metadata);
    const commitSummary = metadata.commit_summary ?? null;
    return {
      id: row.id,
      filename: row.filename,
      source: row.source,
      rowCount: row.row_count,
      status: row.status,
      createdAt: row.created_at,
      createdByName: row.users?.full_name ?? "Unknown",
      statusHint: importStatusHint(row.status, metadata),
      canDelete: canDeleteImport(row.status, commitSummary),
      dedupSummary: metadata.dedup_summary ?? null,
      commitSummary,
    };
  });
}

export async function getImportDetail(importId: string): Promise<ImportDetail> {
  await requireAdmin();
  const orgId = await getOrgId();
  const [importRecord, rows] = await Promise.all([
    getImportRecord(importId, orgId),
    loadImportRows(importId, orgId),
  ]);

  const metadata = parseMetadata(importRecord.metadata);
  const headers = metadata.headers ?? inferHeadersFromRows(rows);
  const rowsByNumber = new Map(rows.map((row) => [row.row_number, row]));
  const mappedRows = rows.map((row) => mapImportRow(row, rowsByNumber));
  const softMatchRows = mappedRows.filter((row) => row.dedupStatus === "soft_match");
  const unresolvedSoftMatches = softMatchRows.length;
  const dedupSummary =
    metadata.dedup_summary ??
    (metadata.mapping_confirmed ? countDedupStatuses(rows) : null);
  const committableRowCount = rows.filter(
    (row) =>
      row.dedup_status === "matched_email" || row.dedup_status === "new",
  ).length;
  const pendingRowCount = rows.filter((row) => row.dedup_status === "pending").length;

  const canCommit =
    importRecord.status === "processing" &&
    Boolean(metadata.mapping_confirmed) &&
    Boolean(metadata.dedup_summary) &&
    unresolvedSoftMatches === 0 &&
    pendingRowCount === 0 &&
    committableRowCount > 0;

  return {
    id: importRecord.id,
    filename: importRecord.filename,
    source: importRecord.source,
    rowCount: importRecord.row_count,
    status: importRecord.status,
    createdAt: importRecord.created_at,
    createdByName: importRecord.users?.full_name ?? "Unknown",
    metadata,
    headers,
    previewRows: mappedRows.slice(0, PREVIEW_ROW_LIMIT),
    softMatchRows,
    dedupSummary,
    commitSummary: metadata.commit_summary ?? null,
    unresolvedSoftMatches,
    committableRowCount,
    pendingRowCount,
    statusHint: importStatusHint(importRecord.status, metadata),
    canDelete: canDeleteImport(importRecord.status, metadata.commit_summary),
    canCommit,
  };
}

function inferHeadersFromRows(rows: ImportRowRecord[]): string[] {
  const headerSet = new Set<string>();
  for (const row of rows) {
    Object.keys(row.raw).forEach((header) => headerSet.add(header));
  }
  return [...headerSet];
}

export async function uploadAndParseImport(input: {
  filename: string;
  source: Database["public"]["Tables"]["imports"]["Insert"]["source"];
  csvText: string;
}): Promise<string> {
  const user = await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const parsed = parseCsv(input.csvText);

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import exceeds the ${MAX_IMPORT_ROWS.toLocaleString()} row limit`);
  }

  const { data: inProgress, error: inProgressError } = await supabase
    .from("imports")
    .select("id")
    .eq("org_id", orgId)
    .eq("filename", input.filename)
    .eq("status", "processing")
    .limit(1);

  if (inProgressError) {
    throw new Error(`Failed to check existing imports: ${inProgressError.message}`);
  }

  if (inProgress && inProgress.length > 0) {
    throw new Error(
      `"${input.filename}" is already in progress. Open it from history or delete it before uploading again.`,
    );
  }

  const columnMapping = guessColumnMapping(parsed.headers);
  const metadata: ImportMetadata = {
    headers: parsed.headers,
    column_mapping: columnMapping,
    mapping_confirmed: false,
  };

  const { data: importRecord, error: importError } = await supabase
    .from("imports")
    .insert({
      org_id: orgId,
      filename: input.filename,
      source: input.source,
      row_count: parsed.rows.length,
      status: "processing",
      created_by: user.id,
      metadata,
    })
    .select("id")
    .single();

  if (importError) {
    throw new Error(`Failed to create import: ${importError.message}`);
  }

  const importRows = parsed.rows.map((raw, index) => ({
    org_id: orgId,
    import_id: importRecord.id,
    row_number: index + 1,
    raw,
    normalized: applyColumnMapping(raw, columnMapping),
    dedup_status: "pending" as const,
  }));

  const batchSize = 200;
  for (let offset = 0; offset < importRows.length; offset += batchSize) {
    const batch = importRows.slice(offset, offset + batchSize);
    const { error: rowsError } = await supabase.from("import_rows").insert(batch);

    if (rowsError) {
      await supabase
        .from("imports")
        .update({
          status: "failed",
          metadata: {
            ...metadata,
            errors: [rowsError.message],
          },
        })
        .eq("id", importRecord.id);

      throw new Error(`Failed to stage import rows: ${rowsError.message}`);
    }
  }

  try {
    const admin = createAdminClient();
    const storagePath = `${orgId}/imports/${importRecord.id}/original.csv`;
    const { error: storageError } = await admin.storage
      .from("imports")
      .upload(storagePath, Buffer.from(input.csvText, "utf-8"), {
        contentType: "text/csv",
        upsert: true,
      });

    if (storageError) {
      await supabase
        .from("imports")
        .update({
          metadata: {
            ...metadata,
            storage_warning: storageError.message,
          },
        })
        .eq("id", importRecord.id);
    } else {
      await supabase
        .from("imports")
        .update({
          metadata: {
            ...metadata,
            storage_path: storagePath,
          },
        })
        .eq("id", importRecord.id);
    }
  } catch {
    await supabase
      .from("imports")
      .update({
        metadata: {
          ...metadata,
          storage_warning: "Original file storage is unavailable",
        },
      })
      .eq("id", importRecord.id);
  }

  return importRecord.id;
}

export async function saveColumnMapping(
  importId: string,
  mapping: ColumnMapping,
): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);

  const { error } = await supabase
    .from("imports")
    .update({
      metadata: {
        ...metadata,
        column_mapping: mapping,
        mapping_confirmed: false,
        dedup_summary: undefined,
      },
      status: "processing",
    })
    .eq("id", importId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to save column mapping: ${error.message}`);
  }
}

export async function applyColumnMappingToImport(importId: string): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);
  const mapping = metadata.column_mapping;

  if (!mapping || Object.keys(mapping).length === 0) {
    throw new Error("Column mapping is required before applying");
  }

  const rows = await loadImportRows(importId, orgId);
  const headers = metadata.headers ?? inferHeadersFromRows(rows);

  await runConcurrent(rows, 10, async (row) => {
    const normalized = normalizeRowFromImport(row.raw, headers, mapping, row.normalized);
    const { error } = await supabase
      .from("import_rows")
      .update({
        normalized,
        dedup_status: "pending",
        matched_profile_id: null,
        error: null,
      })
      .eq("id", row.id)
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Failed to apply mapping to row ${row.row_number}: ${error.message}`);
    }
  });

  const { error: importError } = await supabase
    .from("imports")
    .update({
      metadata: {
        ...metadata,
        mapping_confirmed: true,
        dedup_summary: undefined,
      },
    })
    .eq("id", importId)
    .eq("org_id", orgId);

  if (importError) {
    throw new Error(`Failed to confirm mapping: ${importError.message}`);
  }
}

export async function runImportDedup(importId: string): Promise<DedupSummary> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);

  if (!metadata.mapping_confirmed) {
    throw new Error("Apply column mapping before running dedup");
  }

  const [rows, profilesResult] = await Promise.all([
    loadImportRows(importId, orgId),
    supabase
      .from("profiles")
      .select("id, email, full_name, organisation_name")
      .eq("org_id", orgId),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles for dedup: ${profilesResult.error.message}`);
  }

  const profiles = profilesResult.data ?? [];
  const emailIndex = new Map<string, string>();
  const nameCompanyIndex = new Map<string, string>();

  for (const profile of profiles) {
    if (profile.email) {
      emailIndex.set(profile.email.toLowerCase(), profile.id);
    }

    const key = nameCompanyDedupKey(profile.full_name, profile.organisation_name);
    if (key) {
      nameCompanyIndex.set(key, profile.id);
    }
  }

  const seenEmails = new Map<string, number>();
  const seenNameCompany = new Map<string, number>();
  const summary = emptyDedupSummary();
  const mapping = metadata.column_mapping ?? {};
  const headers = metadata.headers ?? inferHeadersFromRows(rows);

  for (const row of rows) {
    let normalized = normalizeRowFromImport(row.raw, headers, mapping, row.normalized);
    const validationError = validateNormalizedRow(normalized);
    let dedupStatus: DedupStatus = "pending";
    let matchedProfileId: string | null = null;
    let error: string | null = validationError;

    if (validationError) {
      dedupStatus = "error";
    } else if (normalized.email) {
      const email = normalized.email.toLowerCase();
      const firstRow = seenEmails.get(email);

      if (firstRow !== undefined) {
        dedupStatus = "error";
        error = "duplicate in file";
      } else {
        seenEmails.set(email, row.row_number);
        const existingId = emailIndex.get(email);

        if (existingId) {
          dedupStatus = "matched_email";
          matchedProfileId = existingId;
        }
      }
    }

    if (!error && dedupStatus === "pending") {
      const key = nameCompanyDedupKey(
        normalized.full_name,
        normalized.organisation_name,
      );

      if (key) {
        const firstInFileRow = seenNameCompany.get(key);

        if (firstInFileRow !== undefined) {
          dedupStatus = "soft_match";
          normalized = withInFileMatchRowNumber(normalized, firstInFileRow);
        } else {
          seenNameCompany.set(key, row.row_number);
          const candidateId = nameCompanyIndex.get(key);

          if (candidateId) {
            dedupStatus = "soft_match";
            matchedProfileId = candidateId;
          }
        }
      }
    }

    if (!error && dedupStatus === "pending") {
      dedupStatus = "new";
    }

    if (dedupStatus === "matched_email") {
      summary.matched_email += 1;
    } else if (dedupStatus === "soft_match") {
      summary.soft_match += 1;
    } else if (dedupStatus === "new") {
      summary.new += 1;
    } else if (dedupStatus === "error") {
      summary.error += 1;
    }

    const { error: updateError } = await supabase
      .from("import_rows")
      .update({
        normalized,
        dedup_status: dedupStatus,
        matched_profile_id: matchedProfileId,
        error,
      })
      .eq("id", row.id)
      .eq("org_id", orgId);

    if (updateError) {
      throw new Error(`Failed to update dedup for row ${row.row_number}: ${updateError.message}`);
    }
  }

  const { error: importError } = await supabase
    .from("imports")
    .update({
      metadata: {
        ...metadata,
        dedup_summary: summary,
      },
    })
    .eq("id", importId)
    .eq("org_id", orgId);

  if (importError) {
    throw new Error(`Failed to save dedup summary: ${importError.message}`);
  }

  return summary;
}

async function loadOrgUserRecords(orgId: string): Promise<OrgUserRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to load org users: ${error.message}`);
  }

  return (data ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  }));
}

async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
}

export async function deleteImport(importId: string): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);

  if (!canDeleteImport(importRecord.status, metadata.commit_summary)) {
    throw new Error("This import created profiles and cannot be deleted");
  }

  const { error } = await supabase
    .from("imports")
    .delete()
    .eq("id", importId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to delete import: ${error.message}`);
  }
}

export type ImportBackfillSummary = {
  profilesUpdated: number;
  relationshipsUpdated: number;
  ownersAssigned: number;
  ownersUnresolved: number;
  tagsLinked: number;
  skipped: number;
};

export async function backfillImportProfiles(
  importId: string,
): Promise<ImportBackfillSummary> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);

  if (importRecord.status !== "complete") {
    throw new Error("Profile data can only be backfilled from a completed import");
  }

  const [rows, orgUsers] = await Promise.all([
    loadImportRows(importId, orgId),
    loadOrgUserRecords(orgId),
  ]);

  const mapping = parseMetadata(importRecord.metadata).column_mapping ?? {};
  const headers =
    parseMetadata(importRecord.metadata).headers ?? inferHeadersFromRows(rows);
  const result: ImportBackfillSummary = {
    profilesUpdated: 0,
    relationshipsUpdated: 0,
    ownersAssigned: 0,
    ownersUnresolved: 0,
    tagsLinked: 0,
    skipped: 0,
  };

  const eligibleRows = rows.filter(
    (row) => row.dedup_status === "new" || row.dedup_status === "matched_email",
  );
  result.skipped = rows.length - eligibleRows.length;

  const partials: ImportBackfillSummary[] = [];

  await runConcurrent(eligibleRows, 8, async (row) => {
    const normalized = normalizeRowFromImport(row.raw, headers, mapping, row.normalized);

    const profileId = await resolveProfileIdForImportRow(
      supabase,
      orgId,
      row.matched_profile_id,
      normalized,
    );

    if (!profileId) {
      partials.push({
        profilesUpdated: 0,
        relationshipsUpdated: 0,
        ownersAssigned: 0,
        ownersUnresolved: 0,
        tagsLinked: 0,
        skipped: 1,
      });
      return;
    }

    const partial: ImportBackfillSummary = {
      profilesUpdated: 0,
      relationshipsUpdated: 0,
      ownersAssigned: 0,
      ownersUnresolved: 0,
      tagsLinked: 0,
      skipped: 0,
    };

    const profileUpdated = await backfillProfileFieldsFromNormalized(
      supabase,
      orgId,
      profileId,
      normalized,
    );
    if (profileUpdated) {
      partial.profilesUpdated = 1;
    }

    const relationshipUpdated = await backfillRelationshipFromNormalized(
      supabase,
      orgId,
      profileId,
      normalized,
    );
    if (relationshipUpdated) {
      partial.relationshipsUpdated = 1;
    }

    partial.tagsLinked = await linkProfileTagsFromNormalized(
      supabase,
      orgId,
      profileId,
      normalized,
    );

    const ownerRef = normalized.owner_email?.trim();
    if (ownerRef) {
      const ownerUserId = resolveOrgUserId(ownerRef, orgUsers);

      if (!ownerUserId) {
        partial.ownersUnresolved = 1;
      } else {
        const { data: relationship, error: relationshipError } = await supabase
          .from("relationships")
          .select("id")
          .eq("org_id", orgId)
          .eq("profile_id", profileId)
          .maybeSingle();

        if (relationshipError) {
          throw new Error(`Failed to load relationship: ${relationshipError.message}`);
        }

        if (relationship) {
          await assignOwnerFromNormalized(
            supabase,
            orgId,
            relationship.id,
            normalized,
            ownerUserId,
          );
          partial.ownersAssigned = 1;
        } else {
          partial.ownersUnresolved = 1;
        }
      }
    }

    partials.push(partial);
  });

  for (const partial of partials) {
    result.profilesUpdated += partial.profilesUpdated;
    result.relationshipsUpdated += partial.relationshipsUpdated;
    result.ownersAssigned += partial.ownersAssigned;
    result.ownersUnresolved += partial.ownersUnresolved;
    result.tagsLinked += partial.tagsLinked;
    result.skipped += partial.skipped;
  }

  const metadata = parseMetadata(importRecord.metadata);
  await supabase
    .from("imports")
    .update({
      metadata: {
        ...metadata,
        backfill_summary: result,
        owner_backfill_summary: {
          assigned: result.ownersAssigned,
          unresolved: result.ownersUnresolved,
          skipped: result.skipped,
        },
      },
    })
    .eq("id", importId)
    .eq("org_id", orgId);

  return result;
}

export async function resolveSoftMatch(
  rowId: string,
  action: SoftMatchAction,
): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("import_rows")
    .select("id, import_id, dedup_status, matched_profile_id, normalized")
    .eq("id", rowId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (rowError) {
    throw new Error(`Failed to load import row: ${rowError.message}`);
  }

  if (!row || row.dedup_status !== "soft_match") {
    throw new Error("Soft match row not found");
  }

  let update: {
    dedup_status: DedupStatus;
    matched_profile_id: string | null;
    error: string | null;
    normalized?: NormalizedImportRow;
  };

  const normalized = asNormalized(row.normalized);
  const inFileRowNumber = getInFileMatchRowNumber(normalized);

  if (action === "confirm") {
    if (row.matched_profile_id) {
      update = {
        dedup_status: "matched_email",
        matched_profile_id: row.matched_profile_id,
        error: null,
      };
    } else if (inFileRowNumber) {
      update = {
        dedup_status: "matched_email",
        matched_profile_id: null,
        error: null,
        normalized: withMergeInFileRowNumber(normalized, inFileRowNumber),
      };
    } else {
      throw new Error("Missing matched profile for soft match row");
    }
  } else if (action === "create") {
    update = {
      dedup_status: "new",
      matched_profile_id: null,
      error: null,
    };
  } else {
    update = {
      dedup_status: "error",
      matched_profile_id: null,
      error: "skipped by admin",
    };
  }

  const { error } = await supabase
    .from("import_rows")
    .update(update)
    .eq("id", rowId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to resolve soft match: ${error.message}`);
  }

  const updatedRows = await loadImportRows(row.import_id, orgId);
  const importRecord = await getImportRecord(row.import_id, orgId);
  const metadata = parseMetadata(importRecord.metadata);

  await supabase
    .from("imports")
    .update({
      metadata: {
        ...metadata,
        dedup_summary: countDedupStatuses(updatedRows),
      },
    })
    .eq("id", row.import_id)
    .eq("org_id", orgId);
}

export async function commitImport(importId: string): Promise<CommitSummary> {
  const user = await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);

  if (importRecord.status === "complete") {
    throw new Error("Import has already been committed");
  }

  if (!metadata.mapping_confirmed) {
    throw new Error("Column mapping must be confirmed before commit");
  }

  if (!metadata.dedup_summary) {
    throw new Error("Run dedup before committing");
  }

  const rows = await loadImportRows(importId, orgId);
  const unresolved = rows.filter((row) => row.dedup_status === "soft_match").length;

  if (unresolved > 0) {
    throw new Error("Resolve all soft matches before committing");
  }

  const pendingCount = rows.filter((row) => row.dedup_status === "pending").length;
  if (pendingCount > 0) {
    throw new Error(
      `Run dedup before committing (${pendingCount} row${pendingCount === 1 ? "" : "s"} still pending)`,
    );
  }

  const commitRows = rows.filter(
    (row) => row.dedup_status === "matched_email" || row.dedup_status === "new",
  );

  if (commitRows.length === 0) {
    const errorCount = rows.filter((row) => row.dedup_status === "error").length;
    throw new Error(
      errorCount > 0
        ? `No rows ready to commit. ${errorCount} row${errorCount === 1 ? "" : "s"} have errors — check that Full name is mapped, then re-run dedup.`
        : "No rows ready to commit.",
    );
  }

  const { data: orgUsers, error: usersError } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("org_id", orgId);

  if (usersError) {
    throw new Error(`Failed to load org users: ${usersError.message}`);
  }

  const orgUserRecords: OrgUserRecord[] = (orgUsers ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
  }));

  const summary: CommitSummary = {
    created: 0,
    updated: 0,
    skipped: rows.length - commitRows.length,
    ownerWarnings: 0,
  };

  const sourceLabel = `${importRecord.source} import ${new Date(importRecord.created_at).toLocaleDateString("en-GB")}`;
  const mapping = metadata.column_mapping ?? {};
  const headers = metadata.headers ?? inferHeadersFromRows(rows);

  try {
    const profileIdByRowNumber = new Map<number, string>();
    const sortedCommitRows = [...commitRows].sort(
      (left, right) => left.row_number - right.row_number,
    );

    for (const row of sortedCommitRows) {
      const normalized = normalizeRowFromImport(
        row.raw,
        headers,
        mapping,
        row.normalized,
      );

      if (row.dedup_status === "new") {
        const { profileId, ownerWarnings } = await createProfileFromImportRow({
          orgId,
          importId,
          userId: user.id,
          normalized,
          sourceLabel,
          orgUsers: orgUserRecords,
        });
        profileIdByRowNumber.set(row.row_number, profileId);
        summary.created += 1;
        summary.ownerWarnings += ownerWarnings;
      } else if (row.dedup_status === "matched_email") {
        const profileId =
          row.matched_profile_id ??
          profileIdByRowNumber.get(getInFileMatchRowNumber(normalized) ?? -1);

        if (!profileId) {
          throw new Error(
            `Could not resolve profile for import row ${row.row_number}`,
          );
        }

        const ownerWarnings = await updateProfileFromImportRow({
          orgId,
          importId,
          userId: user.id,
          profileId,
          normalized,
          sourceLabel,
          orgUsers: orgUserRecords,
        });
        summary.updated += 1;
        summary.ownerWarnings += ownerWarnings;
      }
    }

    const { error: completeError } = await supabase
      .from("imports")
      .update({
        status: "complete",
        metadata: {
          ...metadata,
          commit_summary: summary,
          committed_at: new Date().toISOString(),
        },
      })
      .eq("id", importId)
      .eq("org_id", orgId);

    if (completeError) {
      throw new Error(completeError.message);
    }

    return summary;
  } catch (error) {
    await supabase
      .from("imports")
      .update({
        status: "failed",
        metadata: {
          ...metadata,
          errors: [
            error instanceof Error ? error.message : "Commit failed unexpectedly",
          ],
        },
      })
      .eq("id", importId)
      .eq("org_id", orgId);

    throw error;
  }
}

export async function reopenImport(importId: string): Promise<void> {
  await requireAdmin();
  const orgId = await getOrgId();
  const supabase = await createClient();
  const importRecord = await getImportRecord(importId, orgId);
  const metadata = parseMetadata(importRecord.metadata);
  const commitSummary = metadata.commit_summary;

  if (importRecord.status !== "complete") {
    throw new Error("Only completed imports can be reopened");
  }

  if (
    !commitSummary ||
    commitSummary.created + commitSummary.updated > 0
  ) {
    throw new Error("Only imports that wrote no profiles can be reopened");
  }

  const { error } = await supabase
    .from("imports")
    .update({
      status: "processing",
      metadata: {
        ...metadata,
        commit_summary: undefined,
        committed_at: undefined,
        dedup_summary: undefined,
        errors: undefined,
      },
    })
    .eq("id", importId)
    .eq("org_id", orgId);

  if (error) {
    throw new Error(`Failed to reopen import: ${error.message}`);
  }
}

type CommitContext = {
  orgId: string;
  importId: string;
  userId: string;
  normalized: NormalizedImportRow;
  sourceLabel: string;
  orgUsers: OrgUserRecord[];
};

async function createProfileFromImportRow(
  context: CommitContext,
): Promise<{ profileId: string; ownerWarnings: number }> {
  const supabase = await createClient();
  const { orgId, normalized, importId, userId, sourceLabel, orgUsers } = context;

  const organisationName = normalized.organisation_name?.trim() || null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      org_id: orgId,
      full_name: normalized.full_name!.trim(),
      email: normalized.email ?? null,
      phone: normalized.phone ?? null,
      linkedin_url: normalized.linkedin_url ?? null,
      organisation_name: organisationName,
      organisation_name_normalised: normaliseOrganisationName(organisationName),
      occupation: normalized.occupation ?? null,
      location_city: normalized.location_city ?? null,
      location_country: normalized.location_country ?? null,
      source: "csv",
      extended: normalized.extended ?? {},
    })
    .select("id")
    .single();

  if (profileError) {
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  const ownerWarnings = await ensureRelationshipGraph({
    orgId,
    profileId: profile.id,
    importId,
    userId,
    normalized,
    sourceLabel,
    orgUsers,
  });

  return { profileId: profile.id, ownerWarnings };
}

async function updateProfileFromImportRow(
  context: CommitContext & { profileId: string },
): Promise<number> {
  const supabase = await createClient();
  const { orgId, profileId, normalized } = context;

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select(
      "email, phone, linkedin_url, organisation_name, occupation, location_city, location_country, extended",
    )
    .eq("id", profileId)
    .eq("org_id", orgId)
    .single();

  if (existingError) {
    throw new Error(`Failed to load existing profile: ${existingError.message}`);
  }

  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
  const fillIfEmpty = (
    field:
      | "email"
      | "phone"
      | "linkedin_url"
      | "organisation_name"
      | "occupation"
      | "location_city"
      | "location_country",
    value: string | undefined,
  ) => {
    const current = existing[field];
    const incoming = value?.trim();

    if (!current && incoming) {
      update[field] = incoming;
    }
  };

  fillIfEmpty("email", normalized.email);
  fillIfEmpty("phone", normalized.phone);
  fillIfEmpty("linkedin_url", normalized.linkedin_url);
  fillIfEmpty("organisation_name", normalized.organisation_name);
  fillIfEmpty("occupation", normalized.occupation);
  fillIfEmpty("location_city", normalized.location_city);
  fillIfEmpty("location_country", normalized.location_country);

  if (update.organisation_name) {
    update.organisation_name_normalised = normaliseOrganisationName(
      update.organisation_name,
    );
  }

  const mergedExtended = {
    ...(typeof existing.extended === "object" && existing.extended
      ? (existing.extended as Record<string, string>)
      : {}),
    ...(normalized.extended ?? {}),
  };

  if (Object.keys(mergedExtended).length > 0) {
    update.extended = mergedExtended;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", profileId)
      .eq("org_id", orgId);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  return ensureRelationshipGraph({
    ...context,
    profileId,
  });
}

async function ensureRelationshipGraph(input: {
  orgId: string;
  profileId: string;
  importId: string;
  userId: string;
  normalized: NormalizedImportRow;
  sourceLabel: string;
  orgUsers: OrgUserRecord[];
}): Promise<number> {
  const supabase = await createClient();
  const {
    orgId,
    profileId,
    importId,
    userId,
    normalized,
    sourceLabel,
    orgUsers,
  } = input;
  let ownerWarnings = 0;

  const relationshipStatus = (normalized.relationship_status ??
    "prospect") as RelationshipStatus;
  const relationshipType = (normalized.relationship_type ??
    "other") as RelationshipType;

  const { data: existingRelationship, error: relationshipLookupError } = await supabase
    .from("relationships")
    .select("id, status, relationship_type")
    .eq("profile_id", profileId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (relationshipLookupError) {
    throw new Error(`Failed to load relationship: ${relationshipLookupError.message}`);
  }

  let relationshipId = existingRelationship?.id;

  if (!relationshipId) {
    const { data: createdRelationship, error: createRelationshipError } = await supabase
      .from("relationships")
      .insert({
        org_id: orgId,
        profile_id: profileId,
        status: relationshipStatus,
        relationship_type: relationshipType,
      })
      .select("id")
      .single();

    if (createRelationshipError) {
      throw new Error(
        `Failed to create relationship: ${createRelationshipError.message}`,
      );
    }

    relationshipId = createdRelationship.id;
  }

  const { data: existingSource, error: sourceLookupError } = await supabase
    .from("relationship_sources")
    .select("id")
    .eq("relationship_id", relationshipId)
    .eq("source_type", "csv_import")
    .eq("source_id", importId)
    .maybeSingle();

  if (sourceLookupError) {
    throw new Error(`Failed to check relationship source: ${sourceLookupError.message}`);
  }

  if (!existingSource) {
    const { error: sourceError } = await supabase.from("relationship_sources").insert({
      org_id: orgId,
      relationship_id: relationshipId,
      source_type: "csv_import",
      source_id: importId,
      source_label: sourceLabel,
      created_by: userId,
    });

    if (sourceError) {
      throw new Error(`Failed to create relationship source: ${sourceError.message}`);
    }
  }

  const ownerRef = normalized.owner_email?.trim();
  if (ownerRef) {
    const ownerUserId = resolveOrgUserId(ownerRef, orgUsers);

    if (!ownerUserId) {
      ownerWarnings += 1;
    } else {
      const ownerStrength = (normalized.owner_strength ?? "unknown") as OwnerStrength;

      await supabase
        .from("relationship_owners")
        .update({ is_primary: false })
        .eq("relationship_id", relationshipId)
        .eq("org_id", orgId);

      const { error: ownerError } = await supabase.from("relationship_owners").upsert(
        {
          org_id: orgId,
          relationship_id: relationshipId,
          user_id: ownerUserId,
          strength: ownerStrength,
          is_primary: true,
        },
        { onConflict: "relationship_id,user_id" },
      );

      if (ownerError) {
        throw new Error(`Failed to assign owner: ${ownerError.message}`);
      }
    }
  }

  const tagNames = parseTags(normalized.tags);
  if (tagNames.length === 0) {
    return ownerWarnings;
  }

  for (const tagName of tagNames) {
    const { data: tag, error: tagLookupError } = await supabase
      .from("tags")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", tagName)
      .maybeSingle();

    if (tagLookupError) {
      throw new Error(`Failed to look up tag: ${tagLookupError.message}`);
    }

    let tagId = tag?.id;

    if (!tagId) {
      const { data: createdTag, error: createTagError } = await supabase
        .from("tags")
        .insert({
          org_id: orgId,
          name: tagName,
          category: "other",
        })
        .select("id")
        .single();

      if (createTagError) {
        throw new Error(`Failed to create tag: ${createTagError.message}`);
      }

      tagId = createdTag.id;
    }

    const { error: profileTagError } = await supabase.from("profile_tags").upsert(
      {
        org_id: orgId,
        profile_id: profileId,
        tag_id: tagId,
      },
      { onConflict: "profile_id,tag_id" },
    );

    if (profileTagError) {
      throw new Error(`Failed to link tag: ${profileTagError.message}`);
    }
  }

  return ownerWarnings;
}
