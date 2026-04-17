"use client";

import { useState } from "react";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_GG,
  entryKindShortLabel,
} from "@/lib/entry-kinds";
import {
  aggregateByPlayer,
  aggregateMatchesByPlayer,
  computeStreaks,
  playerMetricCount,
  playerMetricLastAt,
  RANK_METRICS,
  titleStackedByDay,
  titleStackedByMonth,
  titleStackedByWeek,
  trendByPlayer,
  type RankMetric,
  type Trend,
} from "@/lib/entry-stats";
import { PlayerDetailSheet, type PlayerDetail } from "@/components/player-detail-sheet";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Bar, BarChart, Line, LineChart,
  CartesianGrid, XAxis, YAxis,
} from "recharts";

type ChartInterval = "daily" | "weekly" | "monthly";
type ChartType = "bar" | "line";

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

const rosterById = new Map(ROSTER.map((p) => [p.id, p]));

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "up")
    return (
      <span className="inline-flex size-6 items-center justify-center bg-emerald-500/15 text-emerald-500">
        <ChevronUp className="size-3.5" strokeWidth={2.5} aria-label="Up" />
      </span>
    );
  if (trend === "down")
    return (
      <span className="inline-flex size-6 items-center justify-center bg-rose-500/15 text-rose-500">
        <ChevronDown className="size-3.5" strokeWidth={2.5} aria-label="Down" />
      </span>
    );
  return (
    <span className="inline-flex size-6 items-center justify-center text-muted-foreground/40">
      <Minus className="size-3" aria-label="Stable" />
    </span>
  );
}

const INTERVAL_LABELS: Record<ChartInterval, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const TYPE_LABELS: Record<ChartType, string> = { bar: "Bar", line: "Line" };

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const dayGgChartConfig = Object.fromEntries(
  ROSTER.map((p, i) => [
    p.id,
    { label: p.name, color: CHART_COLORS[i % CHART_COLORS.length] },
  ])
) satisfies ChartConfig;

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-muted/20 px-3 py-2">
      <div className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default function Home() {
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
      titles: {},
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rankMetric, setRankMetric] = useState<RankMetric>(ENTRY_KIND_GG);
  const [chartInterval, setChartInterval] = useState<ChartInterval>("daily");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const entries = data?.entries ?? [];
  const matches = data?.matches ?? [];
  const byPlayer = aggregateByPlayer(entries);
  const matchSummary = aggregateMatchesByPlayer(matches, entries);
  const matchByPlayer = matchSummary.byPlayer;
  const chartSeries =
    chartInterval === "weekly" ? titleStackedByWeek(entries, rankMetric) :
    chartInterval === "monthly" ? titleStackedByMonth(entries, rankMetric) :
    titleStackedByDay(entries, rankMetric);
  const { longestByPlayer } = computeStreaks(entries);
  const trends = trendByPlayer(entries, rankMetric);
  const metricLabel = entryKindShortLabel(rankMetric);

  const leaderboard = ROSTER.map((p) => ({
    ...p,
    ...byPlayer.get(p.id)!,
    ...matchByPlayer.get(p.id)!,
  })).sort((a, b) => {
    const aValue = playerMetricCount(a, rankMetric);
    const bValue = playerMetricCount(b, rankMetric);
    if (bValue !== aValue) return bValue - aValue;
    const aLast = playerMetricLastAt(a, rankMetric);
    const bLast = playerMetricLastAt(b, rankMetric);
    if (aLast && bLast) return bLast.getTime() - aLast.getTime();
    if (aLast) return -1;
    if (bLast) return 1;
    return 0;
  });

  const medalFor = (rank: number, value: number) => {
    if (value === 0) return "";
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return "";
  };

  const recentMatches = matches.slice(0, 8);
  const titleOrder: Record<string, number> = { gg: 0, mvp: 1, svp: 2 };
  const titleLabels: Record<string, string> = { gg: "GG", mvp: "MVP", svp: "SVP" };

  const displayNameFor = (playerId: string | null | undefined, fallback: string) =>
    (playerId && rosterById.get(playerId)?.name) || fallback;
  const totalMetric = leaderboard.reduce(
    (sum, p) => sum + playerMetricCount(p, rankMetric),
    0
  );
  const totals = leaderboard.reduce(
    (sum, p) => {
      sum.gg += p.gg;
      sum.mvp += p.mvp;
      sum.svp += p.svp;
      return sum;
    },
    { gg: 0, mvp: 0, svp: 0 }
  );

  const selectedPlayer: PlayerDetail | null = selectedId
    ? (() => {
        const row = leaderboard.find((p) => p.id === selectedId);
        if (!row) return null;
        return {
          id: row.id,
          name: row.name,
          gg: row.gg,
          mvp: row.mvp,
          svp: row.svp,
          totalTitles: row.totalTitles,
          matches: row.matches,
          wins: row.wins,
          losses: row.losses,
          lastGg: row.lastGg,
          lastMvp: row.lastMvp,
          lastSvp: row.lastSvp,
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
                <div>
                  <CardTitle>Leaderboard</CardTitle>
                  <CardDescription>
                    Rank by GG, MVP, or SVP. GG stays the default.
                  </CardDescription>
                </div>
                <CardAction>
                  <div className="flex border border-border overflow-hidden">
                    {RANK_METRICS.map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setRankMetric(metric)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium uppercase transition-colors",
                          rankMetric === metric
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {entryKindShortLabel(metric)}
                      </button>
                    ))}
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatChip label="GG" value={totals.gg} />
                  <StatChip label="MVP" value={totals.mvp} />
                  <StatChip label="SVP" value={totals.svp} />
                  <StatChip label="Matches" value={matchSummary.totalMatches} />
                </div>
                {matchSummary.inferredLegacyMatches > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {matchSummary.inferredLegacyMatches} legacy match
                    {matchSummary.inferredLegacyMatches === 1 ? "" : "es"} inferred
                    from old `entries` timestamps.
                  </p>
                )}
                {totalMetric === 0 && (
                  <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No {metricLabel} entries yet.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Log one to kick off this ranking.
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">{metricLabel}</TableHead>
                        <TableHead className="text-right">Matches</TableHead>
                        <TableHead className="text-right whitespace-nowrap">
                          Last {metricLabel}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((p, i) => {
                        const lastAt = playerMetricLastAt(p, rankMetric);
                        return (
                          <TableRow
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className="cursor-pointer transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <TrendBadge trend={trends.get(p.id) ?? "flat"} />
                                <span className="text-muted-foreground tabular-nums">
                                  {medalFor(i, playerMetricCount(p, rankMetric)) || i + 1}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                GG {p.gg} · MVP {p.mvp} · SVP {p.svp} · W-L {p.wins}-{p.losses}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {playerMetricCount(p, rankMetric)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {p.matches}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                              {lastAt ? timeAgo(lastAt) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{metricLabel} Chart</CardTitle>
                  <CardDescription>
                    {chartInterval === "daily" ? "Last 14 days" :
                     chartInterval === "weekly" ? "Last 12 weeks" : "Last 6 months"}
                    {" · "}ranking title only
                  </CardDescription>
                </div>
                <CardAction>
                  <div className="flex items-center gap-2">
                    {/* Interval toggle */}
                    <div className="flex border border-border overflow-hidden">
                      {(["daily", "weekly", "monthly"] as ChartInterval[]).map((iv) => (
                        <button
                          key={iv}
                          onClick={() => setChartInterval(iv)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium transition-colors",
                            chartInterval === iv
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {INTERVAL_LABELS[iv]}
                        </button>
                      ))}
                    </div>
                    {/* Type toggle */}
                    <div className="flex border border-border overflow-hidden">
                      {(["bar", "line"] as ChartType[]).map((ct) => (
                        <button
                          key={ct}
                          onClick={() => setChartType(ct)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium transition-colors",
                            chartType === ct
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {TYPE_LABELS[ct]}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={dayGgChartConfig}
                  className="aspect-auto h-56 w-full"
                >
                  {chartType === "bar" ? (
                    <BarChart
                      data={chartSeries}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} width={28} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel={false} indicator="dot" />} />
                      {ROSTER.map((p) => (
                        <Bar key={p.id} dataKey={p.id} name={p.name} stackId="stack" fill={`var(--color-${p.id})`} />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart
                      data={chartSeries}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} width={28} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel={false} indicator="dot" />} />
                      {ROSTER.map((p) => (
                        <Line
                          key={p.id}
                          dataKey={p.id}
                          name={p.name}
                          type="monotone"
                          stroke={`var(--color-${p.id})`}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>

            {recentMatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>
                    {(() => {
                      const count = recentMatches.length;
                      const total = matches.length;
                      const oldest = recentMatches[count - 1];
                      const oldestAt = oldest?.playedAt ?? oldest?.createdAt;
                      const span = oldestAt ? ` · since ${timeAgo(oldestAt)}` : "";
                      const more = total > count ? ` of ${total}` : "";
                      return `Last ${count} match${count === 1 ? "" : "es"}${more}${span}`;
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentMatches.map((m) => {
                    const playedAt = m.playedAt ?? m.createdAt;
                    const players = (m.players ?? [])
                      .slice()
                      .sort((a, b) => Number(b.won) - Number(a.won));
                    const winners = players.filter((p) => p.won);
                    const losers = players.filter((p) => !p.won);
                    const titles = (m.titles ?? [])
                      .slice()
                      .sort(
                        (a, b) =>
                          (titleOrder[a.titleKey] ?? 9) -
                          (titleOrder[b.titleKey] ?? 9)
                      );
                    const winningSideLabel =
                      m.winningSide === "radiant"
                        ? "Radiant won"
                        : m.winningSide === "dire"
                          ? "Dire won"
                          : "Match";

                    return (
                      <Card size="sm" key={m.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                m.winningSide === "dire"
                                  ? "bg-red-500/15 text-red-500"
                                  : "bg-emerald-500/15 text-emerald-500"
                              }`}
                            >
                              {winningSideLabel}
                            </span>
                          </CardTitle>
                          <CardAction>
                            <span className="text-[11px] text-muted-foreground">
                              {timeAgo(playedAt)}
                            </span>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="space-y-2.5">
                          {titles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {titles.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center gap-1.5 border border-border bg-muted/20 px-2 py-0.5 text-[11px]"
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {titleLabels[t.titleKey] ?? t.titleKey}
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {displayNameFor(t.playerId, t.displayName)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                            {winners.length > 0 && (
                              <>
                                <span className="font-semibold uppercase tracking-wide text-emerald-500">
                                  Won
                                </span>
                                <span className="text-foreground">
                                  {winners
                                    .map((p) => displayNameFor(p.playerId, p.displayName))
                                    .join(", ")}
                                </span>
                              </>
                            )}
                            {losers.length > 0 && (
                              <>
                                <span className="font-semibold uppercase tracking-wide text-rose-500">
                                  Lost
                                </span>
                                <span className="text-muted-foreground">
                                  {losers
                                    .map((p) => displayNameFor(p.playerId, p.displayName))
                                    .join(", ")}
                                </span>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </CardContent>
              </Card>
            )}
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
