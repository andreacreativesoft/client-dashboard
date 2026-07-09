"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type LineChartPoint = {
    label: string;
    value: number;
    secondaryValue?: number;
};

interface SiteLineChartProps {
    data: LineChartPoint[];
    height?: number;
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

export function SiteLineChart({
    data,
    height = 280,
    primaryLabel = "Visiteurs",
    secondaryLabel,
    primaryColor = "var(--brand)",
    secondaryColor = "var(--orange)",
}: SiteLineChartProps) {
    const hasSecondary = data.some((d) => typeof d.secondaryValue === "number");

    return (
        <div style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="primaryFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={primaryColor} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
                        </linearGradient>
                        {hasSecondary && (
                            <linearGradient id="secondaryFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={secondaryColor} stopOpacity={0.25} />
                                <stop offset="100%" stopColor={secondaryColor} stopOpacity={0} />
                            </linearGradient>
                        )}
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
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
                    <Tooltip
                        contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #E5E7EB",
                            backgroundColor: "white",
                            fontSize: 12,
                        }}
                        cursor={{ stroke: "var(--brand-border)", strokeWidth: 1 }}
                    />
                    {hasSecondary && (
                        <Area
                            type="monotone"
                            dataKey="secondaryValue"
                            name={secondaryLabel}
                            stroke={secondaryColor}
                            strokeWidth={2}
                            fill="url(#secondaryFill)"
                            activeDot={{ r: 5 }}
                        />
                    )}
                    <Area
                        type="monotone"
                        dataKey="value"
                        name={primaryLabel}
                        stroke={primaryColor}
                        strokeWidth={2}
                        fill="url(#primaryFill)"
                        activeDot={{ r: 5 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
