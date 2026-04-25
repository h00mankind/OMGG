"use client";

import { Line, LineChart } from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type TrendPoint = { day: string; value: number };

const config: ChartConfig = {
  value: { label: "GG", color: "var(--primary)" },
};

export function MmrTrendCard({
  total,
  delta,
  series,
  label = "GG Trend",
}: {
  total: number;
  delta: number;
  series: TrendPoint[];
  label?: string;
}) {
  const deltaTone =
    delta > 0
      ? "bg-emerald-500/15 text-emerald-400"
      : delta < 0
        ? "bg-rose-500/15 text-rose-400"
        : "bg-muted/40 text-muted-foreground";
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0";

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-baseline justify-between border-b border-white/5 px-5 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {label}
        </h3>
      </header>
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums text-foreground">
            {total}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 font-display text-xs font-semibold tabular-nums",
              deltaTone,
            )}
          >
            {deltaText}
          </span>
        </div>
        <ChartContainer config={config} className="mt-3 h-20 w-full">
          <LineChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 6 }}>
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "var(--color-value)" }}
              activeDot={{ r: 3.5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  );
}
