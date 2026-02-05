"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userName: string;
  isAdmin: boolean;
}

export function Header({ userName, isAdmin }: HeaderProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold md:hidden">Dashboard</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-none">{userName}</p>
          {isAdmin && (
            <p className="mt-0.5 text-xs text-muted-foreground">Admin</p>
          )}
        </div>

        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
            isAdmin
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
          )}
        >
          {initials || "U"}
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="h-9 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {signingOut ? "..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
