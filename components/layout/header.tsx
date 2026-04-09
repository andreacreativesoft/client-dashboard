"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ClientSelect } from "@/components/client-select";
import { ClientSwitcher } from "@/components/client-switcher";
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
  const { t } = useLanguage();
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

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-[#F9F9F9] px-4 md:px-6">
      <div className="flex items-center gap-3">
        {showClientSwitcher && clients.length > 0 && (
          <>
            <ClientSelect clients={clients} selectedClientId={selectedClientId} />
            <ClientSwitcher clients={clients} />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <span className="text-xs text-muted-foreground">{t("header.admin")}</span>
        )}
      </div>
    </header>
  );
}
