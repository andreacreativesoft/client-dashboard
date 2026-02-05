"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { createInviteAction, type InviteFormData } from "@/lib/actions/invites";
import type { Client } from "@/types/database";

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
}

type Mode = "invite" | "add";

export function UserForm({ open, onClose, clients }: UserFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("invite");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [role, setRole] = useState<"admin" | "client">("client");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    // Get name and phone only for "add" mode
    const full_name =
      mode === "add"
        ? (form.elements.namedItem("full_name") as HTMLInputElement)?.value
        : undefined;
    const phone =
      mode === "add"
        ? (form.elements.namedItem("phone") as HTMLInputElement)?.value || undefined
        : undefined;

    // Both modes use the invite system now
    const inviteData: InviteFormData = {
      email,
      full_name, // undefined for invite mode, filled for add mode
      phone,
      role,
      client_ids: selectedClients,
    };

    const result = await createInviteAction(inviteData);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }

    setSuccess(true);
    router.refresh();
    setTimeout(() => handleClose(), 1500);
  }

  function handleClose() {
    onClose();
    setMode("invite");
    setRole("client");
    setSelectedClients([]);
    setError("");
    setSuccess(false);
  }

  function toggleClient(clientId: string) {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add User">
      {/* Mode Toggle */}
      <div className="mb-4 flex rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => setMode("invite")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === "invite"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Send Invite
        </button>
        <button
          type="button"
          onClick={() => setMode("add")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === "add"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Add Manually
        </button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {mode === "invite"
          ? "Send an invitation email. The user will complete their profile and set a password."
          : "Pre-fill user details. They'll receive an email to set their password."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="user@example.com"
          />
        </div>

        {mode === "add" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                name="full_name"
                required
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Role</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="role"
                value="client"
                checked={role === "client"}
                onChange={() => setRole("client")}
                className="h-4 w-4"
              />
              <span className="text-sm">Client</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === "admin"}
                onChange={() => setRole("admin")}
                className="h-4 w-4"
              />
              <span className="text-sm">Admin</span>
            </label>
          </div>
        </div>

        {role === "client" && clients.length > 0 && (
          <div className="space-y-2">
            <Label>Assign to Clients</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {clients.map((client) => (
                <label key={client.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm">{client.business_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <p className="text-sm text-success">
            Invitation sent!
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || success}>
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
