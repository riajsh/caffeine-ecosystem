import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { ColumnMappingForm } from "@/components/import/column-mapping-form";
import { DedupSummaryPanel } from "@/components/import/dedup-summary-panel";
import { ImportCommitPanel } from "@/components/import/import-commit-panel";
import { ImportDeleteButton } from "@/components/import/import-delete-button";
import { ImportProfileBackfillButton } from "@/components/import/import-profile-backfill-button";
import { ImportPreviewTable } from "@/components/import/import-preview-table";
import { ImportStatusBadge } from "@/components/import/import-status-badge";
import { SoftMatchReview } from "@/components/import/soft-match-review";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { getImportDetail } from "@/lib/data/imports";
import { formatInteractionDate } from "@/lib/format/date";

type ImportDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImportDetailPage({ params }: ImportDetailPageProps) {
  await requireAdmin();
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const detail = await getImportDetail(id);
  const mapping = detail.metadata.column_mapping ?? {};

  return (
    <>
      <PageHeader
        title={detail.filename}
        description={`${detail.source} · ${detail.rowCount} rows · uploaded ${formatInteractionDate(detail.createdAt)} by ${detail.createdByName} · ${detail.statusHint}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <ImportStatusBadge status={detail.status} />
          {detail.canDelete ? (
            <ImportDeleteButton importId={detail.id} filename={detail.filename} />
          ) : null}
          <Button asChild variant="outline">
            <Link href="/admin/import">All imports</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-8 px-8 py-6">
        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Preview</h2>
          <p className="text-body text-muted-foreground">
            First {detail.previewRows.length} rows as parsed from the file.
          </p>
          <ImportPreviewTable rows={detail.previewRows} />
        </section>

        {detail.status !== "complete" ? (
          <>
            <ColumnMappingForm
              importId={detail.id}
              headers={detail.headers}
              mapping={mapping}
              mappingConfirmed={Boolean(detail.metadata.mapping_confirmed)}
            />

            <DedupSummaryPanel
              importId={detail.id}
              summary={detail.dedupSummary}
              mappingConfirmed={Boolean(detail.metadata.mapping_confirmed)}
            />

            <SoftMatchReview importId={detail.id} rows={detail.softMatchRows} />
          </>
        ) : null}

        <ImportCommitPanel detail={detail} />

        {detail.status === "complete" ? (
          <ImportProfileBackfillButton
            importId={detail.id}
            previousSummary={
              detail.metadata.backfill_summary ??
              (detail.metadata.owner_backfill_summary
                ? {
                    profilesUpdated: 0,
                    relationshipsUpdated: 0,
                    ownersAssigned: detail.metadata.owner_backfill_summary.assigned,
                    ownersUnresolved:
                      detail.metadata.owner_backfill_summary.unresolved,
                    tagsLinked: 0,
                    skipped: detail.metadata.owner_backfill_summary.skipped,
                  }
                : null)
            }
          />
        ) : null}

        {detail.metadata.storage_warning ? (
          <p className="text-caption text-muted-foreground">
            Original file was not stored: {detail.metadata.storage_warning}
          </p>
        ) : null}
      </div>
    </>
  );
}
