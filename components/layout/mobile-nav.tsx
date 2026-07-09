"use client";

import { BarChart3, Building2, Globe, Home, MessageSquare, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavBadgeCounts } from "@/lib/actions/nav-badges";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

interface MobileNavProps {
    /** "agency" shows the admin management menu; "client" shows the business dashboard menu. */
    view: "agency" | "client";
    badgeCounts?: NavBadgeCounts;
    className?: string;
}

type MobileItem = {
    href: string;
    labelKey: TranslationKey;
    exact?: boolean;
    icon: React.ReactNode;
};

const BADGE_MAP: Record<string, keyof NavBadgeCounts> = {
    "/submissions": "newLeads",
    "/tickets": "openTickets",
    "/admin/tickets": "openTickets",
};

const icons = {
    grid: <Home className="h-5 w-5" />,
    users: <Users className="h-5 w-5" />,
    bars: <BarChart3 className="h-5 w-5" />,
    tickets: <MessageSquare className="h-5 w-5" />,
    building: <Building2 className="h-5 w-5" />,
    globe: <Globe className="h-5 w-5" />,
    gear: <Settings className="h-5 w-5" />,
};

const clientItems: MobileItem[] = [
    { href: "/dashboard", labelKey: "nav.home", icon: icons.grid },
    { href: "/submissions", labelKey: "nav.leads", icon: icons.users },
    { href: "/analytics", labelKey: "nav.ga4", icon: icons.bars },
    { href: "/tickets", labelKey: "nav.tickets", icon: icons.tickets },
    { href: "/settings", labelKey: "nav.settings", icon: icons.gear },
];

const agencyItems: MobileItem[] = [
    { href: "/admin", labelKey: "nav.admin", exact: true, icon: icons.grid },
    { href: "/admin/clients", labelKey: "nav.clients", icon: icons.building },
    { href: "/admin/tickets", labelKey: "nav.tickets", icon: icons.tickets },
    { href: "/admin/websites", labelKey: "nav.websites", icon: icons.globe },
    { href: "/admin/users", labelKey: "nav.users", icon: icons.users },
];

export function MobileNav({ view, badgeCounts, className }: MobileNavProps) {
    const pathname = usePathname();
    const { t } = useLanguage();

    const items = view === "agency" ? agencyItems : clientItems;

    return (
        <nav
            className={cn(
                "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card",
                className,
            )}>
            <div className="flex items-center justify-around">
                {items.map((item) => {
                    const active = item.exact
                        ? pathname === item.href
                        : item.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname.startsWith(item.href);
                    const badgeKey = BADGE_MAP[item.href];
                    const badgeCount = badgeKey && badgeCounts ? badgeCounts[badgeKey] : 0;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                                active ? "text-foreground" : "text-muted-foreground",
                            )}>
                            <span className="relative">
                                {item.icon}
                                {badgeCount > 0 && (
                                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                            </span>
                            {t(item.labelKey)}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
