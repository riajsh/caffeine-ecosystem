import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { ImportUploadForm } from "@/components/import/import-upload-form";
import { ImportsTable } from "@/components/import/imports-table";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { listImports } from "@/lib/data/imports";

export default async function ImportListPage() {
  await requireAdmin();
  const imports = await listImports();

  return (
    <>
      <PageHeader
        title="Import"
        description="Upload CSV files, map columns, review dedup matches, and commit to the graph."
      >
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </PageHeader>

      <div className="space-y-8 px-8 py-6">
        <ImportUploadForm />
        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">
            Import history
          </h2>
          <p className="text-body text-muted-foreground">
            Processing means uploaded but not committed yet. Delete duplicates and
            keep one import through to commit.
          </p>
          <ImportsTable imports={imports} />
        </section>
      </div>
    </>
  );
}
