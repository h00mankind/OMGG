import { cn } from "@/lib/utils";

export function WinRateBar({
  wins,
  matches,
  className,
}: {
  wins: number;
  matches: number;
  className?: string;
}) {
  if (matches <= 0) {
    return <span className={cn("text-sm text-muted-foreground", className)}>—</span>;
  }
  const pct = (wins / matches) * 100;
  const tone =
    pct >= 60
      ? "text-emerald-400"
      : pct >= 45
        ? "text-amber-300"
        : "text-rose-400";
  const barTone =
    pct >= 60
      ? "bg-emerald-400"
      : pct >= 45
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <span className={cn("text-sm font-semibold tabular-nums", tone)}>
        {pct.toFixed(1)}%
      </span>
      <span className="block h-1 w-20 overflow-hidden bg-white/10">
        <span
          className={cn("block h-full", barTone)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </span>
    </div>
  );
}
