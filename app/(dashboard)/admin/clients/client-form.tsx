"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { createClientAction, updateClientAction, type ClientFormData } from "@/lib/actions/clients";
import type { Client } from "@/types/database";

interface ClientFormProps {
    open: boolean;
    onClose: () => void;
    client?: Client | null;
}

export function ClientForm({ open, onClose, client }: ClientFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isEdit = !!client;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const form = e.currentTarget;
        const formData: ClientFormData = {
            business_name: (form.elements.namedItem("business_name") as HTMLInputElement).value,
            contact_email: (form.elements.namedItem("contact_email") as HTMLInputElement).value,
            contact_phone: (form.elements.namedItem("contact_phone") as HTMLInputElement).value,
            notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
        };

        const result = isEdit
            ? await updateClientAction(client.id, formData)
            : await createClientAction(formData);

        setLoading(false);

        if (!result.success) {
            setError(result.error || "Une erreur est survenue");
            return;
        }

        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEdit ? "Modifier le client" : "Nouveau client"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="business_name">Nom de l'entreprise *</Label>
                    <Input
                        id="business_name"
                        name="business_name"
                        required
                        defaultValue={client?.business_name || ""}
                        placeholder="Ex. Boulangerie Martin"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="contact_email">Email de contact</Label>
                    <Input
                        id="contact_email"
                        name="contact_email"
                        type="email"
                        defaultValue={client?.contact_email || ""}
                        placeholder="contact@exemple.be"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="contact_phone">Téléphone de contact</Label>
                    <Input
                        id="contact_phone"
                        name="contact_phone"
                        type="tel"
                        defaultValue={client?.contact_phone || ""}
                        placeholder="+32 ..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={client?.notes || ""}
                        placeholder="Notes internes sur ce client…"
                    />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Annuler
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le client"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
