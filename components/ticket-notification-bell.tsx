"use client";

import Link from "next/link";

interface TicketNotificationBellProps {
  count: number;
}

export function TicketNotificationBell({ count }: TicketNotificationBellProps) {
  if (count === 0) return null;

  return (
    <Link
      href="/tickets?status=open"
      className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6"
      title={`${count} open ticket${count !== 1 ? "s" : ""}`}
    >
      {/* Bell icon */}
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
      {/* Badge */}
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}
