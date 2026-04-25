import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PodiumRank } from "@/components/podium-rank";
import { WinRateBar } from "@/components/win-rate-bar";
import { playerColor, playerInitial } from "@/lib/player-color";

export type PlayerRowData = {
  id: string;
  name: string;
  rank: number;
  metricLabel: string;
  metricValue: number;
  matches: number;
  wins: number;
  losses: number;
  gg: number;
  mvp: number;
  svp: number;
  lastAtLabel: string | null;
  isViewer?: boolean;
};

export function PlayerRow({
  data,
  onClick,
}: {
  data: PlayerRowData;
  onClick?: () => void;
}) {
  const c = playerColor(data.id);
  const hasValue = data.metricValue > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group grid w-full items-center gap-4 px-5 py-4 text-left transition-colors",
        "grid-cols-[3rem_1fr_4rem_5rem_8rem_5rem]",
        "border-t border-white/5 hover:bg-white/[0.03]",
        data.isViewer && "bg-primary/5",
      )}
    >
      <span className="flex justify-center">
        <PodiumRank rank={data.rank} hasValue={hasValue} />
      </span>

      <span className="flex min-w-0 items-center gap-3">
        <Avatar className={cn("size-10 shrink-0", c.bg)}>
          <AvatarFallback className={cn(c.bg, c.text, "font-semibold text-sm")}>
            {playerInitial(data.name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-semibold uppercase tracking-[0.06em] text-foreground">
            {data.name}
            {data.isViewer && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                You
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            GG {data.gg} · MVP {data.mvp} · SVP {data.svp} · W-L {data.wins}-{data.losses}
          </span>
        </span>
      </span>

      <span className="text-right font-display text-lg font-semibold tabular-nums text-foreground">
        {data.metricValue}
      </span>

      <span className="text-right font-display text-base font-medium tabular-nums text-foreground/90">
        {data.matches}
      </span>

      <span className="flex justify-end">
        <WinRateBar wins={data.wins} matches={data.matches} />
      </span>

      <span className="text-right text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {data.lastAtLabel ?? "—"}
      </span>
    </button>
  );
}

export function PlayerRowHeader({ metricLabel }: { metricLabel: string }) {
  return (
    <div
      className={cn(
        "grid w-full items-center gap-4 px-5 py-3",
        "grid-cols-[3rem_1fr_4rem_5rem_8rem_5rem]",
        "text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground",
      )}
    >
      <span className="text-center">#</span>
      <span>Player</span>
      <span className="text-right">{metricLabel}</span>
      <span className="text-right">Matches</span>
      <span className="text-right">Win Rate</span>
      <span className="text-right">Last {metricLabel}</span>
    </div>
  );
}
