"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { uploadImportAction } from "@/app/(app)/admin/import/actions";
import { IMPORT_SOURCES } from "@/lib/import/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ImportUploadForm() {
  const router = useRouter();
  const [source, setSource] = useState<string>("csv");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);

    try {
      formData.set("source", source);
      const result = await uploadImportAction(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.importId) {
        router.push(`/admin/import/${result.importId}`);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger id="source" className="w-full max-w-xs">
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            {IMPORT_SOURCES.map((option) => (
              <SelectItem key={option} value={option} className="capitalize">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">CSV file</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <p className="text-caption text-muted-foreground">
          CSV only. Max 10 MB and 5,000 rows.
        </p>
      </div>

      {error ? (
        <p className="text-body text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading…" : "Upload and parse"}
      </Button>
    </form>
  );
}
