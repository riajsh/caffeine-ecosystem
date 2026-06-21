import { CreateTagForm } from "@/components/tags/create-tag-form";
import { TagsTable } from "@/components/tags/tags-table";
import { PageHeader } from "@/components/app-shell/page-header";
import { listOrgTags } from "@/lib/data/tags";

export default async function AdminTagsPage() {
  const tags = await listOrgTags();
  const tagsInUse = tags.filter((tag) => tag.profileCount > 0).length;

  return (
    <>
      <PageHeader
        title="Tags"
        description={`${tagsInUse} tags in use · ${tags.length} total`}
      />
      <div className="space-y-6 px-8 py-6">
        <CreateTagForm />
        <TagsTable tags={[...tags].sort((a, b) => b.profileCount - a.profileCount || a.name.localeCompare(b.name))} />
      </div>
    </>
  );
}
