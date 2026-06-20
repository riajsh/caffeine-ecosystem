import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return (
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background">
      <AppSidebar user={user} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
