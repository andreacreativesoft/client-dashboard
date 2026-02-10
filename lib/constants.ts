import type { LeadStatus, UserRole } from "@/types/database";

export const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-success text-success-foreground" },
  { value: "contacted", label: "Contacted", color: "bg-warning text-warning-foreground" },
  { value: "done", label: "Done", color: "bg-muted text-muted-foreground" },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "client", label: "Client" },
];

export const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

export const APP_NAME = "Client Dashboard";

export const NAV_ITEMS = {
  dashboard: [
    { href: "/dashboard", label: "Overview", icon: "LayoutDashboard" },
    { href: "/leads", label: "Leads", icon: "Users" },
    { href: "/analytics", label: "Google Analytics", icon: "BarChart3" },
    { href: "/search-console", label: "Search Console", icon: "Search" },
    { href: "/business-profile", label: "Google Business", icon: "Building" },
    { href: "/settings", label: "Settings", icon: "Settings" },
  ],
  admin: [
    { href: "/admin", label: "Admin", icon: "Shield" },
    { href: "/admin/clients", label: "Clients", icon: "Building2" },
    { href: "/admin/users", label: "Users", icon: "UserCog" },
    { href: "/admin/websites", label: "Websites", icon: "Globe" },
  ],
} as const;
