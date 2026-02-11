"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { startImpersonation, stopImpersonation } from "@/lib/actions/impersonate";

interface Client {
  id: string;
  business_name: string;
}

interface ClientSwitcherProps {
  clients: Client[];
  impersonatingClientId?: string | null;
  impersonatingClientName?: string | null;
}

export function ClientSwitcher({ clients, impersonatingClientId, impersonatingClientName }: ClientSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [viewAsLoading, setViewAsLoading] = useState<string | null>(null);

  async function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const clientId = e.target.value;
    if (!clientId) {
      // "All Clients" selected — stop impersonation
      setSwitching(true);
      await stopImpersonation();
      router.refresh();
      setSwitching(false);
      return;
    }
    setSwitching(true);
    const result = await startImpersonation(clientId);
    if (result.success) {
      router.refresh();
    }
    setSwitching(false);
  }

  async function handleViewAs(clientId: string) {
    setViewAsLoading(clientId);
    const result = await startImpersonation(clientId);
    if (result.success) {
      setViewAsOpen(false);
      router.refresh();
    }
    setViewAsLoading(null);
  }

  if (clients.length === 0) return null;

  return (
    <>
      {/* Client selector dropdown */}
      <select
        value={impersonatingClientId || ""}
        onChange={handleSelectChange}
        disabled={switching}
        className="h-9 max-w-[200px] truncate rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
      >
        <option value="">All Clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.business_name}
          </option>
        ))}
      </select>

      {/* View as Client button */}
      <button
        onClick={() => setViewAsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        title="View as Client"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
        </svg>
        <span className="hidden sm:inline">View as Client</span>
      </button>

      {/* View as Client modal */}
      <Modal open={viewAsOpen} onClose={() => setViewAsOpen(false)} title="View as Client">
        <p className="mb-4 text-sm text-muted-foreground">
          Select a client to view the dashboard as they would see it. Admin-only sections will be hidden.
        </p>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => handleViewAs(client.id)}
              disabled={viewAsLoading !== null}
              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium">{client.business_name}</span>
              {viewAsLoading === client.id ? (
                <span className="text-sm text-muted-foreground">Switching...</span>
              ) : (
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => setViewAsOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
