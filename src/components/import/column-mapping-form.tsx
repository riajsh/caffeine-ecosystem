"use client";

import { useState } from "react";

import {
  applyMappingAction,
  saveMappingAction,
} from "@/app/(app)/admin/import/actions";
import { ECOSYSTEM_FIELDS } from "@/lib/import/constants";
import type { ColumnMapping } from "@/lib/import/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ColumnMappingFormProps = {
  importId: string;
  headers: string[];
  mapping: ColumnMapping;
  mappingConfirmed: boolean;
};

export function ColumnMappingForm({
  importId,
  headers,
  mapping,
  mappingConfirmed,
}: ColumnMappingFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setError(null);
    const result = await saveMappingAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleApply(formData: FormData) {
    setError(null);
    const result = await applyMappingAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div>
        <h2 className="text-heading font-medium text-foreground">Column mapping</h2>
        <p className="mt-1 text-body text-muted-foreground">
          Map CSV columns to Ecosystem fields. Unmapped columns are stored on the
          profile under their original header names.
        </p>
      </div>

      <form action={handleSave} className="space-y-4">
        <input type="hidden" name="importId" value={importId} />

        {headers.map((header) => (
          <div
            key={header}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
          >
            <Label className="text-body text-foreground">{header}</Label>
            <select
              name={`map:${header}`}
              defaultValue={mapping[header] ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-body"
              disabled={mappingConfirmed}
            >
              <option value="">Do not map</option>
              {ECOSYSTEM_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                  {field.required ? " *" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}

        {!mappingConfirmed ? (
          <Button type="submit" variant="outline">
            Save mapping
          </Button>
        ) : null}
      </form>

      {!mappingConfirmed ? (
        <form action={handleApply}>
          <input type="hidden" name="importId" value={importId} />
          <Button type="submit">Confirm mapping and apply</Button>
        </form>
      ) : (
        <p className="text-body text-muted-foreground">
          Mapping confirmed. Run dedup when ready.
        </p>
      )}

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
