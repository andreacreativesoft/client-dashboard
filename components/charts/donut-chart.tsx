"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DonutSlice = {
    label: string;
    value: number;
    color?: string;
};

const DEFAULT_PALETTE = [
    "var(--brand)",
    "var(--orange)",
    "var(--brand-border)",
    "var(--brand-border)",
    "var(--ink)",
    "var(--ink-muted)",
];

interface SiteDonutChartProps {
    data: DonutSlice[];
    height?: number;
    innerRadius?: number;
    outerRadius?: number;
    showLabels?: boolean;
}

export function SiteDonutChart({
    data,
    height = 240,
    innerRadius = 60,
    outerRadius = 95,
    showLabels = true,
}: SiteDonutChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <div className="flex w-full flex-col items-center gap-4 md:flex-row">
            <div className="shrink-0" style={{ width: "60%", maxWidth: 320, height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={innerRadius}
                            outerRadius={outerRadius}
                            paddingAngle={2}
                            stroke="white"
                            strokeWidth={2}>
                            {data.map((slice, index) => (
                                <Cell
                                    key={slice.label}
                                    fill={
                                        slice.color ??
                                        DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
                                    }
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                borderRadius: 8,
                                border: "1px solid #E5E7EB",
                                backgroundColor: "white",
                                fontSize: 12,
                            }}
                            formatter={(value) => {
                                const v = typeof value === "number" ? value : 0;
                                return [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`];
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {showLabels && (
                <ul className="flex flex-1 flex-col gap-2 text-sm">
                    {data.map((slice, index) => {
                        const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
                        const color =
                            slice.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
                        return (
                            <li key={slice.label} className="flex items-center gap-2">
                                <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="flex-1 text-ink">{slice.label}</span>
                                <span className="font-bold text-ink">{percent}%</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
