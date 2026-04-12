"use client";

import Link from "next/link";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import { entryKindShortLabel, normalizeEntryKind } from "@/lib/entry-kinds";
import { aggregateByPlayer, ggCountsByDay } from "@/lib/entry-stats";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "sonner";
import { Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

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

const dayGgChartConfig = {
  gg: {
    label: "GG",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export default function Home() {
  const { isLoading, error, data } = db.useQuery({
    entries: {
      $: {
        where: { title: CURRENT_TITLE },
        order: { serverCreatedAt: "desc" },
      },
    },
  });

  const entries = data?.entries ?? [];
  const byPlayer = aggregateByPlayer(entries);
  const dayGgSeries = ggCountsByDay(entries);

  const leaderboard = ROSTER.map((p) => ({
    ...p,
    ...byPlayer.get(p.id)!,
  })).sort((a, b) => {
    if (b.gg !== a.gg) return b.gg - a.gg;
    if (a.lastGg && b.lastGg) return b.lastGg.getTime() - a.lastGg.getTime();
    if (a.lastGg) return -1;
    if (b.lastGg) return 1;
    return 0;
  });

  const medalFor = (rank: number, gg: number) => {
    if (gg === 0) return "";
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return "";
  };

  const recent = entries.slice(0, 10);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary">OMGG</h1>
          <Badge variant="secondary" className="text-sm">
            {CURRENT_TITLE}
          </Badge>
        </header>

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
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  Ranked by GG. Matches played are tracked separately.
                </CardDescription>
                <CardAction>
                  <Link
                    href="/log"
                    className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                  >
                    <Plus className="size-4" aria-hidden />
                    Log GG & Match
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">GG</TableHead>
                      <TableHead className="text-right">Matches</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Last GG
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {medalFor(i, p.gg) || i + 1}
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.gg}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.matches}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                          {p.lastGg ? timeAgo(p.lastGg) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily GG</CardTitle>
                <CardDescription>
                  GG logged per day (last 14 days, local time). Matches are not
                  included.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={dayGgChartConfig}
                  className="aspect-auto h-56 w-full"
                >
                  <BarChart
                    data={dayGgSeries}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval={0}
                      fontSize={11}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={36}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="gg"
                      fill="var(--color-gg)"
                      radius={4}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {recent.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {recent.map((e) => {
                      const name = rosterById.get(e.playerId)?.name ?? e.playerId;
                      const kind = normalizeEntryKind(e.kind);
                      const label = entryKindShortLabel(kind);
                      return (
                        <li key={e.id}>
                          <span className="text-foreground font-medium">
                            {name}
                          </span>{" "}
                          +1 {label} · {timeAgo(e.createdAt)}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
