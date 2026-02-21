"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ClientSelect } from "@/components/client-select";
import { ClientSwitcher } from "@/components/client-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/lib/i18n/language-context";

interface HeaderProps {
  userName: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
  showClientSwitcher?: boolean;
  selectedClientId?: string | null;
}

interface Client {
  id: string;
  business_name: string;
}

export function Header({ userName, isAdmin, avatarUrl, showClientSwitcher, selectedClientId }: HeaderProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (showClientSwitcher) {
      const supabase = createClient();
      supabase
        .from("clients")
        .select("id, business_name")
        .order("business_name")
        .then(({ data }) => {
          if (data) setClients(data);
        });
    }
  }, [showClientSwitcher]);

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
        {showClientSwitcher && clients.length > 0 && (
          <>
            <ClientSelect clients={clients} selectedClientId={selectedClientId} />
            <ClientSwitcher clients={clients} />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">

        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-none">{userName}</p>
          {isAdmin && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t("header.admin")}</p>
          )}
        </div>

        <Link
          href="/settings"
          className="cursor-pointer transition-opacity hover:opacity-80"
          title={t("header.edit_profile")}
        >
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
              alt={userName}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                isAdmin
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {initials || "U"}
            </div>
          )}
        </Link>

        <LanguageSwitcher />
        <ThemeToggle />

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="h-9 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {signingOut ? "..." : t("header.sign_out")}
        </button>
      </div>
    </header>
  );
}
