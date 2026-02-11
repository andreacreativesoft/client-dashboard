"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { startImpersonation } from "@/lib/actions/impersonate";

interface Client {
  id: string;
  business_name: string;
}

interface ClientSwitcherProps {
  clients: Client[];
  impersonatingClientName?: string | null;
}

export function ClientSwitcher({ clients, impersonatingClientName }: ClientSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(clientId: string) {
    setLoading(clientId);
    const result = await startImpersonation(clientId);

    if (result.success) {
      setIsOpen(false);
      router.refresh();
    }
    setLoading(null);
  }

  if (clients.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
          impersonatingClientName
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground"
        )}
        title={impersonatingClientName ? `Viewing as: ${impersonatingClientName}` : "Select Client"}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
        </svg>
        <span className="hidden sm:inline max-w-[200px] truncate">
          {impersonatingClientName || "Select Client"}
        </span>
        <svg className="h-3 w-3 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Select Client">
        <p className="mb-4 text-sm text-muted-foreground">
          Select a client to view their leads, analytics, and reports.
          {impersonatingClientName && (
            <> Currently viewing: <strong>{impersonatingClientName}</strong></>
          )}
        </p>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => handleSelect(client.id)}
              disabled={loading !== null}
              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium">{client.business_name}</span>
              {loading === client.id ? (
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
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
