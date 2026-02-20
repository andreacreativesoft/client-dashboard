import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ImpersonateBanner } from "@/components/impersonate-banner";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { getImpersonationStatus } from "@/lib/actions/impersonate";
import { getSelectedClientId } from "@/lib/selected-client";
import { getProfile } from "@/lib/actions/profile";
import { updateLastLogin } from "@/lib/actions/alerts";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  // Update last login timestamp (fire and forget)
  updateLastLogin().catch(() => {});

  const isAdmin = profile.role === "admin";
  const language = profile.language || "en";

  // Check if admin is impersonating a client
  const impersonation = isAdmin ? await getImpersonationStatus() : null;

  // Get selected client for data viewing (separate from impersonation)
  const selectedClientId = isAdmin ? await getSelectedClientId() : null;

  // When impersonating, hide admin features
  const showAsAdmin = isAdmin && !impersonation;

  return (
    <LanguageProvider language={language}>
      <SidebarProvider>
        <div className="flex min-h-dvh">
          {/* Desktop sidebar */}
          <Sidebar isAdmin={showAsAdmin} className="hidden md:flex" />

          {/* Main content */}
          <div className="flex flex-1 flex-col">
            <Header
              userName={profile.full_name || profile.email || "User"}
              isAdmin={isAdmin}
              avatarUrl={profile.avatar_url}
              showClientSwitcher={isAdmin && !impersonation}
              selectedClientId={selectedClientId}
            />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
          </div>

          {/* Mobile bottom nav */}
          <MobileNav isAdmin={showAsAdmin} className="md:hidden" />

          {/* Impersonation banner */}
          {impersonation && (
            <ImpersonateBanner clientName={impersonation.clientName} />
          )}
        </div>
      </SidebarProvider>
    </LanguageProvider>
  );
}
