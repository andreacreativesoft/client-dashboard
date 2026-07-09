"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ClientSelect } from "@/components/client-select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { startImpersonation } from "@/lib/actions/impersonate";

interface Client {
    id: string;
    business_name: string;
}

interface ClientViewDialogProps {
    clients: Client[];
    open: boolean;
    onClose: () => void;
}

/**
 * Controlled dialog to open a client's space (impersonation). A single Select
 * lists every client alphabetically; the trigger lives with the caller (e.g. an
 * admin dashboard quick action).
 */
export function ClientViewDialog({ clients, open, onClose }: ClientViewDialogProps) {
    const router = useRouter();
    const [selected, setSelected] = useState("");
    const [loading, setLoading] = useState(false);

    function close() {
        setSelected("");
        onClose();
    }

    async function handleOpen() {
        if (!selected) return;
        setLoading(true);
        const result = await startImpersonation(selected);
        if (result.success) {
            close();
            router.refresh();
        } else {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <Modal open={open} onClose={close} title="Ouvrir un espace client">
            <p className="mb-4 text-sm text-muted-foreground">
                Choisissez un client pour ouvrir son espace et voir son tableau de bord comme lui.
                Les sections réservées à l'agence seront masquées.
            </p>

            <ClientSelect clients={clients} value={selected} onValueChange={setSelected} />

            <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={close} disabled={loading}>
                    Annuler
                </Button>
                <Button onClick={handleOpen} disabled={!selected || loading}>
                    {loading ? "Ouverture…" : "Ouvrir l'espace"}
                </Button>
            </div>
        </Modal>
    );
}
