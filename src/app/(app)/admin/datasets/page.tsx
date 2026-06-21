import { AdminPage } from "@/components/admin/admin-page";
import { DatasetCards } from "@/components/admin/dataset-cards";
import { ImportUploadForm } from "@/components/import/import-upload-form";
import { listImports } from "@/lib/data/imports";

export default async function DatasetsPage() {
  const imports = await listImports();

  return (
    <AdminPage
      title="Datasets"
      description={`${imports.length} dataset${imports.length === 1 ? "" : "s"} imported`}
      contentClassName="space-y-8 px-8 py-6"
    >
      <ImportUploadForm />
      <DatasetCards imports={imports} />
    </AdminPage>
  );
}
