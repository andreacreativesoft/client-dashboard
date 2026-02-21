"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  assignUserToClientAction,
  removeUserFromClientAction,
  adminChangePasswordAction,
  type UserWithClients,
} from "@/lib/actions/users";
import type { Client } from "@/types/database";

function ChangePasswordSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    const result = await adminChangePasswordAction(userId, newPassword);
    setSaving(false);

    if (result.success) {
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1500);
    } else {
      setError(result.error || "Failed to change password");
    }
  }

  return (
    <div className="border-t border-border pt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Change Password
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-sm font-medium">Change Password</h3>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-green-600">Password changed successfully!</p>}
          <div className="space-y-1">
            <Label htmlFor="edit_new_password" className="text-xs">New Password</Label>
            <PasswordInput
              id="edit_new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit_confirm_password" className="text-xs">Confirm Password</Label>
            <PasswordInput
              id="edit_confirm_password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Re-enter password"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : "Change Password"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

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

        {/* Change Password */}
        <ChangePasswordSection userId={user.id} />

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
