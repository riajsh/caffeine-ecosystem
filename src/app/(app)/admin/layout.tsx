import { AdminSubNav } from "@/components/admin/admin-subnav";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AdminSubNav />
      {children}
    </div>
  );
}
