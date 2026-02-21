"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserForm } from "./user-form";
import {
  deleteUserAction,
  updateUserRoleAction,
  unblockUserAction,
  type UserWithClients,
} from "@/lib/actions/users";
import { resendInviteAction, deleteInviteAction } from "@/lib/actions/invites";
import { EditUserModal } from "./edit-user-modal";
import type { Client, Invite } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

interface UsersListProps {
  users: UserWithClients[];
  clients: Client[];
  pendingInvites: Invite[];
  currentUserId: string;
}

export function UsersList({ users, clients, pendingInvites, currentUserId }: UsersListProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithClients | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleToggleRole(user: UserWithClients) {
    const newRole = user.role === "admin" ? "client" : "admin";
    if (
      !confirm(
        `Change ${user.full_name || user.email}'s role to ${newRole}?`
      )
    ) {
      return;
    }

    setLoading(user.id);
    const result = await updateUserRoleAction(user.id, newRole);
    setLoading(null);

    if (!result.success) {
      alert(result.error || "Failed to update role");
    }
  }

  async function handleUnblock(user: UserWithClients) {
    if (
      !confirm(
        `Unblock user "${user.full_name || user.email}"? They will be able to log in again.`
      )
    ) {
      return;
    }

    setLoading(user.id);
    const result = await unblockUserAction(user.id);
    setLoading(null);
    router.refresh();

    if (!result.success) {
      alert(result.error || "Failed to unblock user");
    }
  }

  async function handleDelete(user: UserWithClients) {
    if (user.id === currentUserId) {
      alert("You cannot delete your own account");
      return;
    }

    if (
      !confirm(
        `Delete user "${user.full_name || user.email}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(user.id);
    const result = await deleteUserAction(user.id);
    setLoading(null);

    if (!result.success) {
      alert(result.error || "Failed to delete user");
    }
  }

  async function handleResendInvite(inviteId: string) {
    setLoading(inviteId);
    const result = await resendInviteAction(inviteId);
    setLoading(null);
    router.refresh();

    if (!result.success) {
      alert(result.error || "Failed to resend invitation");
    }
  }

  async function handleDeleteInvite(inviteId: string) {
    if (!confirm("Cancel this invitation?")) {
      return;
    }

    setLoading(inviteId);
    const result = await deleteInviteAction(inviteId);
    setLoading(null);
    router.refresh();

    if (!result.success) {
      alert(result.error || "Failed to cancel invitation");
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={() => setFormOpen(true)}>
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
            />
          </svg>
          Add User
        </Button>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{invite.full_name}</span>
                      <Badge variant="secondary">{invite.role}</Badge>
                      {isExpired(invite.expires_at) && (
                        <Badge variant="destructive">Expired</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInvite(invite.id)}
                      disabled={loading === invite.id}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteInvite(invite.id)}
                      disabled={loading === invite.id}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Existing Users */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No users yet. Click &quot;Invite User&quot; to send an invitation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {user.full_name || "No name"}
                      </span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                      {user.id === currentUserId && (
                        <Badge variant="outline">You</Badge>
                      )}
                      {user.is_blocked && (
                        <Badge variant="destructive">Blocked</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.phone && (
                      <p className="text-sm text-muted-foreground">{user.phone}</p>
                    )}

                    {user.clients.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.clients.map((client) => (
                          <span
                            key={client.id}
                            className="rounded-full bg-muted px-2 py-1 text-xs"
                          >
                            {client.business_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser(user)}
                    >
                      Edit
                    </Button>
                    {user.id !== currentUserId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleRole(user)}
                          disabled={loading === user.id}
                        >
                          {user.role === "admin" ? "Make Client" : "Make Admin"}
                        </Button>
                        {user.is_blocked && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblock(user)}
                            disabled={loading === user.id}
                          >
                            Unblock
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          disabled={loading === user.id}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UserForm open={formOpen} onClose={() => setFormOpen(false)} clients={clients} />

      <EditUserModal
        user={editingUser}
        clients={clients}
        onClose={() => setEditingUser(null)}
      />
    </>
  );
}
