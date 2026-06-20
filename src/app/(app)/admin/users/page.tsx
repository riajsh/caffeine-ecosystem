import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { UsersTable } from "@/components/admin/users-table";
import { Button } from "@/components/ui/button";
import { listOrgUsers } from "@/lib/data/users";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listOrgUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description="PU team members who can sign in and hold relationship ownership."
      >
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </PageHeader>
      <div className="space-y-4 px-8 py-6">
        <p className="max-w-2xl text-body text-muted-foreground">
          Users are provisioned through Supabase Auth and the seed script. Role
          changes are manual in V1.
        </p>
        <UsersTable users={users} />
      </div>
    </>
  );
}
