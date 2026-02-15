"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientForm } from "./client-form";
import { WebsiteForm } from "./[id]/website-form";
import { deleteClientAction } from "@/lib/actions/clients";
import type { Client } from "@/types/database";

interface ClientsListProps {
  clients: Client[];
}

export function ClientsList({ clients }: ClientsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [websiteFormClientId, setWebsiteFormClientId] = useState<string | null>(null);

  function handleEdit(client: Client) {
    setEditingClient(client);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditingClient(null);
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Delete "${client.business_name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(client.id);
    const result = await deleteClientAction(client.id);
    setDeletingId(null);

    if (!result.success) {
      alert(result.error || "Failed to delete client");
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button onClick={() => setFormOpen(true)}>Add Client</Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No clients yet. Click &quot;Add Client&quot; to create your first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-lg font-bold hover:underline"
                    >
                      {client.business_name}
                    </Link>
                    {client.notes && (
                      <div className="group relative">
                        <svg
                          className="h-4 w-4 cursor-help text-muted-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                          />
                        </svg>
                        <div className="pointer-events-none absolute left-0 top-6 z-50 hidden w-64 rounded-lg border border-border bg-card p-3 text-sm shadow-lg group-hover:block">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Internal Notes
                          </p>
                          <p className="whitespace-pre-wrap text-foreground">
                            {client.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {(client.contact_email || client.contact_phone) && (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {client.contact_email && (
                        <span>{client.contact_email}</span>
                      )}
                      {client.contact_phone && (
                        <span>{client.contact_phone}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWebsiteFormClientId(client.id)}
                  >
                    Add Website
                  </Button>
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted sm:h-9 sm:flex-none sm:px-3"
                  >
                    View
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                    onClick={() => handleEdit(client)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                    onClick={() => handleDelete(client)}
                    disabled={deletingId === client.id}
                  >
                    {deletingId === client.id ? "..." : "Delete"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onClose={handleClose}
        client={editingClient}
      />

      {websiteFormClientId && (
        <WebsiteForm
          open={true}
          onClose={() => setWebsiteFormClientId(null)}
          clientId={websiteFormClientId}
        />
      )}
    </>
  );
}
