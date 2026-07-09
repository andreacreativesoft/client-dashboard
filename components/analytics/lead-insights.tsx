import { t } from "@/lib/i18n/translations";
import type { AppLanguage } from "@/types/database";

type Props = {
    /** Comptes quotidiens de prospects sur 30 jours (agrégés en base). */
    dailyCounts: { date: string; count: number }[];
    /** Sources d'origine des prospects, triées, avec leur volume. */
    topSources: { source: string; count: number }[];
    lang: AppLanguage;
};

/**
 * Deux visualisations "prospects" (tendance 30 j + sources) affichées sous la
 * liste des contacts. Volontairement hors de la page "Analyse du site", qui
 * reste dédiée à la fréquentation web.
 */
export function LeadInsights({ dailyCounts, topSources, lang }: Props) {
    // 30-day skeleton filled from the sparse daily counts.
    const now = new Date();
    const dailyLeads: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
        const key = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        if (key) dailyLeads[key] = 0;
    }
    for (const row of dailyCounts) {
        const key = row.date.slice(0, 10);
        if (dailyLeads[key] !== undefined) dailyLeads[key] = row.count;
    }

    const maxCount = Math.max(...Object.values(dailyLeads), 1);

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Lead trend — simple bar visualization */}
            <div className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                <p className="mb-4 text-[16px] font-bold text-ink">
                    {t(lang, "analytics.lead_trend")}
                </p>
                <div className="flex h-32 items-end gap-1">
                    {Object.entries(dailyLeads).map(([date, count], i) => {
                        const height = count > 0 ? Math.max((count / maxCount) * 100, 4) : 2;
                        return (
                            <div
                                key={date}
                                className="flex-1 rounded-t transition-all"
                                style={{
                                    height: `${height}%`,
                                    backgroundColor: i % 2 === 0 ? "var(--brand)" : "var(--orange)",
                                }}
                                title={`${date}: ${count}`}
                            />
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-between text-xs text-ink-muted">
                    <span>{t(lang, "analytics.days_ago")}</span>
                    <span>{t(lang, "analytics.today")}</span>
                </div>
            </div>

            {/* Top sources */}
            <div className="rounded-[24px] bg-white p-6 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]">
                <p className="mb-4 text-[16px] font-bold text-ink">
                    {t(lang, "analytics.top_sources")}
                </p>
                {topSources.length === 0 ? (
                    <p className="text-[14px] text-ink-muted">
                        {t(lang, "analytics.no_leads_yet")}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {topSources.map(({ source, count }, index) => (
                            <div key={source} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                                        style={{
                                            backgroundColor:
                                                index % 2 === 0 ? "var(--brand)" : "var(--orange)",
                                        }}>
                                        {index + 1}
                                    </span>
                                    <span className="text-[14px] text-ink">{source}</span>
                                </div>
                                <span className="text-[14px] font-bold text-ink">{count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
