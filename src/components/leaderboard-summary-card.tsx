import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { PodiumRank } from "@/components/podium-rank";

export type SummaryStat = {
  label: string;
  value: number | string;
  highlight?: boolean;
  rank?: number | null;
};

export function LeaderboardSummaryCard({
  rank,
  stats,
  className,
}: {
  rank: number | null;
  stats: SummaryStat[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card flex items-stretch divide-x divide-white/5 px-5 py-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3 pr-5">
        {rank && rank >= 1 && rank <= 3 ? (
          <PodiumRank rank={rank} className="size-12" />
        ) : (
          <span className="flex size-12 items-center justify-center bg-primary/10 text-primary glow-primary-soft">
            <Trophy className="size-6" strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "flex flex-1 flex-col justify-center px-5",
            i === 0 && "pl-5",
          )}
        >
          <div
            className={cn(
              "font-display text-3xl font-bold tabular-nums tracking-tight",
              s.highlight ? "text-foreground" : "text-foreground/90",
            )}
          >
            {s.value}
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.25em]",
              s.highlight ? "text-primary" : "text-muted-foreground",
            )}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
