"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { createInviteAction, type InviteFormData } from "@/lib/actions/invites";
import { createUserAction, type UserFormData } from "@/lib/actions/users";
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
    const [sendEmail, setSendEmail] = useState(true);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);

        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement).value;

        if (mode === "invite") {
            // Send Invite mode — use invite system
            const full_name =
                (form.elements.namedItem("full_name") as HTMLInputElement)?.value || undefined;
            const phone =
                (form.elements.namedItem("phone") as HTMLInputElement)?.value || undefined;

            const inviteData: InviteFormData = {
                email,
                full_name,
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
        } else {
            // Add Manually mode — create user directly
            const full_name = (form.elements.namedItem("full_name") as HTMLInputElement).value;
            const phone = (form.elements.namedItem("phone") as HTMLInputElement)?.value || "";
            const password = (form.elements.namedItem("password") as HTMLInputElement)?.value || "";

            if (password && password.length < 6) {
                setLoading(false);
                setError("Password must be at least 6 characters");
                return;
            }

            const userData: UserFormData = {
                email,
                full_name,
                phone,
                role,
                client_ids: selectedClients,
                password: password || undefined,
                sendEmail,
            };

            const result = await createUserAction(userData);
            setLoading(false);

            if (!result.success) {
                setError(result.error || "Something went wrong");
                return;
            }
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
        setSendEmail(true);
        setError("");
        setSuccess(false);
    }

    function toggleClient(clientId: string) {
        setSelectedClients((prev) =>
            prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
        );
    }

    return (
        <Modal open={open} onClose={handleClose} title="Ajouter un utilisateur">
            {/* Mode Toggle */}
            <div className="mb-4 flex rounded-lg border border-border p-1">
                <button
                    type="button"
                    onClick={() => setMode("invite")}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        mode === "invite"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}>
                    Envoyer une invitation
                </button>
                <button
                    type="button"
                    onClick={() => setMode("add")}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        mode === "add"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    }`}>
                    Ajouter manuellement
                </button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
                {mode === "invite"
                    ? "Envoie un email d'invitation. L'utilisateur complétera son profil et définira son mot de passe."
                    : "Crée le compte directement. Vous pouvez définir un mot de passe ou laisser l'utilisateur le faire."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="utilisateur@exemple.be"
                    />
                </div>

                {mode === "add" && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Nom complet *</Label>
                            <Input
                                id="full_name"
                                name="full_name"
                                required
                                placeholder="Jean Dupont"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Téléphone</Label>
                            <Input id="phone" name="phone" type="tel" placeholder="+32 ..." />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Mot de passe</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Laisser vide pour envoyer un lien de définition"
                                minLength={6}
                            />
                            <p className="text-xs text-muted-foreground">
                                6 caractères minimum. Si laissé vide, l'utilisateur recevra un lien
                                pour définir son mot de passe.
                            </p>
                        </div>
                    </>
                )}

                <div className="space-y-2">
                    <Label>Rôle</Label>
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
                            <span className="text-sm">Administrateur</span>
                        </label>
                    </div>
                </div>

                {role === "client" && clients.length > 0 && (
                    <div className="space-y-2">
                        <Label>Associer à des clients</Label>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                            {clients.map((client) => (
                                <label
                                    key={client.id}
                                    className="flex cursor-pointer items-center gap-2">
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

                {/* Send email toggle — only for Add Manually mode */}
                {mode === "add" && (
                    <label className="flex cursor-pointer items-center gap-3">
                        <input
                            type="checkbox"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="h-4 w-4 rounded"
                        />
                        <span className="text-sm text-foreground">
                            Envoyer une notification par email à l'utilisateur
                        </span>
                    </label>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                {success && (
                    <p className="text-sm text-success">
                        {mode === "invite" ? "Invitation envoyée !" : "Utilisateur créé !"}
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Annuler
                    </Button>
                    <Button type="submit" disabled={loading || success}>
                        {loading
                            ? mode === "invite"
                                ? "Envoi…"
                                : "Création…"
                            : mode === "invite"
                              ? "Envoyer l'invitation"
                              : "Créer l'utilisateur"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
