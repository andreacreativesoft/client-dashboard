"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  assignUserToClientAction,
  removeUserFromClientAction,
  type UserWithClients,
} from "@/lib/actions/users";
import type { Client } from "@/types/database";

interface EditUserModalProps {
  user: UserWithClients | null;
  clients: Client[];
  onClose: () => void;
}

export function EditUserModal({ user, clients, onClose }: EditUserModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!user) return null;

  const assignedClientIds = user.clients.map((c) => c.id);
  const unassignedClients = clients.filter((c) => !assignedClientIds.includes(c.id));

  async function handleAssign(clientId: string) {
    if (!user) return;
    setLoading(clientId);
    setError("");

    const result = await assignUserToClientAction(user.id, clientId);
    setLoading(null);

    if (!result.success) {
      setError(result.error || "Failed to assign client");
      return;
    }

    router.refresh();
  }

  async function handleRemove(clientId: string) {
    if (!user) return;
    setLoading(clientId);
    setError("");

    const result = await removeUserFromClientAction(user.id, clientId);
    setLoading(null);

    if (!result.success) {
      setError(result.error || "Failed to remove client");
      return;
    }

    router.refresh();
  }

  return (
    <Modal open={!!user} onClose={onClose} title="User Details">
      <div className="space-y-6">
        {/* User Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{user.full_name || "No name"}</span>
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.phone && (
            <p className="text-sm text-muted-foreground">{user.phone}</p>
          )}
        </div>

        {/* Assigned Clients */}
        {user.role === "client" && (
          <>
            <div>
              <h3 className="mb-3 text-sm font-medium">Assigned Clients</h3>
              {user.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients assigned</p>
              ) : (
                <div className="space-y-2">
                  {user.clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{client.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Access: {client.access_role}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(client.id)}
                        disabled={loading === client.id}
                      >
                        {loading === client.id ? "..." : "Remove"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Client */}
            {unassignedClients.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium">Add to Client</h3>
                <div className="space-y-2">
                  {unassignedClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between rounded-lg border border-dashed p-3"
                    >
                      <p className="text-sm">{client.business_name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssign(client.id)}
                        disabled={loading === client.id}
                      >
                        {loading === client.id ? "..." : "Add"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
