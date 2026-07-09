"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateSubmissionStatusAction } from "@/lib/actions/submissions";
import { useLanguage } from "@/lib/i18n/language-context";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { SubmissionStatus } from "@/types/database";

interface SubmissionStatusProps {
    submissionId: string;
    currentStatus: SubmissionStatus;
}

// Labels come from i18n (leads.*) so the detail toggle stays consistent with the
// list/dashboard wording (generic "Nouveau / En cours / Traité") and the 3
// languages. Colors mirror the list badges (orange / green / teal).
const STATUS_OPTIONS: {
    value: SubmissionStatus;
    labelKey: TranslationKey;
    color: string;
    activeColor: string;
}[] = [
    {
        value: "new",
        labelKey: "leads.new",
        color: "border-orange/30 text-orange hover:bg-orange-soft",
        activeColor: "bg-orange text-white border-orange",
    },
    {
        value: "contacted",
        labelKey: "leads.contacted",
        color: "border-green/30 text-green hover:bg-green-soft",
        activeColor: "bg-green text-white border-green",
    },
    {
        value: "done",
        labelKey: "leads.done",
        color: "border-brand/30 text-brand hover:bg-brand-soft",
        activeColor: "bg-brand text-white border-brand",
    },
];

export function SubmissionStatusToggle({ submissionId, currentStatus }: SubmissionStatusProps) {
    const { t } = useLanguage();
    const [status, setStatus] = useState(currentStatus);
    const [loading, setLoading] = useState(false);

    async function handleChange(newStatus: SubmissionStatus) {
        if (newStatus === status) return;

        setLoading(true);
        const result = await updateSubmissionStatusAction(submissionId, newStatus);
        setLoading(false);

        if (result.success) {
            setStatus(newStatus);
        } else {
            toast.error(result.error || t("submissions.status_update_failed"));
        }
    }

    return (
        <div
            className="flex rounded-lg border border-border overflow-hidden"
            role="group"
            aria-label={t("submissions.col_status")}>
            {STATUS_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    onClick={() => handleChange(option.value)}
                    disabled={loading}
                    aria-pressed={status === option.value}
                    aria-label={t(option.labelKey)}
                    className={`cursor-pointer px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        status === option.value
                            ? option.activeColor
                            : option.color + " bg-background"
                    }`}>
                    {t(option.labelKey)}
                </button>
            ))}
        </div>
    );
}
