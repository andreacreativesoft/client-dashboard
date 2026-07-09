"use client";

import { CheckCircle2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { updateClientContactAction } from "@/lib/actions/clients";
import { sendEmailToClientAction } from "@/lib/actions/email";

interface ContactInfoProps {
    clientId: string;
    contactEmail: string | null;
    contactPhone: string | null;
}

export function ContactInfo({ clientId, contactEmail, contactPhone }: ContactInfoProps) {
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    async function handleSaveContact(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement).value;
        const phone = (form.elements.namedItem("phone") as HTMLInputElement).value;

        const result = await updateClientContactAction(clientId, { email, phone });
        setSaving(false);

        if (result.success) {
            setEditOpen(false);
            toast.success("Coordonnées mises à jour");
            router.refresh();
        } else {
            toast.error(result.error || "Échec de la mise à jour");
        }
    }

    async function handleSendEmail(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSending(true);
        setError("");

        const form = e.currentTarget;
        const subject = (form.elements.namedItem("subject") as HTMLInputElement).value;
        const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;

        const result = await sendEmailToClientAction(clientId, contactEmail!, subject, message);

        setSending(false);

        if (result.success) {
            setSent(true);
            setTimeout(() => {
                setEmailModalOpen(false);
                setSent(false);
            }, 1500);
        } else {
            setError(result.error || "Failed to send email");
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Coordonnées</CardTitle>
                    <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        aria-label="Modifier les coordonnées"
                        title="Modifier les coordonnées"
                        className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="size-4" />
                    </button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {contactEmail ? (
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                                Email
                            </p>
                            <button
                                onClick={() => setEmailModalOpen(true)}
                                className="text-sm hover:underline text-left">
                                {contactEmail}
                            </button>
                        </div>
                    ) : null}
                    {contactPhone ? (
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                                Téléphone
                            </p>
                            <a href={`tel:${contactPhone}`} className="text-sm hover:underline">
                                {contactPhone}
                            </a>
                        </div>
                    ) : null}
                    {!contactEmail && !contactPhone && (
                        <p className="text-sm text-muted-foreground">
                            Aucune coordonnée renseignée
                        </p>
                    )}
                </CardContent>
            </Card>

            {contactEmail && (
                <Modal
                    open={emailModalOpen}
                    onClose={() => {
                        setEmailModalOpen(false);
                        setError("");
                        setSent(false);
                    }}
                    title="Envoyer un email">
                    {sent ? (
                        <div className="flex flex-col items-center gap-2 py-6">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                            <p className="text-sm font-medium">Email envoyé !</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSendEmail} className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">À</Label>
                                <p className="text-sm font-medium">{contactEmail}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subject">Objet</Label>
                                <Input
                                    id="subject"
                                    name="subject"
                                    required
                                    placeholder="Objet de l'email"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    name="message"
                                    required
                                    placeholder="Rédigez votre message…"
                                    className="min-h-[150px]"
                                />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEmailModalOpen(false)}>
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={sending}>
                                    {sending ? "Envoi…" : "Envoyer"}
                                </Button>
                            </div>
                        </form>
                    )}
                </Modal>
            )}

            <Modal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title="Modifier les coordonnées">
                <form onSubmit={handleSaveContact} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                            id="edit-email"
                            name="email"
                            type="email"
                            defaultValue={contactEmail ?? ""}
                            placeholder="email@exemple.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-phone">Téléphone</Label>
                        <Input
                            id="edit-phone"
                            name="phone"
                            type="tel"
                            defaultValue={contactPhone ?? ""}
                            placeholder="+32 470 12 34 56"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                            Annuler
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Enregistrement…" : "Enregistrer"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
