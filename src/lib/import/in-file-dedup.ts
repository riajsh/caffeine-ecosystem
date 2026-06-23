import type { NormalizedImportRow } from "@/lib/import/types";

export const DEDUP_IN_FILE_ROW_NUMBER = "_dedup_in_file_row_number";
export const DEDUP_MERGE_IN_FILE_ROW_NUMBER = "_dedup_merge_in_file_row_number";
export const DEDUP_CANDIDATE_PROFILE_IDS = "_dedup_candidate_profile_ids";

export function getCandidateProfileIds(
  normalized: NormalizedImportRow,
): string[] {
  const value = normalized[DEDUP_CANDIDATE_PROFILE_IDS];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
}

export function withCandidateProfileIds(
  normalized: NormalizedImportRow,
  profileIds: string[],
): NormalizedImportRow {
  return {
    ...normalized,
    [DEDUP_CANDIDATE_PROFILE_IDS]: [...new Set(profileIds)],
  };
}

export function getInFileMatchRowNumber(
  normalized: NormalizedImportRow,
): number | null {
  const value =
    normalized[DEDUP_MERGE_IN_FILE_ROW_NUMBER] ??
    normalized[DEDUP_IN_FILE_ROW_NUMBER];

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

export function withInFileMatchRowNumber(
  normalized: NormalizedImportRow,
  rowNumber: number,
): NormalizedImportRow {
  return {
    ...normalized,
    [DEDUP_IN_FILE_ROW_NUMBER]: rowNumber,
  };
}

export function withMergeInFileRowNumber(
  normalized: NormalizedImportRow,
  rowNumber: number,
): NormalizedImportRow {
  return {
    ...normalized,
    [DEDUP_MERGE_IN_FILE_ROW_NUMBER]: rowNumber,
  };
}
