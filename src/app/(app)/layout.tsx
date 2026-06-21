import { AppProviders } from "@/components/app-shell/app-providers";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { requireUser } from "@/lib/auth/session";
import { findNavProfileIdForEmail } from "@/lib/data/users";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const profileId = await findNavProfileIdForEmail(user.email);

  return (
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background">
      <AppSidebar user={user} profileId={profileId} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <AppProviders>{children}</AppProviders>
      </div>
    </div>
  );
}
