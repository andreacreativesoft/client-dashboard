"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type BarItem = {
    label: string;
    value: number;
};

const ALTERNATING = ["var(--brand)", "var(--orange)"];

interface SiteBarChartProps {
    data: BarItem[];
    height?: number;
    layout?: "vertical" | "horizontal";
    alternateColors?: boolean;
    barColor?: string;
}

export function SiteBarChart({
    data,
    height = 280,
    layout = "vertical",
    alternateColors = true,
    barColor = "var(--brand)",
}: SiteBarChartProps) {
    const isHorizontal = layout === "horizontal";

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout={isHorizontal ? "vertical" : "horizontal"}
                    margin={{ top: 8, right: 16, left: isHorizontal ? 80 : 0, bottom: 0 }}>
                    <CartesianGrid
                        stroke="var(--border)"
                        vertical={isHorizontal}
                        horizontal={!isHorizontal}
                    />
                    {isHorizontal ? (
                        <>
                            <XAxis
                                type="number"
                                stroke="var(--ink-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                stroke="var(--ink-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={120}
                            />
                        </>
                    ) : (
                        <>
                            <XAxis
                                dataKey="label"
                                stroke="var(--ink-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="var(--ink-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                        </>
                    )}
                    <Tooltip
                        contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #E5E7EB",
                            backgroundColor: "white",
                            fontSize: 12,
                        }}
                        cursor={{ fill: "var(--line)" }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={entry.label}
                                fill={
                                    alternateColors
                                        ? ALTERNATING[index % ALTERNATING.length]
                                        : barColor
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
