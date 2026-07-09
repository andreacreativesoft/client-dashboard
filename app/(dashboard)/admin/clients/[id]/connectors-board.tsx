"use client";

import { Clock, Copy, Inbox, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
    getConnectorsForWebsite,
    getConnectorKinds,
    createConnectorAction,
    updateConnectorAction,
    regenerateIngestTokenAction,
    deleteConnectorAction,
    type ConnectorWithUrl,
} from "@/lib/actions/connectors";
import { formatDateTime, timeAgoIntl } from "@/lib/utils";

type Kind = { kind: string; displayName: string; defaultLabel: string };

function ConnectorCard({
    connector,
    clientId,
    kindLabel,
    onChanged,
}: {
    connector: ConnectorWithUrl;
    clientId: string;
    kindLabel: string;
    onChanged: () => void;
}) {
    const confirm = useConfirm();
    const [busy, setBusy] = useState(false);

    async function handleDelete() {
        const ok = await confirm({
            title: `Supprimer le connecteur « ${connector.name || connector.kind} » ?`,
            description: "Son URL d'ingestion cessera de fonctionner immédiatement.",
            confirmLabel: "Supprimer",
            destructive: true,
        });
        if (!ok) return;
        setBusy(true);
        const r = await deleteConnectorAction(connector.id, clientId);
        if (r.success) onChanged();
        else {
            toast.error(r.error || "Échec de la suppression");
            setBusy(false);
        }
    }

    async function handleRegenerate() {
        const ok = await confirm({
            title: "Régénérer le token d'ingestion ?",
            description: "L'ancienne URL cessera de fonctionner immédiatement.",
            confirmLabel: "Régénérer",
            destructive: true,
        });
        if (!ok) return;
        setBusy(true);
        const r = await regenerateIngestTokenAction(connector.id, clientId);
        if (r.success) onChanged();
        else {
            toast.error(r.error || "Échec");
            setBusy(false);
        }
    }

    async function handleToggle() {
        setBusy(true);
        const r = await updateConnectorAction(connector.id, clientId, {
            is_active: !connector.is_active,
        });
        if (r.success) onChanged();
        else {
            toast.error(r.error || "Échec");
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                        <Inbox className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                                {connector.name || connector.label}
                            </p>
                            <Badge variant="outline" className="shrink-0">
                                {kindLabel}
                            </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                            Produit : {connector.label}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        onClick={handleToggle}
                        disabled={busy}
                        className="cursor-pointer"
                        title={connector.is_active ? "Désactiver" : "Activer"}>
                        <Badge variant={connector.is_active ? "success" : "secondary"}>
                            {connector.is_active ? "Actif" : "Inactif"}
                        </Badge>
                    </button>
                    <button
                        onClick={handleRegenerate}
                        disabled={busy}
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                        title="Régénérer le token">
                        <RefreshCw className="size-4" />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={busy}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        title="Supprimer">
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                {connector.lastSubmissionAt ? (
                    <span title={formatDateTime(connector.lastSubmissionAt)}>
                        Dernière récolte {timeAgoIntl(connector.lastSubmissionAt)}
                    </span>
                ) : (
                    <span>Aucune récolte reçue pour l&apos;instant</span>
                )}
            </div>

            <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    {connector.ingestUrl}
                </code>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        navigator.clipboard.writeText(connector.ingestUrl);
                        toast.success("URL d'ingestion copiée");
                    }}>
                    <Copy className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}

export function ConnectorsBoard({ websiteId, clientId }: { websiteId: string; clientId: string }) {
    const [connectors, setConnectors] = useState<ConnectorWithUrl[]>([]);
    const [kinds, setKinds] = useState<Kind[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [kind, setKind] = useState("");
    const [name, setName] = useState("");
    const [label, setLabel] = useState("");

    async function load() {
        const [c, k] = await Promise.all([getConnectorsForWebsite(websiteId), getConnectorKinds()]);
        setConnectors(c);
        setKinds(k);
        setLoading(false);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [websiteId]);

    function openAdd() {
        const first = kinds[0];
        setKind(first?.kind ?? "");
        setLabel(first?.defaultLabel ?? "");
        setName("");
        setModalOpen(true);
    }

    async function handleAdd() {
        if (!kind) return;
        setSaving(true);
        const r = await createConnectorAction({ websiteId, clientId, kind, name, label });
        setSaving(false);
        if (r.success) {
            setModalOpen(false);
            load();
        } else {
            toast.error(r.error || "Échec de la création");
        }
    }

    return (
        <div className="space-y-3">
            {loading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
                <div className="space-y-2">
                    {connectors.map((c) => (
                        <ConnectorCard
                            key={c.id}
                            connector={c}
                            clientId={clientId}
                            kindLabel={kinds.find((k) => k.kind === c.kind)?.displayName ?? c.kind}
                            onChanged={load}
                        />
                    ))}
                    {kinds.length > 0 && (
                        <button
                            type="button"
                            onClick={openAdd}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/60 hover:bg-muted/40 hover:text-foreground">
                            <Plus className="size-4" />
                            Ajouter un connecteur
                        </button>
                    )}
                </div>
            )}

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Ajouter un connecteur">
                <div className="flex flex-col gap-3">
                    <div className="space-y-1.5">
                        <Label>Système</Label>
                        <Select
                            value={kind}
                            onValueChange={(v) => {
                                setKind(v);
                                const k = kinds.find((x) => x.kind === v);
                                if (k) setLabel(k.defaultLabel);
                            }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un système" />
                            </SelectTrigger>
                            <SelectContent>
                                {kinds.map((k) => (
                                    <SelectItem key={k.kind} value={k.kind}>
                                        {k.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Nom (interne)</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="ex. Form contact"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Libellé des items</Label>
                        <Input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Prospect"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={saving || !kind}>
                            {saving ? "…" : "Ajouter"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
