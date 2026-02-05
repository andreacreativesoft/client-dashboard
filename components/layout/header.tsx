"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  userName: string;
  isAdmin: boolean;
}

export function Header({ userName, isAdmin }: HeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile logo - hidden on desktop where sidebar shows it */}
        <span className="text-lg font-bold md:hidden">Dashboard</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{userName}</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">Admin</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="h-9 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
