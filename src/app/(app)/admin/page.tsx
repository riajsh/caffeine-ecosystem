import Link from "next/link";

import {
  InferAllCoAttendanceButton,
  InferSameCompanyButton,
} from "@/components/admin/infer-all-co-attendance-button";
import { DeployChecklist } from "@/components/admin/deploy-checklist";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { getDeployChecklist } from "@/lib/deploy/checklist";

export default async function AdminPage() {
  await requireAdmin();
  const deployChecks = getDeployChecklist();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Import data, manage review queues, and configure the workspace."
      />
      <div className="space-y-6 px-8 py-6">
        <DeployChecklist items={deployChecks} />

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Import</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Upload CSV exports from Clay, Airtable, or other tools. Map columns,
            review dedup matches, and commit profiles into the graph.
          </p>
          <Button asChild>
            <Link href="/admin/import">Open import</Link>
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Tags</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Create sector, role, and interest labels. Assign them on profile
            detail pages and filter the profiles list.
          </p>
          <Button asChild>
            <Link href="/admin/tags">Manage tags</Link>
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Users</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            View team members, emails, and roles for the workspace.
          </p>
          <Button asChild>
            <Link href="/admin/users">View users</Link>
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading font-medium text-foreground">Inference</h2>
          <p className="max-w-2xl text-body text-muted-foreground">
            Infer profile-to-profile connections from shared event attendance
            and normalised company names. Co-attendance also runs automatically
            when attendees are added.
          </p>
          <div className="flex flex-wrap gap-3">
            <InferAllCoAttendanceButton />
            <InferSameCompanyButton />
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-heading font-medium text-foreground">Deferred</h2>
          <ul className="list-disc space-y-1 pl-5 text-body text-muted-foreground">
            <li>Email participant review queue (requires Gmail sync)</li>
          </ul>
        </section>
      </div>
    </>
  );
}
