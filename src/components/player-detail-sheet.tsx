"use client";

import { useEffect } from "react";
import { X, Flame, Trophy } from "lucide-react";
import type { EntryRow } from "@/lib/entry-stats";
import { entryKindShortLabel, normalizeEntryKind } from "@/lib/entry-kinds";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WinRateBar } from "@/components/win-rate-bar";
import { playerColor, playerInitial } from "@/lib/player-color";
import { cn } from "@/lib/utils";

export type PlayerDetail = {
  id: string;
  name: string;
  gg: number;
  mvp: number;
  svp: number;
  totalTitles: number;
  matches: number;
  wins: number;
  losses: number;
  lastGg: Date | null;
  lastMvp: Date | null;
  lastSvp: Date | null;
  longestStreak: number;
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Props = {
  player: PlayerDetail | null;
  entries: EntryRow[];
  onClose: () => void;
};

export function PlayerDetailSheet({ player, entries, onClose }: Props) {
  useEffect(() => {
    if (!player) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [player, onClose]);

  if (!player) return null;

  const playerEntries = entries
    .filter((e) => e.playerId === player.id)
    .slice(0, 20);

  const winRate =
    player.matches > 0
      ? ((player.wins / player.matches) * 100).toFixed(0) + "%"
      : "—";
  const lastTitles = [
    { label: "GG", date: player.lastGg },
    { label: "MVP", date: player.lastMvp },
    { label: "SVP", date: player.lastSvp },
  ].filter((item) => item.date);
  const c = playerColor(player.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "surface-card relative w-full max-w-2xl shadow-2xl",
          "max-h-[85vh] overflow-y-auto",
          "sm:mx-4",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/5 bg-card/95 backdrop-blur-sm px-8 py-5">
          <Avatar className={cn("size-14 shrink-0 ring-2 ring-primary/40", c.bg)}>
            <AvatarFallback className={cn(c.bg, c.text, "text-lg font-bold")}>
              {playerInitial(player.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Trophy className="size-3.5 text-amber-400" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                Player Profile
              </span>
            </div>
            <h2
              id="player-detail-title"
              className="mt-0.5 font-display text-2xl font-bold uppercase tracking-[0.05em] text-foreground"
            >
              {player.name}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastTitles.length > 0
                ? `Last title ${timeAgo(
                    [...lastTitles].sort(
                      (a, b) => b.date!.getTime() - a.date!.getTime()
                    )[0].date!
                  )}`
                : "No title entries yet"}
            </p>
            {lastTitles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lastTitles.map((item) => (
                  <Badge
                    key={item.label}
                    variant="outline"
                    className="border-white/10 text-[10px] uppercase tracking-[0.18em]"
                  >
                    {item.label} · {timeAgo(item.date!)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 px-8 py-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="GG" value={player.gg} />
            <Stat label="MVP" value={player.mvp} />
            <Stat label="SVP" value={player.svp} />
            <Stat label="Titles" value={player.totalTitles} />
            <Stat label="Matches" value={player.matches} />
            <Stat label="W-L" value={`${player.wins}-${player.losses}`} />
            <Stat label="Win Rate" value={winRate} />
            <Stat
              label="Best Streak"
              value={player.longestStreak}
              icon={
                player.longestStreak >= 3 ? (
                  <Flame className="size-4 text-orange-500" />
                ) : null
              }
            />
          </div>

          {player.matches > 0 && (
            <div className="surface-elevated flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Win Rate
                </div>
                <div className="mt-0.5 font-display text-base font-semibold uppercase tracking-[0.06em] text-foreground">
                  {player.wins} W / {player.losses} L
                </div>
              </div>
              <WinRateBar wins={player.wins} matches={player.matches} />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Recent Activity
            </h3>
            {playerEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            ) : (
              <ul className="surface-elevated divide-y divide-white/5">
                {playerEntries.map((e, i) => {
                  const kind = normalizeEntryKind(e.kind);
                  return (
                    <li
                      key={e.id ?? `${e.playerId}-${e.createdAt.toISOString()}-${i}`}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                        +1 {entryKindShortLabel(kind)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(e.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface-elevated px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold tabular-nums text-foreground">
        {icon}
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
