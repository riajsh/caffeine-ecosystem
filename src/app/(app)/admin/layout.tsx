import { requireAdmin } from "@/lib/auth/session";

export const maxDuration = 300;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
