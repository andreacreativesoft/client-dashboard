"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    assignUserToClientAction,
    removeUserFromClientAction,
    adminChangePasswordAction,
    type UserWithClients,
} from "@/lib/actions/users";
import type { Client } from "@/types/database";

/** Human-friendly labels — never expose raw enum values in the UI. */
const roleLabel = (role: string) => (role === "admin" ? "Administrateur" : "Client");
const accessLabel = (access: string) => (access === "owner" ? "Propriétaire" : "Lecteur");

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
            setError("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas");
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
            setError(result.error || "Échec du changement de mot de passe");
        }
    }

    return (
        <div className="border-t border-border pt-4">
            {!open ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                    Changer le mot de passe
                </Button>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <h3 className="text-sm font-medium">Changer le mot de passe</h3>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    {success && (
                        <p className="text-xs text-green-600">Mot de passe changé avec succès !</p>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="edit_new_password" className="text-xs">
                            Nouveau mot de passe
                        </Label>
                        <Input
                            id="edit_new_password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Minimum 6 caractères"
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="edit_confirm_password" className="text-xs">
                            Confirmer le mot de passe
                        </Label>
                        <Input
                            id="edit_confirm_password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Ressaisir le mot de passe"
                            className="h-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={saving}>
                            {saving ? "Enregistrement…" : "Changer le mot de passe"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setOpen(false);
                                setError(null);
                            }}>
                            Annuler
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
        if (!user || !clientId) return;
        setLoading(clientId);
        setError("");

        const result = await assignUserToClientAction(user.id, clientId);
        setLoading(null);

        if (!result.success) {
            setError(result.error || "Échec de l'association du client");
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
            setError(result.error || "Échec du retrait du client");
            return;
        }

        router.refresh();
    }

    return (
        <Modal open={!!user} onClose={onClose} title="Détails de l'utilisateur">
            <div className="space-y-6">
                {/* User Info */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{user.full_name || "Sans nom"}</span>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {roleLabel(user.role)}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
                </div>

                {/* Assigned Clients */}
                {user.role === "client" && (
                    <div>
                        <h3 className="mb-3 text-sm font-medium">Clients associés</h3>
                        {user.clients.length === 0 ? (
                            <p className="mb-3 text-sm text-muted-foreground">
                                Aucun client associé.
                            </p>
                        ) : (
                            <div className="mb-3 space-y-2">
                                {user.clients.map((client) => (
                                    <div
                                        key={client.id}
                                        className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {client.business_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Accès : {accessLabel(client.access_role)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemove(client.id)}
                                            disabled={loading === client.id}>
                                            {loading === client.id ? "…" : "Retirer"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 1 utilisateur = 1 client : on ne propose l'association que
                            lorsqu'il n'en a aucun. Sinon il faut d'abord retirer l'actuel. */}
                        {user.clients.length === 0 ? (
                            unassignedClients.length > 0 && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Associer un client</Label>
                                    <Select
                                        value=""
                                        disabled={loading !== null}
                                        onValueChange={(v) => handleAssign(v)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choisir un client à associer…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {unassignedClients.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.business_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Un utilisateur est rattaché à un seul client. Retirez le client
                                actuel pour en associer un autre.
                            </p>
                        )}
                    </div>
                )}

                {/* Change Password */}
                <ChangePasswordSection userId={user.id} />

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose}>
                        Fermer
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
