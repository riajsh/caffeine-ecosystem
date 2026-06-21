import { PageHeader } from "@/components/app-shell/page-header";
import { TeamMembersList } from "@/components/admin/team-members-list";
import { listOrgUsers } from "@/lib/data/users";

export default async function TeamMembersPage() {
  const users = await listOrgUsers();

  return (
    <>
      <PageHeader
        title="Team Members"
        description="People at PU who can be assigned as Relationship Owners on profiles."
      />
      <div className="space-y-6 px-8 py-6">
        <TeamMembersList users={users} />
      </div>
    </>
  );
}
