import { DatasetCards } from "@/components/admin/dataset-cards";
import { PageHeader } from "@/components/app-shell/page-header";
import { ImportUploadForm } from "@/components/import/import-upload-form";
import { listImports } from "@/lib/data/imports";

export default async function DatasetsPage() {
  const imports = await listImports();

  return (
    <>
      <PageHeader
        title="Datasets"
        description={`${imports.length} dataset${imports.length === 1 ? "" : "s"} imported`}
      />
      <div className="space-y-8 px-8 py-6">
        <ImportUploadForm />
        <DatasetCards imports={imports} />
      </div>
    </>
  );
}
