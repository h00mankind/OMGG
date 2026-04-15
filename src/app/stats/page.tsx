"use client";

import { useState } from "react";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import {
  aggregateByPlayer,
  aggregateMatchesByPlayer,
  computeStreaks,
} from "@/lib/entry-stats";
import { PlayerDetailSheet, type PlayerDetail } from "@/components/player-detail-sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Flame } from "lucide-react";

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
  const { longestByPlayer, currentHolderId, currentLength } = computeStreaks(entries);

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
    <div className="mx-auto max-w-2xl px-8 pt-5 pb-32 space-y-5">
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive p-4 text-destructive text-center">
          Something went wrong: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="size-5 text-orange-500" aria-hidden />
                Streaks
              </CardTitle>
              <CardDescription>
                Consecutive GGs by the same player without another player scoring in between.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {showFire ? (
                <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <Flame className="size-7 text-orange-500 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">
                      {currentHolder!.name} is on fire
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currentLength} GG in a row — and counting
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-none border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No active streak
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Log 2 GGs in a row to set one.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Longest ever
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Best run</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((p) => (
                        <TableRow
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.longest > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                {p.longest >= 3 && (
                                  <Flame className="size-3.5 text-orange-500" aria-hidden />
                                )}
                                {p.longest}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Player stats</CardTitle>
              <CardDescription>
                Lifetime title totals, normalized match record, and click-through player detail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">GG</TableHead>
                      <TableHead className="text-right">MVP</TableHead>
                      <TableHead className="text-right">SVP</TableHead>
                      <TableHead className="text-right">Matches</TableHead>
                      <TableHead className="text-right">W-L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((p) => (
                      <TableRow
                        key={`stats-${p.id}`}
                        onClick={() => setSelectedId(p.id)}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Titles {p.totalTitles} · Win rate{" "}
                            {p.matches > 0
                              ? `${Math.round((p.wins / p.matches) * 100)}%`
                              : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.gg}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.mvp}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.svp}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.matches}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.matches > 0 ? `${p.wins}-${p.losses}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {matchSummary.inferredLegacyMatches > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Includes {matchSummary.inferredLegacyMatches} legacy match
                  {matchSummary.inferredLegacyMatches === 1 ? "" : "es"} inferred
                  from old `entries` timestamps.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <PlayerDetailSheet
        player={selectedPlayer}
        entries={entries}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
