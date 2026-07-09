"use client";

import {
    Code2,
    Copy,
    FolderLock,
    Frame,
    Hash,
    KeyRound,
    Link as LinkIcon,
    Lock,
    Mail,
    Pencil,
    Plus,
    Server,
    SquareKanban,
    Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    getAttributesForWebsite,
    addAttributeAction,
    updateAttributeAction,
    deleteAttributeAction,
    type AttributeFormData,
} from "@/lib/actions/attributes";
import { ATTRIBUTE_PRESETS, getPreset } from "@/lib/attributes/presets";
import type { Attribute } from "@/types/database";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    Code2,
    Frame,
    SquareKanban,
    Hash,
    Server,
    FolderLock,
    KeyRound,
    Mail,
};

function PresetIcon({ type }: { type: string | null }) {
    const preset = getPreset(type);
    const Icon = preset ? (ICONS[preset.icon] ?? LinkIcon) : LinkIcon;
    return <Icon className="size-4" />;
}

const EMPTY: AttributeFormData = {
    type: null,
    title: "",
    value: "",
    is_sensitive: false,
    is_admin_only: true,
};

// Sentinelle pour l'option « Texte libre » (Radix Select n'aime pas la valeur "").
const FREE = "__free__";

function AttributeFields({
    form,
    setForm,
}: {
    form: AttributeFormData;
    setForm: (f: AttributeFormData) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                        value={form.type ?? FREE}
                        onValueChange={(v) => {
                            const type = v === FREE ? null : v;
                            const preset = getPreset(type);
                            setForm({
                                ...form,
                                type,
                                title: preset ? preset.label : form.title,
                                is_sensitive: preset ? preset.defaultSensitive : form.is_sensitive,
                            });
                        }}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={FREE}>Texte libre</SelectItem>
                            {ATTRIBUTE_PRESETS.map((p) => (
                                <SelectItem key={p.type} value={p.type}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Titre</Label>
                    <Input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="ex. Dépôt GitHub"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label>Valeur</Label>
                <Input
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="lien / identifiant / note"
                />
            </div>
            <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={form.is_sensitive}
                        onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })}
                        className="rounded border-input"
                    />
                    Sensible (masqué)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={form.is_admin_only}
                        onChange={(e) => setForm({ ...form, is_admin_only: e.target.checked })}
                        className="rounded border-input"
                    />
                    Admin seulement
                </label>
            </div>
        </div>
    );
}

function AttributeCard({
    item,
    onEdit,
    onChanged,
}: {
    item: Attribute;
    onEdit: () => void;
    onChanged: () => void;
}) {
    const confirm = useConfirm();
    const [revealed, setRevealed] = useState(false);
    const isUrl = getPreset(item.type)?.valueKind === "url";

    async function handleDelete() {
        const ok = await confirm({
            title: `Supprimer « ${item.title} » ?`,
            confirmLabel: "Supprimer",
            destructive: true,
        });
        if (!ok) return;
        const result = await deleteAttributeAction(item.id, item.website_id);
        if (result.success) onChanged();
        else toast.error(result.error || "Échec de la suppression");
    }

    return (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PresetIcon type={item.type} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                    <span className="truncate">{item.title}</span>
                    {item.is_admin_only && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    aria-label="Visible par l'agence uniquement"
                                    className="inline-flex cursor-help">
                                    <Lock className="size-3 shrink-0" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                Réservé à l'agence — masqué au client dans son espace.
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <p className="mt-0.5 truncate text-sm">
                    {item.is_sensitive && !revealed ? (
                        <span className="text-muted-foreground">
                            {"••••••••"}
                            <button
                                onClick={() => setRevealed(true)}
                                className="ml-1 text-xs underline hover:text-foreground">
                                afficher
                            </button>
                        </span>
                    ) : isUrl && item.value ? (
                        <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground hover:underline">
                            {item.value.replace(/^https?:\/\//, "")}
                        </a>
                    ) : (
                        item.value
                    )}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(item.value);
                        toast.success("Copié");
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                    title="Copier">
                    <Copy className="size-3.5" />
                </button>
                <button
                    onClick={onEdit}
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                    title="Modifier">
                    <Pencil className="size-3.5" />
                </button>
                <button
                    onClick={handleDelete}
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                    title="Supprimer">
                    <Trash2 className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

export function AttributesBoard({ websiteId }: { websiteId: string }) {
    const [items, setItems] = useState<Attribute[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // null = fermée ; { item: null } = ajout ; { item } = édition.
    const [modal, setModal] = useState<{ item: Attribute | null } | null>(null);
    const [form, setForm] = useState<AttributeFormData>(EMPTY);

    async function load() {
        setItems(await getAttributesForWebsite(websiteId));
        setLoading(false);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [websiteId]);

    function openAdd() {
        setForm(EMPTY);
        setModal({ item: null });
    }

    function openEdit(item: Attribute) {
        setForm({
            type: item.type,
            title: item.title,
            value: item.value,
            is_sensitive: item.is_sensitive,
            is_admin_only: item.is_admin_only,
        });
        setModal({ item });
    }

    async function handleSubmit() {
        if (!form.title.trim()) return;
        setSaving(true);
        const result = modal?.item
            ? await updateAttributeAction(modal.item.id, form)
            : await addAttributeAction(websiteId, form);
        setSaving(false);
        if (result.success) {
            setModal(null);
            load();
        } else {
            toast.error(result.error || "Échec de l'enregistrement");
        }
    }

    return (
        <div className="space-y-3">
            {loading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((item) => (
                        <AttributeCard
                            key={item.id}
                            item={item}
                            onEdit={() => openEdit(item)}
                            onChanged={load}
                        />
                    ))}
                    <button
                        type="button"
                        onClick={openAdd}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/60 hover:bg-muted/40 hover:text-foreground">
                        <Plus className="size-4" />
                        Ajouter une info
                    </button>
                </div>
            )}

            <Modal
                open={modal !== null}
                onClose={() => setModal(null)}
                title={modal?.item ? "Modifier l'info" : "Ajouter une info"}>
                <div className="flex flex-col gap-4">
                    <AttributeFields form={form} setForm={setForm} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setModal(null)}>
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={saving || !form.title.trim()}>
                            {saving ? "…" : modal?.item ? "Enregistrer" : "Ajouter"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
