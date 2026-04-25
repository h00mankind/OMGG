"use client";

import { useState } from "react";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import {
  aggregateByPlayer,
  aggregateMatchesByPlayer,
  computeStreaks,
} from "@/lib/entry-stats";
import {
  PlayerDetailSheet,
  type PlayerDetail,
} from "@/components/player-detail-sheet";
import { PageLayout } from "@/components/page-layout";
import { PageHeader } from "@/components/page-header";
import { TipCard } from "@/components/tip-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WinRateBar } from "@/components/win-rate-bar";
import { Flame, Trophy, BarChart3 } from "lucide-react";
import { playerColor, playerInitial } from "@/lib/player-color";
import { cn } from "@/lib/utils";

const rosterById = new Map(ROSTER.map((p) => [p.id, p]));

export default function StatsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { isLoading, error, data } = db.useQuery({
    entries: {
      $: {
        where: { title: CURRENT_TITLE },
        order: { serverCreatedAt: "desc" },
      },
    },
    matches: {
      $: {
        where: { title: CURRENT_TITLE },
        order: { playedAt: "desc" },
      },
      players: {},
    },
  });

  const entries = data?.entries ?? [];
  const matches = data?.matches ?? [];
  const byPlayer = aggregateByPlayer(entries);
  const matchSummary = aggregateMatchesByPlayer(matches, entries);
  const matchByPlayer = matchSummary.byPlayer;
  const { longestByPlayer, currentHolderId, currentLength } =
    computeStreaks(entries);

  const currentHolder = currentHolderId ? rosterById.get(currentHolderId) : null;
  const showFire = currentHolder && currentLength >= 2;

  const sorted = ROSTER.map((p) => ({
    ...p,
    ...(byPlayer.get(p.id) ?? {
      gg: 0,
      mvp: 0,
      svp: 0,
      totalTitles: 0,
      lastGg: null,
      lastMvp: null,
      lastSvp: null,
    }),
    ...(matchByPlayer.get(p.id) ?? {
      matches: 0,
      wins: 0,
      losses: 0,
      lastMatch: null,
      lastWin: null,
      lastLoss: null,
    }),
    longest: longestByPlayer.get(p.id) ?? 0,
  })).sort((a, b) => {
    if (b.totalTitles !== a.totalTitles) return b.totalTitles - a.totalTitles;
    if (b.matches !== a.matches) return b.matches - a.matches;
    return b.longest - a.longest;
  });

  const selectedPlayer: PlayerDetail | null = selectedId
    ? (() => {
        const row = sorted.find((p) => p.id === selectedId);
        if (!row) return null;
        const agg = byPlayer.get(row.id);
        const matchAgg = matchByPlayer.get(row.id);
        return {
          id: row.id,
          name: row.name,
          gg: agg?.gg ?? row.gg,
          mvp: agg?.mvp ?? row.mvp,
          svp: agg?.svp ?? row.svp,
          totalTitles: agg?.totalTitles ?? row.totalTitles,
          matches: matchAgg?.matches ?? row.matches,
          wins: matchAgg?.wins ?? row.wins,
          losses: matchAgg?.losses ?? row.losses,
          lastGg: agg?.lastGg ?? row.lastGg,
          lastMvp: agg?.lastMvp ?? row.lastMvp,
          lastSvp: agg?.lastSvp ?? row.lastSvp,
          longestStreak: longestByPlayer.get(row.id) ?? 0,
        };
      })()
    : null;

  return (
    <PageLayout
      header={
        <PageHeader
          eyebrow={
            <>
              <BarChart3 className="size-3" aria-hidden />
              <span>Lifetime numbers</span>
            </>
          }
          title="Stats"
          subtitle="Streaks, titles, and head-to-head records across the current title."
          banner="/banners/stats.svg"
          bannerAlt="Stats banner"
        />
      }
      rail={
        <>
          <TipCard
            title="Streak rules"
            body="A streak counts consecutive GGs by the same player without anyone else scoring in between. Two in a row sets the fire."
          />
          {matchSummary.inferredLegacyMatches > 0 && (
            <TipCard
              title="Legacy"
              body={`${matchSummary.inferredLegacyMatches} legacy match${
                matchSummary.inferredLegacyMatches === 1 ? "" : "es"
              } inferred from old entries timestamps. They'll always show win-rate "—" because we never recorded who won.`}
            />
          )}
        </>
      }
    >
      {isLoading && (
        <div className="space-y-4">
          <div className="h-24 surface-card animate-pulse" />
          <div className="h-72 surface-card animate-pulse" />
        </div>
      )}

      {error && (
        <div className="surface-card border border-destructive/40 px-5 py-6 text-center text-destructive">
          Something went wrong: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-orange-400" aria-hidden />
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
                  Streaks
                </h2>
              </div>
            </header>
            <div className="space-y-5 px-5 py-5">
              {showFire ? (
                <div className="flex items-center gap-3 border border-orange-500/30 bg-orange-500/10 p-4 glow-primary-soft">
                  <Flame className="size-7 shrink-0 text-orange-500" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold uppercase tracking-[0.06em] text-foreground">
                      {currentHolder!.name} is on fire
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currentLength} GG in a row — and counting
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                    No active streak
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Log 2 GGs in a row to set one.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  Longest Ever
                </h3>
                <ul className="surface-elevated divide-y divide-white/5">
                  {sorted.map((p) => {
                    const c = playerColor(p.id);
                    return (
                      <li
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                      >
                        <Avatar className={cn("size-8 shrink-0", c.bg)}>
                          <AvatarFallback
                            className={cn(c.bg, c.text, "text-xs font-semibold")}
                          >
                            {playerInitial(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                          {p.name}
                        </span>
                        {p.longest > 0 ? (
                          <span className="inline-flex items-center gap-1 font-display text-base font-bold tabular-nums text-foreground">
                            {p.longest >= 3 && (
                              <Flame
                                className="size-3.5 text-orange-500"
                                aria-hidden
                              />
                            )}
                            {p.longest}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-amber-400" aria-hidden />
                <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
                  Player Stats
                </h2>
              </div>
            </header>
            <div className="px-2 py-2">
              <ul>
                {sorted.map((p) => {
                  const c = playerColor(p.id);
                  return (
                    <li
                      key={`stats-${p.id}`}
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "grid cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-white/5",
                        "grid-cols-[auto_1fr_4rem_4rem_4rem_5rem_8rem]",
                      )}
                    >
                      <Avatar className={cn("size-10 shrink-0", c.bg)}>
                        <AvatarFallback
                          className={cn(c.bg, c.text, "text-sm font-semibold")}
                        >
                          {playerInitial(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {p.totalTitles} titles · {p.matches} matches
                        </div>
                      </div>
                      <Stat label="GG" value={p.gg} />
                      <Stat label="MVP" value={p.mvp} />
                      <Stat label="SVP" value={p.svp} />
                      <Stat
                        label="W-L"
                        value={p.matches > 0 ? `${p.wins}-${p.losses}` : "—"}
                      />
                      <span className="flex justify-end">
                        <WinRateBar wins={p.wins} matches={p.matches} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </>
      )}

      <PlayerDetailSheet
        player={selectedPlayer}
        entries={entries}
        onClose={() => setSelectedId(null)}
      />
    </PageLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="text-right">
      <span className="block font-display text-base font-bold tabular-nums text-foreground">
        {value}
      </span>
      <span className="block text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}
