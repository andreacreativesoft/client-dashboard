"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "./clients/client-form";
import { UserForm } from "./users/user-form";
import type { Client } from "@/types/database";

interface QuickActionsProps {
  clients: Client[];
}

export function QuickActions({ clients }: QuickActionsProps) {
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => setClientFormOpen(true)}
            className="block w-full cursor-pointer rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <p className="font-medium">Add New Client</p>
            <p className="text-sm text-muted-foreground">
              Create a client account and set up their websites
            </p>
          </button>
          <button
            onClick={() => setUserFormOpen(true)}
            className="block w-full cursor-pointer rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <p className="font-medium">Invite User</p>
            <p className="text-sm text-muted-foreground">
              Send an invitation to a new user
            </p>
          </button>
        </CardContent>
      </Card>

      <ClientForm
        open={clientFormOpen}
        onClose={() => setClientFormOpen(false)}
      />

      <UserForm
        open={userFormOpen}
        onClose={() => setUserFormOpen(false)}
        clients={clients}
      />
    </>
  );
}
