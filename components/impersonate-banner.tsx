"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { stopImpersonation } from "@/lib/actions/impersonate";
import { useLanguage } from "@/lib/i18n/language-context";

interface ImpersonateBannerProps {
    clientName: string;
}

export function ImpersonateBanner({ clientName }: ImpersonateBannerProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    async function handleExit() {
        setLoading(true);
        await stopImpersonation();
        router.refresh();
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-warning px-4 py-2 text-warning-foreground">
            <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">
                    {t("impersonate.viewing_as")} <strong>{clientName}</strong>
                </span>
            </div>
            <button
                onClick={handleExit}
                disabled={loading}
                className="rounded bg-warning-foreground/20 px-3 py-1 text-sm font-medium hover:bg-warning-foreground/30 disabled:opacity-50">
                {loading ? t("impersonate.exiting") : t("impersonate.exit")}
            </button>
        </div>
    );
}
