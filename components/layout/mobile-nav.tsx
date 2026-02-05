"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  isAdmin: boolean;
  className?: string;
}

const mobileItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/leads", label: "Leads" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav({ isAdmin, className }: MobileNavProps) {
  const pathname = usePathname();

  const items = isAdmin
    ? [...mobileItems, { href: "/admin", label: "Admin" }]
    : mobileItems;

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card",
        className
      )}
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
