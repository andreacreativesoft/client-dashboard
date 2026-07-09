"use client";

import {
    AtSign,
    Bug,
    ChevronLeft,
    FilePlus2,
    type LucideIcon,
    MessageCircle,
    Palette,
    PencilLine,
    Receipt,
    Search,
    ServerCrash,
    Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createTicketAction } from "@/lib/actions/tickets";
import { useLanguage } from "@/lib/i18n/language-context";
import {
    getTicketType,
    TICKET_TYPES,
    type TicketField,
    type TicketTypeDef,
    tr,
} from "@/lib/tickets/ticket-types";
import { cn } from "@/lib/utils";

interface TicketFormProps {
    clients: { id: string; business_name: string }[];
    adminUsers: { id: string; full_name: string }[];
    isAdmin: boolean;
    defaultClientId?: string;
    /** Where to navigate after creation — "/tickets" (client) or "/admin/tickets" (agency). */
    basePath?: string;
}

const ICONS: Record<string, LucideIcon> = {
    PencilLine,
    Bug,
    ServerCrash,
    FilePlus2,
    Sparkles,
    Palette,
    Search,
    AtSign,
    Receipt,
    MessageCircle,
};

const inputClass =
    "w-full rounded-lg border border-brand-border bg-surface px-4 py-3 text-[14px] leading-[1.5] text-ink placeholder-ink-muted outline-none transition-colors focus:border-brand aria-[invalid=true]:border-red-500";
const labelClass = "text-[14px] font-medium leading-[1.5] text-ink";
const errorClass = "text-[12px] leading-[1.5] text-red-600";

export function TicketForm({
    clients,
    adminUsers,
    isAdmin,
    defaultClientId,
    basePath = "/tickets",
}: TicketFormProps) {
    const router = useRouter();
    const { t, language } = useLanguage();

    const [typeId, setTypeId] = useState<string | null>(null);
    const [clientId, setClientId] = useState(
        defaultClientId || (!isAdmin && clients[0] ? clients[0].id : ""),
    );
    const [details, setDetails] = useState<Record<string, string>>({});
    const [priority, setPriority] = useState<string>("medium");
    const [assignedTo, setAssignedTo] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState<string>("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const type = getTicketType(typeId);

    function chooseType(def: TicketTypeDef) {
        setTypeId(def.id);
        setDetails({});
        setErrors({});
        setPriority(def.defaultPriority);
    }

    function setField(key: string, value: string) {
        setDetails((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!type) return;

        const nextErrors: Record<string, string> = {};
        if (isAdmin && !clientId) nextErrors.client_id = t("ticket_form.required");
        for (const field of type.fields) {
            if (field.required && !(details[field.key] ?? "").trim()) {
                nextErrors[field.key] = t("ticket_form.required");
            }
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSubmitting(true);
        const result = await createTicketAction({
            client_id: clientId,
            type: type.id,
            details,
            // La priorité n'est saisie que par l'admin ; sinon = défaut du type.
            priority: isAdmin ? (priority as never) : undefined,
            assigned_to: isAdmin ? assignedTo : null,
            due_date: isAdmin && dueDate ? dueDate : null,
        });
        setSubmitting(false);

        if (result.success && result.ticketId) {
            toast.success(t("ticket_form.sent"));
            router.push(`${basePath}/${result.ticketId}`);
        } else {
            toast.error(result.error || t("ticket_form.error"));
        }
    }

    // ── Étape 1 : grille de types ──
    if (!type) {
        return (
            <div className="flex flex-col gap-5">
                <p className="text-[18px] font-bold leading-[1.5] text-ink">
                    {t("ticket_form.choose_type")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {TICKET_TYPES.map((def) => {
                        const Icon = ICONS[def.icon] ?? MessageCircle;
                        return (
                            <button
                                key={def.id}
                                type="button"
                                onClick={() => chooseType(def)}
                                className="group flex items-start gap-3 rounded-xl border border-brand-border bg-white p-4 text-left transition-colors hover:border-brand hover:bg-surface">
                                <span
                                    className={cn(
                                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                                        def.accent,
                                    )}>
                                    <Icon className="size-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[15px] font-semibold text-ink">
                                        {tr(def.label, language)}
                                    </span>
                                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
                                        {tr(def.description, language)}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Étape 2 : formulaire adaptatif ──
    const Icon = ICONS[type.icon] ?? MessageCircle;
    return (
        <form onSubmit={handleSubmit} className="flex max-w-[640px] flex-col gap-6">
            {/* En-tête : type choisi + changer */}
            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        type.accent,
                    )}>
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-ink">{tr(type.label, language)}</p>
                    <button
                        type="button"
                        onClick={() => setTypeId(null)}
                        className="inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
                        <ChevronLeft className="size-3.5" />
                        {t("ticket_form.change_type")}
                    </button>
                </div>
            </div>

            {/* Client — admin seulement */}
            {isAdmin && clients.length > 1 && (
                <div className="flex flex-col gap-2">
                    <label className={labelClass}>{t("tickets.client")}</label>
                    <Select value={clientId} onValueChange={setClientId}>
                        <SelectTrigger className="w-full" aria-invalid={!!errors.client_id}>
                            <SelectValue placeholder={t("tickets.select_client")} />
                        </SelectTrigger>
                        <SelectContent>
                            {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.business_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.client_id && <p className={errorClass}>{errors.client_id}</p>}
                </div>
            )}

            {/* Champs adaptatifs */}
            {type.fields.map((field) => (
                <FieldInput
                    key={field.key}
                    field={field}
                    value={details[field.key] ?? ""}
                    onChange={(v) => setField(field.key, v)}
                    error={errors[field.key]}
                    lang={language}
                />
            ))}

            {/* Champs agence */}
            {isAdmin && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <label className={labelClass}>{t("tickets.priority")}</label>
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">{t("tickets.priority_low")}</SelectItem>
                                <SelectItem value="medium">
                                    {t("tickets.priority_medium")}
                                </SelectItem>
                                <SelectItem value="high">{t("tickets.priority_high")}</SelectItem>
                                <SelectItem value="urgent">
                                    {t("tickets.priority_urgent")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className={labelClass}>{t("tickets.assigned_to")}</label>
                        <Select
                            value={assignedTo ?? "none"}
                            onValueChange={(v) => setAssignedTo(v === "none" ? null : v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t("tickets.unassigned")}</SelectItem>
                                {adminUsers.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className={labelClass}>{t("tickets.due_date")}</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-full bg-orange px-5 py-3 text-[16px] font-bold uppercase leading-[1.5] tracking-[0.6px] text-white transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? t("ticket_form.sending") : t("ticket_form.submit")}
            </button>
        </form>
    );
}

function FieldInput({
    field,
    value,
    onChange,
    error,
    lang,
}: {
    field: TicketField;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    lang: Parameters<typeof tr>[1];
}) {
    const placeholder = field.placeholder ? tr(field.placeholder, lang) : undefined;

    return (
        <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor={field.key}>
                {tr(field.label, lang)}
            </label>

            {field.type === "textarea" || field.type === "url_list" ? (
                <textarea
                    id={field.key}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={!!error}
                    rows={field.type === "url_list" ? 3 : 5}
                    className={cn(inputClass, "resize-none")}
                />
            ) : field.type === "select" ? (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger id={field.key} className="w-full" aria-invalid={!!error}>
                        <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                        {field.options?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                                {tr(o.label, lang)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <input
                    id={field.key}
                    type={field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-invalid={!!error}
                    className={inputClass}
                />
            )}

            {field.help && <p className="text-[12px] text-ink-muted">{tr(field.help, lang)}</p>}
            {error && <p className={errorClass}>{error}</p>}
        </div>
    );
}
