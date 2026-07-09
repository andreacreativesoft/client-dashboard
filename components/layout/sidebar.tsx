"use client";

import {
    Building2,
    Globe,
    Home,
    LineChart,
    Link2,
    LogOut,
    MessageSquare,
    Search,
    ShieldCheck,
    Store,
    Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SiteSwitcher } from "@/components/layout/site-switcher";
import { Avatar } from "@/components/ui/avatar";
import type { NavBadgeCounts } from "@/lib/actions/nav-badges";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { href: string; labelKey: TranslationKey; exact?: boolean; icon: React.ReactNode };
type NavGroup = { labelKey: TranslationKey; items: NavItem[] };

const iconClass = "size-[18px] shrink-0";

/** Accueil : épinglé tout en haut, hors catégorie (vue client). */
const clientHome: NavItem = {
    href: "/dashboard",
    labelKey: "nav.overview",
    icon: <Home className={iconClass} />,
};

const clientGroups: NavGroup[] = [
    {
        labelKey: "nav.grp_site",
        items: [
            {
                href: "/analytics",
                labelKey: "nav.google_analytics",
                icon: <LineChart className={iconClass} />,
            },
            {
                href: "/search-console",
                labelKey: "nav.search_console",
                icon: <Search className={iconClass} />,
            },
            {
                href: "/business-profile",
                labelKey: "nav.google_business",
                icon: <Store className={iconClass} />,
            },
        ],
    },
    {
        labelKey: "nav.grp_activity",
        items: [
            { href: "/submissions", labelKey: "nav.leads", icon: <Users className={iconClass} /> },
            {
                href: "/tickets",
                labelKey: "nav.tickets",
                icon: <MessageSquare className={iconClass} />,
            },
        ],
    },
];

const agencyGroups: NavGroup[] = [
    {
        labelKey: "nav.grp_agency",
        items: [
            {
                href: "/admin",
                labelKey: "nav.admin",
                exact: true,
                icon: <ShieldCheck className={iconClass} />,
            },
            {
                href: "/admin/tickets",
                labelKey: "nav.tickets",
                icon: <MessageSquare className={iconClass} />,
            },
        ],
    },
    {
        labelKey: "nav.grp_management",
        items: [
            {
                href: "/admin/clients",
                labelKey: "nav.clients",
                icon: <Building2 className={iconClass} />,
            },
            {
                href: "/admin/websites",
                labelKey: "nav.websites",
                icon: <Globe className={iconClass} />,
            },
            { href: "/admin/users", labelKey: "nav.users", icon: <Users className={iconClass} /> },
        ],
    },
];

const BADGE_MAP: Record<string, keyof NavBadgeCounts> = {
    "/submissions": "newLeads",
    "/tickets": "openTickets",
    "/admin/tickets": "openTickets",
};

export function Sidebar({
    view,
    badgeCounts,
    className,
    userName,
    userBusinessName,
    avatarUrl,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const groups = view === "agency" ? agencyGroups : clientGroups;

    // Section basse discrète, commune aux deux vues : accès centralisé aux
    // « Comptes connectés » (+ futures options utilitaires). La destination
    // diffère selon l'espace (agence vs client).
    const utilityItems: NavItem[] = [
        {
            href: view === "agency" ? "/admin/connections" : "/settings/connections",
            labelKey: "nav.connections",
            icon: <Link2 className="size-4 shrink-0" />,
        },
    ];

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    }

    function isActive(href: string, exact?: boolean) {
        if (exact) return pathname === href;
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    }

    function renderItem(item: NavItem) {
        const active = isActive(item.href, item.exact);
        const badgeKey = BADGE_MAP[item.href];
        const badgeCount = badgeKey && badgeCounts ? badgeCounts[badgeKey] : 0;
        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                    active
                        ? "bg-brand-dark text-white"
                        : "text-white/70 hover:bg-brand-dark/60 hover:text-white",
                )}>
                {item.icon}
                <span className="truncate">{t(item.labelKey)}</span>
                {badgeCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-xs font-bold text-white">
                        {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                )}
            </Link>
        );
    }

    return (
        <aside
            className={cn(
                "sticky top-0 flex h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-brand",
                className,
            )}>
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-5">
                <Globe className="size-6 shrink-0 text-white" />
                <span className="text-[20px] font-bold tracking-tight text-white">
                    Votre Site Pro
                </span>
            </div>

            {/* Nav groups */}
            <nav className="flex flex-1 flex-col gap-6 px-3 py-2">
                {/* Accueil : tout en haut, hors catégorie (vue client) */}
                {view === "client" && (
                    <div className="flex flex-col gap-1">{renderItem(clientHome)}</div>
                )}

                {groups.map((group) => (
                    <div key={group.labelKey} className="flex flex-col gap-1">
                        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                            {t(group.labelKey)}
                        </p>
                        {/* Sélecteur de site, intégré à la section « Mon site » */}
                        {view === "client" && group.labelKey === "nav.grp_site" && (
                            <SiteSwitcher variant="sidebar" />
                        )}
                        {group.items.map((item) => renderItem(item))}
                    </div>
                ))}
            </nav>

            {/* Section utilitaire discrète, alignée en bas (au-dessus du profil) */}
            <div className="flex flex-col gap-0.5 px-3 py-2">
                {utilityItems.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                                active
                                    ? "bg-brand-dark text-white"
                                    : "text-white/55 hover:bg-brand-dark/60 hover:text-white/90",
                            )}>
                            {item.icon}
                            <span className="truncate">{t(item.labelKey)}</span>
                        </Link>
                    );
                })}
            </div>

            {/* User footer */}
            {userName && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 p-3">
                    <Link
                        href="/settings"
                        title={t("nav.settings")}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                        <Avatar
                            name={userName}
                            src={avatarUrl}
                            size="md"
                            className="border border-white/20"
                        />
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold leading-tight text-white">
                                {userName}
                            </span>
                            {userBusinessName && (
                                <span className="truncate text-xs leading-tight text-white/60">
                                    {userBusinessName}
                                </span>
                            )}
                        </div>
                    </Link>
                    <button
                        onClick={handleSignOut}
                        type="button"
                        title={t("header.sign_out")}
                        aria-label={t("header.sign_out")}
                        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-brand-dark hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                        <LogOut className="size-5" />
                    </button>
                </div>
            )}
        </aside>
    );
}

interface SidebarProps {
    /** "agency" shows the admin management menu; "client" shows the business dashboard menu. */
    view: "agency" | "client";
    badgeCounts?: NavBadgeCounts;
    className?: string;
    userName?: string;
    userBusinessName?: string;
    avatarUrl?: string | null;
}
