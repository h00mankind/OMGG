"use client";

import { useState } from "react";
import {
  Trophy,
  Users,
  Swords,
  PlusCircle,
  BarChart3,
  Crown,
  Shield,
  Sparkles,
  Wrench,
} from "lucide-react";
import { ROSTER } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { LeaderboardSummaryCard } from "@/components/leaderboard-summary-card";
import { ViewerProfileCard } from "@/components/viewer-profile-card";
import { RecentMatchesCard } from "@/components/recent-matches-card";
import { MmrTrendCard } from "@/components/mmr-trend-card";
import { HowItWorksCard } from "@/components/how-it-works-card";
import { RecentEntriesCard } from "@/components/recent-entries-card";
import { TipCard } from "@/components/tip-card";
import { PlayerRow } from "@/components/player-row";
import { PodiumRank } from "@/components/podium-rank";
import { WinRateBar } from "@/components/win-rate-bar";
import {
  AppSidebar,
  SidebarLogo,
  SidebarNavItem,
  SidebarSeasonSelector,
  SidebarViewerChip,
} from "@/components/app-sidebar";
import { playerColor, playerInitial } from "@/lib/player-color";
import { cn } from "@/lib/utils";
import type { RegistryEntry } from "./types";

const ROSTER_OPTIONS = ROSTER.map((p) => ({ label: p.name, value: p.id }));

function getPlayer(id: string) {
  return ROSTER.find((p) => p.id === id) ?? ROSTER[0];
}

const ICON_OPTIONS = [
  { label: "Trophy", value: "trophy" },
  { label: "Users", value: "users" },
  { label: "Swords", value: "swords" },
  { label: "Plus", value: "plus" },
  { label: "Bar Chart", value: "bar" },
  { label: "Crown", value: "crown" },
  { label: "Shield", value: "shield" },
  { label: "Sparkles", value: "sparkles" },
  { label: "Wrench", value: "wrench" },
] as const;

const ICON_MAP = {
  trophy: Trophy,
  users: Users,
  swords: Swords,
  plus: PlusCircle,
  bar: BarChart3,
  crown: Crown,
  shield: Shield,
  sparkles: Sparkles,
  wrench: Wrench,
} as const;

function pickIcon(value: string) {
  return ICON_MAP[value as keyof typeof ICON_MAP] ?? Trophy;
}

/* ------------------------------------------------------------------ */
/*  Stateful demo wrappers                                            */
/* ------------------------------------------------------------------ */

function StatusPillDemo({
  notify,
}: {
  notify: (s: string) => void;
}) {
  type S = "off" | "win" | "loss";
  const [status, setStatus] = useState<S>("off");
  const cycle = () => {
    const next: S = status === "off" ? "win" : status === "win" ? "loss" : "off";
    setStatus(next);
    notify(`Status → ${next.toUpperCase()}`);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "border px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.18em] transition-all",
        status === "win" &&
          "border-emerald-500/60 bg-emerald-500/15 text-emerald-400 glow-win",
        status === "loss" &&
          "border-rose-500/60 bg-rose-500/15 text-rose-400 glow-loss",
        status === "off" &&
          "border-white/10 text-muted-foreground hover:bg-white/5",
      )}
    >
      {status === "off" ? "—" : status === "win" ? "W" : "L"}
    </button>
  );
}

function ManualEntryRowDemo({
  notify,
  playerId,
}: {
  notify: (s: string) => void;
  playerId: string;
}) {
  type S = "off" | "win" | "loss";
  const [status, setStatus] = useState<S>("off");
  const player = getPlayer(playerId);
  const c = playerColor(player.id);
  const cycle = () => {
    const next: S = status === "off" ? "win" : status === "win" ? "loss" : "off";
    setStatus(next);
    notify(`${player.name} → ${next.toUpperCase()}`);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={cycle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") cycle();
      }}
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 border px-3 py-2.5 transition-colors",
        status === "win" &&
          "border-emerald-500/60 bg-emerald-500/10 glow-win",
        status === "loss" &&
          "border-rose-500/60 bg-rose-500/10 glow-loss",
        status === "off" && "border-white/10 hover:bg-white/5",
      )}
    >
      <Avatar className={cn("size-9 shrink-0", c.bg)}>
        <AvatarFallback className={cn(c.bg, c.text, "text-xs font-semibold")}>
          {playerInitial(player.name)}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
        {player.name}
      </span>
      <span
        className={cn(
          "font-display text-xs font-bold uppercase tracking-[0.2em]",
          status === "win" && "text-emerald-400",
          status === "loss" && "text-rose-400",
          status === "off" && "text-muted-foreground",
        )}
      >
        {status === "off" ? "—" : status === "win" ? "W" : "L"}
      </span>
    </div>
  );
}

function MetricTabsDemo({ notify }: { notify: (s: string) => void }) {
  const [active, setActive] = useState<"gg" | "mvp" | "svp">("gg");
  return (
    <div className="flex gap-1.5">
      {(["gg", "mvp", "svp"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            setActive(m);
            notify(`Tab → ${m.toUpperCase()}`);
          }}
          className={cn(
            "px-5 py-2.5 font-display text-xs font-bold uppercase tracking-[0.2em] transition-all",
            active === m
              ? "border border-primary/60 bg-primary/15 text-primary glow-primary"
              : "border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Registry                                                          */
/* ------------------------------------------------------------------ */

export const REGISTRY: RegistryEntry[] = [
  /* ------------------------ Cards ------------------------ */
  {
    id: "page-header",
    label: "Page Header",
    group: "Cards",
    fullBleed: true,
    defaultProps: {
      title: "Leaderboard",
      subtitle: "Live standings for the current title — updates in real time.",
      eyebrow: "The crew, ranked",
      banner: "/banners/leaderboard.svg",
    },
    controls: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      {
        key: "banner",
        label: "Banner",
        type: "select",
        options: [
          { label: "Leaderboard", value: "/banners/leaderboard.svg" },
          { label: "Log", value: "/banners/log.svg" },
          { label: "Stats", value: "/banners/stats.svg" },
          { label: "None", value: "" },
        ],
      },
    ],
    render: (props) => (
      <PageHeader
        title={(props.title as string) ?? "Title"}
        subtitle={(props.subtitle as string) ?? undefined}
        eyebrow={
          props.eyebrow ? <span>{props.eyebrow as string}</span> : undefined
        }
        banner={(props.banner as string) || undefined}
      />
    ),
  },
  {
    id: "leaderboard-summary",
    label: "Summary Card",
    group: "Cards",
    defaultProps: {
      rank: 2,
      gg: 12,
      mvp: 8,
      svp: 5,
      matches: 47,
    },
    controls: [
      { key: "rank", label: "Rank", type: "number", min: 1, max: 6 },
      { key: "gg", label: "GG", type: "slider", min: 0, max: 100 },
      { key: "mvp", label: "MVP", type: "slider", min: 0, max: 100 },
      { key: "svp", label: "SVP", type: "slider", min: 0, max: 100 },
      { key: "matches", label: "Matches", type: "slider", min: 0, max: 200 },
    ],
    render: (props) => (
      <LeaderboardSummaryCard
        rank={Number(props.rank ?? 0) || null}
        stats={[
          { label: "GG Rank", value: `#${props.gg}`, highlight: true },
          { label: "MVP Rank", value: `#${props.mvp}` },
          { label: "SVP Rank", value: `#${props.svp}` },
          { label: "Total Matches", value: Number(props.matches ?? 0) },
        ]}
      />
    ),
  },
  {
    id: "viewer-profile",
    label: "Viewer Profile",
    group: "Cards",
    defaultProps: {
      viewerId: ROSTER[0]?.id ?? "h00man",
      gg: 12,
      matches: 47,
      wins: 28,
      losses: 19,
      rank: 2,
    },
    controls: [
      {
        key: "viewerId",
        label: "Viewer",
        type: "select",
        options: ROSTER_OPTIONS,
      },
      { key: "rank", label: "Rank", type: "number", min: 1, max: 6 },
      { key: "gg", label: "GG", type: "slider", min: 0, max: 100 },
      { key: "matches", label: "Matches", type: "slider", min: 0, max: 200 },
      { key: "wins", label: "Wins", type: "slider", min: 0, max: 200 },
      { key: "losses", label: "Losses", type: "slider", min: 0, max: 200 },
    ],
    render: (props, { notify }) => {
      const player = getPlayer(props.viewerId as string);
      return (
        <ViewerProfileCard
          viewerOverride={player}
          stats={{
            gg: Number(props.gg ?? 0),
            matches: Number(props.matches ?? 0),
            wins: Number(props.wins ?? 0),
            losses: Number(props.losses ?? 0),
            rank: Number(props.rank ?? 0) || null,
          }}
          onViewProfile={() => notify("Clicked View Profile")}
        />
      );
    },
  },
  {
    id: "recent-matches",
    label: "Recent Matches",
    group: "Cards",
    defaultProps: {},
    controls: [],
    render: (_, { notify }) => (
      <RecentMatchesCard
        onViewAll={() => notify("Clicked View All")}
        matches={[
          {
            id: "m1",
            outcome: "W",
            agoLabel: "12m ago",
            titleLabel: "MVP",
            participants: ROSTER.slice(0, 5).map((p) => ({
              id: p.id,
              name: p.name,
            })),
            durationLabel: "32:14",
          },
          {
            id: "m2",
            outcome: "L",
            agoLabel: "1h ago",
            titleLabel: "SVP",
            participants: ROSTER.slice(0, 4).map((p) => ({
              id: p.id,
              name: p.name,
            })),
            durationLabel: "28:02",
          },
          {
            id: "m3",
            outcome: "W",
            agoLabel: "3h ago",
            titleLabel: null,
            participants: ROSTER.slice(1, 5).map((p) => ({
              id: p.id,
              name: p.name,
            })),
            durationLabel: "41:55",
          },
        ]}
      />
    ),
  },
  {
    id: "mmr-trend",
    label: "MMR Trend",
    group: "Cards",
    defaultProps: {
      total: 12,
      delta: 3,
      label: "GG Trend (14d)",
    },
    controls: [
      { key: "total", label: "Total", type: "slider", min: 0, max: 200 },
      { key: "delta", label: "Δ today", type: "slider", min: -10, max: 10 },
      { key: "label", label: "Label", type: "text" },
    ],
    render: (props) => (
      <MmrTrendCard
        total={Number(props.total ?? 0)}
        delta={Number(props.delta ?? 0)}
        label={(props.label as string) ?? "Trend"}
        series={Array.from({ length: 14 }).map((_, i) => ({
          day: `${i}`,
          value: Math.max(
            0,
            Math.round(
              (Number(props.total ?? 0) / 14) *
                (i + 1) *
                (0.7 + 0.3 * Math.sin(i / 2)),
            ),
          ),
        }))}
      />
    ),
  },
  {
    id: "how-it-works",
    label: "How It Works",
    group: "Cards",
    defaultProps: {},
    controls: [],
    render: () => <HowItWorksCard />,
  },
  {
    id: "recent-entries",
    label: "Recent Entries",
    group: "Cards",
    defaultProps: {},
    controls: [],
    render: (_, { notify }) => (
      <RecentEntriesCard
        onViewAll={() => notify("Clicked View All")}
        entries={[
          {
            id: "e1",
            resultLabel: "Win",
            resultTone: "win",
            agoLabel: "8m ago",
            participants: ROSTER.slice(0, 4).map((p) => ({
              id: p.id,
              name: p.name,
            })),
            pointsLabel: "MVP",
          },
          {
            id: "e2",
            resultLabel: "Loss",
            resultTone: "loss",
            agoLabel: "1h ago",
            participants: ROSTER.slice(2, 6).map((p) => ({
              id: p.id,
              name: p.name,
            })),
            pointsLabel: null,
          },
        ]}
      />
    ),
  },
  {
    id: "tip",
    label: "Tip",
    group: "Cards",
    defaultProps: {
      title: "Tip",
      body: "Cycle each player W → L → off. Add MVP to a winner before confirming.",
    },
    controls: [
      { key: "title", label: "Title", type: "text" },
      { key: "body", label: "Body", type: "text" },
    ],
    render: (props) => (
      <TipCard
        title={(props.title as string) ?? undefined}
        body={(props.body as string) ?? ""}
      />
    ),
  },

  /* ------------------------ Rows ------------------------ */
  {
    id: "player-row",
    label: "Player Row",
    group: "Rows",
    defaultProps: {
      playerId: ROSTER[0]?.id ?? "h00man",
      rank: 1,
      metricLabel: "GG",
      metricValue: 12,
      matches: 47,
      wins: 28,
      losses: 19,
      gg: 12,
      mvp: 8,
      svp: 5,
      isViewer: false,
    },
    controls: [
      {
        key: "playerId",
        label: "Player",
        type: "select",
        options: ROSTER_OPTIONS,
      },
      { key: "rank", label: "Rank", type: "number", min: 1, max: 6 },
      {
        key: "metricLabel",
        label: "Metric Label",
        type: "select",
        options: [
          { label: "GG", value: "GG" },
          { label: "MVP", value: "MVP" },
          { label: "SVP", value: "SVP" },
        ],
      },
      { key: "metricValue", label: "Metric", type: "slider", min: 0, max: 100 },
      { key: "matches", label: "Matches", type: "slider", min: 0, max: 200 },
      { key: "wins", label: "Wins", type: "slider", min: 0, max: 200 },
      { key: "losses", label: "Losses", type: "slider", min: 0, max: 200 },
      { key: "isViewer", label: "Is Viewer", type: "boolean" },
    ],
    render: (props, { notify }) => {
      const player = getPlayer(props.playerId as string);
      return (
        <div className="surface-card overflow-hidden">
          <PlayerRow
            onClick={() => notify(`Clicked ${player.name}`)}
            data={{
              id: player.id,
              name: player.name,
              rank: Number(props.rank ?? 1),
              metricLabel: (props.metricLabel as string) ?? "GG",
              metricValue: Number(props.metricValue ?? 0),
              matches: Number(props.matches ?? 0),
              wins: Number(props.wins ?? 0),
              losses: Number(props.losses ?? 0),
              gg: Number(props.gg ?? 0),
              mvp: Number(props.mvp ?? 0),
              svp: Number(props.svp ?? 0),
              lastAtLabel: "2h ago",
              isViewer: !!props.isViewer,
            }}
          />
        </div>
      );
    },
  },
  {
    id: "manual-entry-row",
    label: "Manual Entry Row",
    group: "Rows",
    defaultProps: { playerId: ROSTER[0]?.id ?? "h00man" },
    controls: [
      {
        key: "playerId",
        label: "Player",
        type: "select",
        options: ROSTER_OPTIONS,
      },
    ],
    render: (props, { notify }) => (
      <div className="max-w-sm">
        <ManualEntryRowDemo
          notify={notify}
          playerId={props.playerId as string}
        />
        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Click to cycle W → L → off
        </p>
      </div>
    ),
  },

  /* ------------------------ Bits ------------------------ */
  {
    id: "podium-rank",
    label: "Podium Rank",
    group: "Bits",
    defaultProps: { rank: 1 },
    controls: [{ key: "rank", label: "Rank", type: "number", min: 1, max: 6 }],
    render: (props) => (
      <div className="flex items-center gap-6">
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <div key={r} className="flex flex-col items-center gap-1">
            <PodiumRank rank={r} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              #{r}
            </span>
          </div>
        ))}
        <div className="ml-8 border-l border-white/10 pl-8 flex flex-col items-center gap-1">
          <PodiumRank rank={Number(props.rank ?? 1)} className="size-12" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary">
            Tweaked
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "win-rate-bar",
    label: "Win Rate Bar",
    group: "Bits",
    defaultProps: { wins: 32, matches: 47 },
    controls: [
      { key: "wins", label: "Wins", type: "slider", min: 0, max: 200 },
      { key: "matches", label: "Matches", type: "slider", min: 0, max: 200 },
    ],
    render: (props) => (
      <div className="surface-card flex items-center justify-between gap-6 px-5 py-4">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Win Rate
        </span>
        <WinRateBar
          wins={Number(props.wins ?? 0)}
          matches={Number(props.matches ?? 0)}
        />
      </div>
    ),
  },
  {
    id: "metric-tabs",
    label: "Metric Tabs",
    group: "Bits",
    defaultProps: {},
    controls: [],
    render: (_, { notify }) => <MetricTabsDemo notify={notify} />,
  },
  {
    id: "status-pill",
    label: "Status Pill",
    group: "Bits",
    defaultProps: {},
    controls: [],
    render: (_, { notify }) => (
      <div className="flex items-center gap-3">
        <StatusPillDemo notify={notify} />
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Click to cycle
        </p>
      </div>
    ),
  },

  /* ------------------------ Sidebar ------------------------ */
  {
    id: "app-sidebar",
    label: "App Sidebar",
    group: "Sidebar",
    fullBleed: true,
    defaultProps: {},
    controls: [],
    render: (_, { notify }) => (
      <div className="relative h-[600px]">
        <AppSidebar onOpenViewerPicker={() => notify("Open viewer picker")} />
      </div>
    ),
  },
  {
    id: "sidebar-logo",
    label: "Sidebar Logo",
    group: "Sidebar",
    defaultProps: {},
    controls: [],
    render: () => (
      <div className="w-64 border border-white/5 bg-card/80">
        <SidebarLogo />
      </div>
    ),
  },
  {
    id: "sidebar-nav-item",
    label: "Sidebar Nav Item",
    group: "Sidebar",
    defaultProps: {
      label: "Leaderboard",
      icon: "trophy",
      active: true,
      disabled: false,
      badge: "",
    },
    controls: [
      { key: "label", label: "Label", type: "text" },
      {
        key: "icon",
        label: "Icon",
        type: "select",
        options: [...ICON_OPTIONS],
      },
      { key: "active", label: "Active", type: "boolean" },
      { key: "disabled", label: "Disabled", type: "boolean" },
      { key: "badge", label: "Badge text", type: "text" },
    ],
    render: (props, { notify }) => (
      <div className="w-64 border border-white/5 bg-card/80 px-3 py-3">
        <ul>
          <SidebarNavItem
            icon={pickIcon((props.icon as string) ?? "trophy")}
            label={(props.label as string) ?? ""}
            active={!!props.active}
            disabled={!!props.disabled}
            badge={(props.badge as string) || undefined}
            onClick={() => notify(`Clicked ${props.label}`)}
          />
        </ul>
      </div>
    ),
  },
  {
    id: "sidebar-season-selector",
    label: "Season Selector",
    group: "Sidebar",
    defaultProps: { title: "Leaderboard" },
    controls: [{ key: "title", label: "Title", type: "text" }],
    render: (props) => (
      <div className="w-64 border border-white/5 bg-card/80 px-5 py-5">
        <SidebarSeasonSelector title={(props.title as string) ?? ""} />
      </div>
    ),
  },
  {
    id: "sidebar-viewer-chip",
    label: "Viewer Chip",
    group: "Sidebar",
    defaultProps: { viewerId: ROSTER[0]?.id ?? "h00man", empty: false },
    controls: [
      {
        key: "viewerId",
        label: "Viewer",
        type: "select",
        options: ROSTER_OPTIONS,
      },
      { key: "empty", label: "No viewer", type: "boolean" },
    ],
    render: (props, { notify }) => {
      const player = props.empty
        ? null
        : getPlayer(props.viewerId as string);
      return (
        <div className="w-64 border border-white/5 bg-card/80 px-5 py-5">
          <SidebarViewerChip
            viewer={player}
            onClick={() => notify("Clicked viewer chip")}
          />
        </div>
      );
    },
  },

  /* ------------------------ Primitives ------------------------ */
  {
    id: "button",
    label: "Button",
    group: "Primitives",
    defaultProps: {
      variant: "default",
      size: "default",
      label: "Confirm & log",
      glow: true,
    },
    controls: [
      {
        key: "variant",
        label: "Variant",
        type: "select",
        options: [
          { label: "Default", value: "default" },
          { label: "Outline", value: "outline" },
          { label: "Secondary", value: "secondary" },
          { label: "Ghost", value: "ghost" },
          { label: "Destructive", value: "destructive" },
          { label: "Link", value: "link" },
        ],
      },
      {
        key: "size",
        label: "Size",
        type: "select",
        options: [
          { label: "xs", value: "xs" },
          { label: "sm", value: "sm" },
          { label: "default", value: "default" },
          { label: "lg", value: "lg" },
        ],
      },
      { key: "label", label: "Label", type: "text" },
      { key: "glow", label: "Glow", type: "boolean" },
    ],
    render: (props, { notify }) => (
      <Button
        variant={
          (props.variant as
            | "default"
            | "outline"
            | "secondary"
            | "ghost"
            | "destructive"
            | "link") ?? "default"
        }
        size={(props.size as "xs" | "sm" | "default" | "lg") ?? "default"}
        className={cn(
          "uppercase tracking-[0.16em]",
          props.glow ? "glow-primary" : "",
        )}
        onClick={() => notify(`Clicked ${props.label as string}`)}
      >
        {(props.label as string) ?? "Button"}
      </Button>
    ),
  },
  {
    id: "badge",
    label: "Badge",
    group: "Primitives",
    defaultProps: {
      variant: "default",
      label: "MVP",
      tone: "primary",
    },
    controls: [
      {
        key: "variant",
        label: "Variant",
        type: "select",
        options: [
          { label: "Default", value: "default" },
          { label: "Secondary", value: "secondary" },
          { label: "Destructive", value: "destructive" },
          { label: "Outline", value: "outline" },
        ],
      },
      { key: "label", label: "Label", type: "text" },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Win", value: "win" },
          { label: "Loss", value: "loss" },
          { label: "Neutral", value: "neutral" },
        ],
      },
    ],
    render: (props) => {
      const tone = (props.tone as string) ?? "primary";
      const toneClass = {
        primary: "bg-primary/15 text-primary border-primary/40",
        win: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 glow-win",
        loss: "bg-rose-500/15 text-rose-400 border-rose-500/40 glow-loss",
        neutral: "",
      }[tone];
      return (
        <Badge
          variant={
            (props.variant as
              | "default"
              | "secondary"
              | "destructive"
              | "outline") ?? "default"
          }
          className={cn(
            "border tracking-[0.2em] uppercase font-display text-[11px]",
            toneClass,
          )}
        >
          {(props.label as string) ?? "Badge"}
        </Badge>
      );
    },
  },
];
