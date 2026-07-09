import { redirect } from "next/navigation";

import { ImpersonateBanner } from "@/components/impersonate-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SelectedWebsiteProvider } from "@/components/layout/selected-website-context";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { SupportChat } from "@/components/support-chat";
import { updateLastLogin } from "@/lib/actions/alerts";
import { getClientWebsites } from "@/lib/actions/analytics";
import { getImpersonationStatus } from "@/lib/actions/impersonate";
import { getNavBadgeCounts } from "@/lib/actions/nav-badges";
import { getProfile } from "@/lib/actions/profile";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { getActiveClientId } from "@/lib/view-context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const profile = await getProfile();

    if (!profile) {
        redirect("/login");
    }

    // Update last login timestamp (fire and forget)
    updateLastLogin().catch(() => {});

    const isAdmin = profile.role === "admin";
    const language = profile.language || "fr-BE";

    // Check if admin is impersonating a client
    const impersonation = isAdmin ? await getImpersonationStatus() : null;

    // Agency mode = admin browsing their own agency space (not impersonating).
    // Anything else (real client, or admin who entered a client) is the client view.
    const agencyView = isAdmin && !impersonation;
    const view = agencyView ? "agency" : "client";

    // Fetch badge counts for navigation
    const badgeCounts = await getNavBadgeCounts();

    // Client of the current user for the chat widget (clients only).
    // One account = one business → resolved by the single shared helper.
    const userClientId = isAdmin ? null : await getActiveClientId();

    // Global site switcher: the active client's websites + the client id used as
    // the localStorage scope. Empty in agency mode (no active client).
    const activeClientId = await getActiveClientId();
    const websites = await getClientWebsites();

    return (
        <LanguageProvider language={language}>
            <SidebarProvider>
                <SelectedWebsiteProvider websites={websites} clientId={activeClientId}>
                    <div className="flex min-h-dvh bg-page">
                        {/* Desktop sidebar */}
                        <Sidebar
                            view={view}
                            badgeCounts={badgeCounts}
                            className="hidden md:flex"
                            userName={
                                impersonation
                                    ? impersonation.clientName
                                    : profile.full_name || profile.email || "User"
                            }
                            avatarUrl={impersonation ? null : profile.avatar_url}
                        />

                        {/* Main content */}
                        <main className="min-w-0 flex-1 pb-20 md:pb-0">
                            <SiteSwitcher variant="bar" />
                            {children}
                        </main>

                        {/* Mobile bottom nav */}
                        <MobileNav view={view} badgeCounts={badgeCounts} className="md:hidden" />

                        {/* Support chat widget — real clients only (admins handle support in the agency space) */}
                        {!isAdmin && (
                            <SupportChat
                                userId={profile.id}
                                userRole={profile.role}
                                clientId={userClientId}
                                openTicketCount={badgeCounts.openTickets}
                            />
                        )}

                        {/* Impersonation banner */}
                        {impersonation && (
                            <ImpersonateBanner clientName={impersonation.clientName} />
                        )}
                    </div>
                </SelectedWebsiteProvider>
            </SidebarProvider>
        </LanguageProvider>
    );
}
