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
import { getNavBadgeCounts } from "@/lib/actions/nav-badges";
import { SupportChat } from "@/components/support-chat";

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

  // Fetch badge counts for navigation
  const badgeCounts = await getNavBadgeCounts();

  // Get user's first client_id for the chat widget (clients only)
  let userClientId: string | null = null;
  if (!isAdmin) {
    const { createClient: createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const { data: clientUser } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", profile.id)
      .limit(1)
      .single();
    userClientId = clientUser?.client_id ?? null;
  }

  // When impersonating, hide admin features
  const showAsAdmin = isAdmin && !impersonation;

  return (
    <LanguageProvider language={language}>
      <SidebarProvider>
        <div className="flex min-h-dvh">
          {/* Desktop sidebar */}
          <Sidebar isAdmin={showAsAdmin} badgeCounts={badgeCounts} className="hidden md:flex" />

          {/* Main content */}
          <div className="flex flex-1 flex-col">
            <Header
              userName={impersonation ? impersonation.clientName : (profile.full_name || profile.email || "User")}
              isAdmin={isAdmin && !impersonation}
              avatarUrl={impersonation ? null : profile.avatar_url}
              showClientSwitcher={isAdmin && !impersonation}
              selectedClientId={selectedClientId}
            />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
          </div>

          {/* Mobile bottom nav */}
          <MobileNav isAdmin={showAsAdmin} badgeCounts={badgeCounts} className="md:hidden" />

          {/* Support chat widget */}
          <SupportChat
            userId={profile.id}
            userRole={profile.role}
            clientId={userClientId}
            openTicketCount={badgeCounts.openTickets}
          />

          {/* Impersonation banner */}
          {impersonation && (
            <ImpersonateBanner clientName={impersonation.clientName} />
          )}
        </div>
      </SidebarProvider>
    </LanguageProvider>
  );
}
