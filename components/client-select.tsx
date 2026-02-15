"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  business_name: string;
}

interface ClientSelectProps {
  clients: Client[];
  selectedClientId?: string | null;
}

export function ClientSelect({ clients, selectedClientId }: ClientSelectProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const clientId = e.target.value || null;
    setSwitching(true);
    try {
      const { selectClientAction } = await import("@/lib/actions/clients");
      await selectClientAction(clientId);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  if (clients.length === 0) return null;

  return (
    <select
      value={selectedClientId || ""}
      onChange={handleChange}
      disabled={switching}
      className="h-9 max-w-[180px] truncate rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    >
      <option value="">All Clients</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.business_name}
        </option>
      ))}
    </select>
  );
}
