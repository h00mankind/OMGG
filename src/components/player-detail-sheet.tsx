"use client";

import { useEffect } from "react";
import { X, Flame } from "lucide-react";
import type { EntryRow } from "@/lib/entry-stats";
import { entryKindShortLabel, normalizeEntryKind } from "@/lib/entry-kinds";
import { cn } from "@/lib/utils";

export type PlayerDetail = {
  id: string;
  name: string;
  gg: number;
  matches: number;
  lastGg: Date | null;
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

  const ratio =
    player.matches > 0
      ? ((player.gg / player.matches) * 100).toFixed(0) + "%"
      : "—";

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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full max-w-2xl border border-border bg-background shadow-2xl",
          "max-h-[85vh] overflow-y-auto",
          "sm:mx-4",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background/95 backdrop-blur-sm px-8 py-4">
          <div className="min-w-0">
            <h2 id="player-detail-title" className="text-xl font-bold truncate">
              {player.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {player.lastGg
                ? `Last GG ${timeAgo(player.lastGg)}`
                : "No GGs yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="px-8 py-5 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="GG" value={player.gg} />
            <Stat label="Matches" value={player.matches} />
            <Stat label="GG rate" value={ratio} />
            <Stat
              label="Best streak"
              value={player.longestStreak}
              icon={player.longestStreak >= 3 ? <Flame className="size-3 text-orange-500" /> : null}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent activity
            </h3>
            {playerEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing logged yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {playerEntries.map((e, i) => {
                  const kind = normalizeEntryKind(e.kind);
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between px-2 py-1.5 text-sm odd:bg-muted/30"
                    >
                      <span className="font-medium text-foreground">
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
    <div className="border border-border bg-card p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
