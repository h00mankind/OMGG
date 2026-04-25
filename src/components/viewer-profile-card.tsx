"use client";

import { Trophy } from "lucide-react";
import { useViewer } from "@/lib/viewer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playerColor, playerInitial } from "@/lib/player-color";

export type ViewerProfileStats = {
  gg: number;
  matches: number;
  wins: number;
  losses: number;
  rank: number | null;
};

export function ViewerProfileCard({
  stats,
  onViewProfile,
  onPickViewer,
}: {
  stats: ViewerProfileStats | null;
  onViewProfile?: () => void;
  onPickViewer?: () => void;
}) {
  const { viewer } = useViewer();

  if (!viewer || !stats) {
    return (
      <section className="surface-card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Welcome
        </div>
        <h3 className="mt-1 font-display text-lg font-bold uppercase tracking-[0.06em] text-foreground">
          Pick a player
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Set your handle to see your stats here.
        </p>
        <Button
          className="mt-4 w-full glow-primary uppercase tracking-[0.16em]"
          onClick={onPickViewer}
        >
          Choose
        </Button>
      </section>
    );
  }

  const c = playerColor(viewer.id);
  const winRate =
    stats.matches > 0
      ? `${((stats.wins / stats.matches) * 100).toFixed(1)}%`
      : "—";
  const winRateTone =
    stats.matches === 0
      ? "text-muted-foreground"
      : stats.wins / stats.matches >= 0.6
        ? "text-emerald-400"
        : stats.wins / stats.matches >= 0.45
          ? "text-amber-300"
          : "text-rose-400";

  return (
    <section className="surface-card overflow-hidden">
      <div className="relative flex items-start gap-3 px-5 py-5">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />
        <Avatar className={cn("size-16 shrink-0 ring-2 ring-primary/40", c.bg)}>
          <AvatarFallback className={cn(c.bg, c.text, "text-xl font-bold")}>
            {playerInitial(viewer.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-amber-400" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Rank {stats.rank ?? "—"}
            </span>
          </div>
          <div className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.05em] text-foreground">
            {viewer.name}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="GG" value={stats.gg} />
            <Stat label="Matches" value={stats.matches} />
            <Stat label="Win Rate" value={winRate} valueClass={winRateTone} />
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <Button
          variant="outline"
          className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary uppercase tracking-[0.16em] glow-primary"
          onClick={onViewProfile}
        >
          View Profile
        </Button>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number | string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "font-display text-base font-bold tabular-nums",
          valueClass ?? "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
