"use client";

import { useState } from "react";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_GG,
  entryKindShortLabel,
  type EntryKind,
} from "@/lib/entry-kinds";
import {
  aggregateByPlayer,
  aggregateMatchesByPlayer,
  computeStreaks,
  ggCountsByDay,
  playerMetricCount,
  playerMetricLastAt,
  RANK_METRICS,
  titleStackedByDay,
  titleStackedByMonth,
  titleStackedByWeek,
  type RankMetric,
} from "@/lib/entry-stats";
import { useViewer } from "@/lib/viewer";
import {
  PlayerDetailSheet,
  type PlayerDetail,
} from "@/components/player-detail-sheet";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PageLayout } from "@/components/page-layout";
import { PageHeader } from "@/components/page-header";
import { LeaderboardSummaryCard } from "@/components/leaderboard-summary-card";
import { PlayerRow, PlayerRowHeader } from "@/components/player-row";
import { ViewerProfileCard } from "@/components/viewer-profile-card";
import {
  RecentMatchesCard,
  type RecentMatchItem,
} from "@/components/recent-matches-card";
import { MmrTrendCard, type TrendPoint } from "@/components/mmr-trend-card";
import { Flame, Sword } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
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

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const rosterById = new Map(ROSTER.map((p) => [p.id, p]));

const INTERVAL_LABELS: Record<ChartInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
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
  const { viewer } = useViewer();

  const entries = data?.entries ?? [];
  const matches = data?.matches ?? [];
  const byPlayer = aggregateByPlayer(entries);
  const matchSummary = aggregateMatchesByPlayer(matches, entries);
  const matchByPlayer = matchSummary.byPlayer;
  const chartSeries =
    chartInterval === "weekly"
      ? titleStackedByWeek(entries, rankMetric)
      : chartInterval === "monthly"
        ? titleStackedByMonth(entries, rankMetric)
        : titleStackedByDay(entries, rankMetric);
  const { longestByPlayer } = computeStreaks(entries);
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

  const recentEntriesByPlayer = (() => {
    const m = new Map<string, { kind: EntryKind; createdAt: Date }[]>();
    for (const e of entries) {
      const kind = e.kind ?? "gg";
      if (
        kind !== "gg" &&
        kind !== "mvp" &&
        kind !== "svp" &&
        kind !== "win" &&
        kind !== "loss"
      ) {
        continue;
      }
      const list = m.get(e.playerId) ?? [];
      list.push({ kind, createdAt: e.createdAt });
      m.set(e.playerId, list);
    }
    return m;
  })();

  const totals = leaderboard.reduce(
    (sum, p) => {
      sum.gg += p.gg;
      sum.mvp += p.mvp;
      sum.svp += p.svp;
      return sum;
    },
    { gg: 0, mvp: 0, svp: 0 }
  );

  const ranksByMetric = (() => {
    const result: Record<RankMetric, Map<string, number>> = {
      gg: new Map(),
      mvp: new Map(),
      svp: new Map(),
    };
    for (const m of RANK_METRICS) {
      const ordered = [...ROSTER].map((p) => ({
        id: p.id,
        v: byPlayer.get(p.id)?.[m] ?? 0,
      }));
      ordered.sort((a, b) => b.v - a.v);
      ordered.forEach((row, i) => {
        result[m].set(row.id, row.v > 0 ? i + 1 : 0);
      });
    }
    return result;
  })();

  const viewerStats = (() => {
    if (!viewer) return null;
    const agg = byPlayer.get(viewer.id);
    const matchAgg = matchByPlayer.get(viewer.id);
    if (!agg || !matchAgg) return null;
    const ggRank = ranksByMetric.gg.get(viewer.id) ?? 0;
    return {
      gg: agg.gg,
      matches: matchAgg.matches,
      wins: matchAgg.wins,
      losses: matchAgg.losses,
      rank: ggRank > 0 ? ggRank : null,
    };
  })();

  const trendSeries: TrendPoint[] = viewer
    ? ggCountsByDay(
        entries.filter(
          (e) => e.playerId === viewer.id && (e.kind ?? "gg") === "gg"
        )
      ).map((p) => ({ day: p.day, value: p.gg }))
    : [];

  const trendDelta = trendSeries.length
    ? trendSeries[trendSeries.length - 1].value
    : 0;
  const trendTotal = viewerStats?.gg ?? 0;

  const recentMatches: RecentMatchItem[] = matches.slice(0, 5).map((m) => {
      const playedAt = m.playedAt ?? m.createdAt;
      const rosterPlayers = (m.players ?? []).filter(
        (p): p is typeof p & { playerId: string } =>
          !!p.playerId && rosterById.has(p.playerId)
      );
      const winLoss = new Map<string, { win: boolean; loss: boolean }>();
      const start = playedAt.getTime();
      const end = start + 5000;
      for (const p of rosterPlayers) {
        const list = recentEntriesByPlayer.get(p.playerId) ?? [];
        const win = list.some(
          (t) =>
            t.kind === "win" &&
            t.createdAt.getTime() >= start &&
            t.createdAt.getTime() <= end
        );
        const loss = list.some(
          (t) =>
            t.kind === "loss" &&
            t.createdAt.getTime() >= start &&
            t.createdAt.getTime() <= end
        );
        winLoss.set(p.playerId, { win, loss });
      }
      const wonCount = [...winLoss.values()].filter((v) => v.win).length;
      const lossCount = [...winLoss.values()].filter((v) => v.loss).length;
      const outcome: "W" | "L" | "—" =
        wonCount === 0 && lossCount === 0
          ? "—"
          : wonCount >= lossCount
            ? "W"
            : "L";

      let titleLabel: string | null = null;
      for (const p of rosterPlayers) {
        const list = recentEntriesByPlayer.get(p.playerId) ?? [];
        const t = list.find(
          (x) =>
            (x.kind === "mvp" || x.kind === "svp" || x.kind === "gg") &&
            x.createdAt.getTime() >= start &&
            x.createdAt.getTime() <= end
        );
        if (t) {
          titleLabel = entryKindShortLabel(t.kind);
          break;
        }
      }

      return {
        id: m.id ?? `${start}`,
        outcome,
        agoLabel: timeAgo(playedAt),
        titleLabel,
        participants: rosterPlayers.map((p) => ({
          id: p.playerId,
          name: rosterById.get(p.playerId)?.name ?? p.displayName ?? "?",
        })),
        durationLabel: formatDuration(m.durationSeconds ?? null),
      };
    });

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
    <PageLayout
      header={
        <PageHeader
          eyebrow={
            <>
              <Sword className="size-3" aria-hidden />
              <span>The crew, ranked</span>
            </>
          }
          title="Leaderboard"
          subtitle="Live standings for the current title — updates every time someone logs a match."
          banner="/banners/leaderboard.svg"
          bannerAlt="Leaderboard banner"
        />
      }
      rail={
        <>
          <ViewerProfileCard
            stats={viewerStats}
            onViewProfile={() => viewer && setSelectedId(viewer.id)}
          />
          <RecentMatchesCard matches={recentMatches} />
          <MmrTrendCard
            total={trendTotal}
            delta={trendDelta}
            series={trendSeries}
            label="GG Trend (14d)"
          />
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
          <MetricTabs metric={rankMetric} onChange={setRankMetric} />

          <LeaderboardSummaryCard
            rank={
              viewer
                ? ranksByMetric[rankMetric].get(viewer.id) || null
                : null
            }
            stats={
              viewer
                ? [
                    {
                      label: "GG Rank",
                      value: rankBadge(ranksByMetric.gg.get(viewer.id) ?? 0),
                      highlight: rankMetric === "gg",
                    },
                    {
                      label: "MVP Rank",
                      value: rankBadge(ranksByMetric.mvp.get(viewer.id) ?? 0),
                      highlight: rankMetric === "mvp",
                    },
                    {
                      label: "SVP Rank",
                      value: rankBadge(ranksByMetric.svp.get(viewer.id) ?? 0),
                      highlight: rankMetric === "svp",
                    },
                    {
                      label: "Total Matches",
                      value: matchSummary.totalMatches,
                    },
                  ]
                : [
                    { label: "Total GG", value: totals.gg, highlight: rankMetric === "gg" },
                    { label: "Total MVP", value: totals.mvp, highlight: rankMetric === "mvp" },
                    { label: "Total SVP", value: totals.svp, highlight: rankMetric === "svp" },
                    { label: "Matches", value: matchSummary.totalMatches },
                  ]
            }
          />

          {matchSummary.inferredLegacyMatches > 0 && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {matchSummary.inferredLegacyMatches} legacy match
              {matchSummary.inferredLegacyMatches === 1 ? "" : "es"} inferred
              from old entries.
            </p>
          )}

          <section className="surface-card overflow-hidden">
            <PlayerRowHeader metricLabel={metricLabel} />
            <div>
              {leaderboard.map((p, i) => {
                const lastAt = playerMetricLastAt(p, rankMetric);
                return (
                  <PlayerRow
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    data={{
                      id: p.id,
                      name: p.name,
                      rank: i + 1,
                      metricLabel,
                      metricValue: playerMetricCount(p, rankMetric),
                      matches: p.matches,
                      wins: p.wins,
                      losses: p.losses,
                      gg: p.gg,
                      mvp: p.mvp,
                      svp: p.svp,
                      lastAtLabel: lastAt ? timeAgo(lastAt) : null,
                      isViewer: viewer?.id === p.id,
                    }}
                  />
                );
              })}
            </div>
          </section>

          <section className="surface-card overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">
                  {metricLabel} chart
                </h3>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {chartInterval === "daily"
                    ? "Last 14 days"
                    : chartInterval === "weekly"
                      ? "Last 12 weeks"
                      : "Last 6 months"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ToggleStrip
                  options={["daily", "weekly", "monthly"] as ChartInterval[]}
                  value={chartInterval}
                  onChange={setChartInterval}
                  labels={INTERVAL_LABELS}
                />
                <ToggleStrip
                  options={["bar", "line"] as ChartType[]}
                  value={chartType}
                  onChange={setChartType}
                  labels={TYPE_LABELS}
                />
              </div>
            </header>
            <div className="px-3 pt-3 pb-4">
              <ChartContainer
                config={dayGgChartConfig}
                className="aspect-auto h-64 w-full"
              >
                {chartType === "bar" ? (
                  <BarChart
                    data={chartSeries}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeOpacity={0.1} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={28}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent hideLabel={false} indicator="dot" />}
                    />
                    {ROSTER.map((p) => (
                      <Bar
                        key={p.id}
                        dataKey={p.id}
                        name={p.name}
                        stackId="stack"
                        fill={`var(--color-${p.id})`}
                      />
                    ))}
                  </BarChart>
                ) : (
                  <LineChart
                    data={chartSeries}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeOpacity={0.1} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={28}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent hideLabel={false} indicator="dot" />}
                    />
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
            </div>
          </section>

          {longestByPlayer.size > 0 && (
            <section className="surface-card flex items-center gap-3 px-5 py-4">
              <Flame className="size-5 text-orange-400" aria-hidden />
              <div className="text-xs text-muted-foreground">
                Longest streak:{" "}
                <span className="font-display font-semibold uppercase tracking-[0.12em] text-foreground">
                  {[...longestByPlayer.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 1)
                    .map(
                      ([id, n]) =>
                        `${rosterById.get(id)?.name ?? id} · ${n} GG`
                    )[0] ?? "—"}
                </span>
              </div>
            </section>
          )}
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

function rankBadge(rank: number): string {
  if (!rank) return "—";
  return `#${rank}`;
}

function MetricTabs({
  metric,
  onChange,
}: {
  metric: RankMetric;
  onChange: (m: RankMetric) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {RANK_METRICS.map((m) => {
        const active = metric === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              "px-5 py-2.5 font-display text-xs font-bold uppercase tracking-[0.2em] transition-all",
              active
                ? "bg-primary/15 text-primary border border-primary/60 glow-primary"
                : "border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
          >
            {entryKindShortLabel(m)}
          </button>
        );
      })}
    </div>
  );
}

function ToggleStrip<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex border border-white/10 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
            value === opt
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}
