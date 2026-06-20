import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { CreateTagForm } from "@/components/tags/create-tag-form";
import { TagsTable } from "@/components/tags/tags-table";
import { listOrgTags } from "@/lib/data/tags";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminTagsPage() {
  await requireAdmin();
  const tags = await listOrgTags();

  return (
    <>
      <PageHeader
        title="Tags"
        description="Sector, role, and interest labels used to classify profiles and power search filters."
      >
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </PageHeader>
      <div className="space-y-6 px-8 py-6">
        <CreateTagForm />
        <TagsTable tags={tags} />
      </div>
    </>
  );
}
