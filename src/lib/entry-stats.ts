import { ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_GG,
  ENTRY_KIND_LOSS,
  ENTRY_KIND_MATCH,
  ENTRY_KIND_MVP,
  ENTRY_KIND_SVP,
  ENTRY_KIND_WIN,
  normalizeEntryKind,
} from "@/lib/entry-kinds";

export type EntryRow = {
  playerId: string;
  kind?: string | null;
  createdAt: Date;
};

export type MatchPlayerRow = {
  playerId?: string | null;
  won?: boolean | null;
  createdAt?: Date | null;
};

export type MatchRow = {
  id?: string;
  playedAt?: Date | null;
  createdAt: Date;
  players?: MatchPlayerRow[];
};

const DEFAULT_GG_DAY_WINDOW = 14;

function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortDayLabel(key: string): string {
  const [ys, ms, ds] = key.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const day = Number(ds);
  if (!y || !mo || !day) return key;
  return new Date(y, mo - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export type DayGgPoint = {
  /** ISO-like local date `YYYY-MM-DD` (sortable). */
  day: string;
  /** Short label for chart axis (e.g. "Apr 12"). */
  label: string;
  gg: number;
};

/** Per-player GG counts per day — each key beyond `day`/`label` is a player id → count. */
export type DayGgStackPoint = {
  day: string;
  label: string;
  [playerId: string]: number | string;
};

/** GG row counts per local calendar day, last `windowDays` days including today. Matches excluded. */
export function ggCountsByDay(
  entries: EntryRow[],
  windowDays: number = DEFAULT_GG_DAY_WINDOW
): DayGgPoint[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== ENTRY_KIND_GG) continue;
    const key = dayKeyLocal(e.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const out: DayGgPoint[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKeyLocal(d);
    out.push({
      day: key,
      label: shortDayLabel(key),
      gg: counts.get(key) ?? 0,
    });
  }
  return out;
}

export type PlayerAgg = {
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
  lastMatch: Date | null;
  lastWin: Date | null;
  lastLoss: Date | null;
};

export type MatchAgg = {
  matches: number;
  wins: number;
  losses: number;
  lastMatch: Date | null;
  lastWin: Date | null;
  lastLoss: Date | null;
};

export type MatchAggSummary = {
  byPlayer: Map<string, MatchAgg>;
  totalMatches: number;
  inferredLegacyMatches: number;
};

export type RankMetric =
  | typeof ENTRY_KIND_GG
  | typeof ENTRY_KIND_MVP
  | typeof ENTRY_KIND_SVP;

export const RANK_METRICS: RankMetric[] = [
  ENTRY_KIND_MVP,
  ENTRY_KIND_SVP,
  ENTRY_KIND_GG,
];

function emptyAggMap(): Map<string, PlayerAgg> {
  const m = new Map<string, PlayerAgg>();
  for (const r of ROSTER) {
    m.set(r.id, {
      gg: 0,
      mvp: 0,
      svp: 0,
      totalTitles: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      lastGg: null,
      lastMvp: null,
      lastSvp: null,
      lastMatch: null,
      lastWin: null,
      lastLoss: null,
    });
  }
  return m;
}

function emptyMatchAggMap(): Map<string, MatchAgg> {
  const m = new Map<string, MatchAgg>();
  for (const r of ROSTER) {
    m.set(r.id, {
      matches: 0,
      wins: 0,
      losses: 0,
      lastMatch: null,
      lastWin: null,
      lastLoss: null,
    });
  }
  return m;
}

function secondKey(d: Date): string {
  return String(Math.floor(d.getTime() / 1000));
}

function isRosterPlayer(playerId: string | null | undefined): playerId is string {
  return typeof playerId === "string" && ROSTER.some((r) => r.id === playerId);
}

function recordMatchParticipation(
  agg: MatchAgg,
  at: Date,
  won?: boolean | null
) {
  agg.matches++;
  if (!agg.lastMatch || at > agg.lastMatch) {
    agg.lastMatch = at;
  }
  if (won === true) {
    agg.wins++;
    if (!agg.lastWin || at > agg.lastWin) {
      agg.lastWin = at;
    }
  } else if (won === false) {
    agg.losses++;
    if (!agg.lastLoss || at > agg.lastLoss) {
      agg.lastLoss = at;
    }
  }
}

function consumeNearestEntry(
  index: Map<string, EntryRow[]>,
  playerId: string,
  at: Date,
  toleranceMs: number
): EntryRow | null {
  const list = index.get(playerId);
  if (!list || list.length === 0) return null;
  let bestIndex = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < list.length; i++) {
    const delta = Math.abs(list[i].createdAt.getTime() - at.getTime());
    if (delta <= toleranceMs && delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }
  if (bestIndex === -1) return null;
  const [match] = list.splice(bestIndex, 1);
  return match ?? null;
}

function consumeEntryInSecond(
  index: Map<string, EntryRow[]>,
  playerId: string,
  key: string
): EntryRow | null {
  const list = index.get(playerId);
  if (!list || list.length === 0) return null;
  const idx = list.findIndex((entry) => secondKey(entry.createdAt) === key);
  if (idx === -1) return null;
  const [match] = list.splice(idx, 1);
  return match ?? null;
}

/** Per-player GG counts per calendar day, last `windowDays` days. Matches excluded. */
export function ggStackedByDay(
  entries: EntryRow[],
  windowDays: number = DEFAULT_GG_DAY_WINDOW
): DayGgStackPoint[] {
  return titleStackedByDay(entries, ENTRY_KIND_GG, windowDays);
}

/** Per-player title counts per calendar day, last `windowDays` days. Matches excluded. */
export function titleStackedByDay(
  entries: EntryRow[],
  metric: RankMetric,
  windowDays: number = DEFAULT_GG_DAY_WINDOW
): DayGgStackPoint[] {
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== metric) continue;
    const key = dayKeyLocal(e.createdAt);
    if (!counts.has(key)) counts.set(key, new Map());
    const dm = counts.get(key)!;
    dm.set(e.playerId, (dm.get(e.playerId) ?? 0) + 1);
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const out: DayGgStackPoint[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKeyLocal(d);
    const dm = counts.get(key) ?? new Map<string, number>();
    const point: DayGgStackPoint = { day: key, label: shortDayLabel(key) };
    for (const r of ROSTER) {
      point[r.id] = dm.get(r.id) ?? 0;
    }
    out.push(point);
  }
  return out;
}

export type StreakInfo = {
  /** Longest consecutive GG run per player, across all history. */
  longestByPlayer: Map<string, number>;
  /** The player currently "on fire" (holds the most recent run), or null if no GGs. */
  currentHolderId: string | null;
  /** Length of the current holder's active run. */
  currentLength: number;
};

/**
 * A "streak" is consecutive GG entries where the same player scores back-to-back.
 * Any GG by a different player breaks the prior player's run.
 * Matches are ignored entirely.
 */
export function computeStreaks(entries: EntryRow[]): StreakInfo {
  const ggs = entries.filter((e) => normalizeEntryKind(e.kind) === ENTRY_KIND_GG);
  // sort ascending by time
  const chronological = [...ggs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const longestByPlayer = new Map<string, number>();
  let lastPlayer: string | null = null;
  let runLength = 0;

  for (const e of chronological) {
    if (e.playerId === lastPlayer) {
      runLength++;
    } else {
      lastPlayer = e.playerId;
      runLength = 1;
    }
    const prev = longestByPlayer.get(e.playerId) ?? 0;
    if (runLength > prev) longestByPlayer.set(e.playerId, runLength);
  }

  return {
    longestByPlayer,
    currentHolderId: lastPlayer,
    currentLength: runLength,
  };
}

export type Trend = "up" | "down" | "flat";

export function playerMetricCount(agg: PlayerAgg, metric: RankMetric): number {
  if (metric === ENTRY_KIND_MVP) return agg.mvp;
  if (metric === ENTRY_KIND_SVP) return agg.svp;
  return agg.gg;
}

export function playerMetricLastAt(
  agg: PlayerAgg,
  metric: RankMetric
): Date | null {
  if (metric === ENTRY_KIND_MVP) return agg.lastMvp;
  if (metric === ENTRY_KIND_SVP) return agg.lastSvp;
  return agg.lastGg;
}

/** Compute rank (0-based) from a subset of entries using the same sort as the leaderboard. */
function rankFrom(
  subset: EntryRow[],
  metric: RankMetric = ENTRY_KIND_GG
): Map<string, number> {
  const aggs = new Map<string, { value: number; lastAt: Date | null }>();
  for (const r of ROSTER) aggs.set(r.id, { value: 0, lastAt: null });
  for (const e of subset) {
    if (normalizeEntryKind(e.kind) !== metric) continue;
    const a = aggs.get(e.playerId);
    if (!a) continue;
    a.value++;
    if (!a.lastAt || e.createdAt > a.lastAt) a.lastAt = e.createdAt;
  }
  const sorted = [...ROSTER].sort((a, b) => {
    const ag = aggs.get(a.id)!;
    const bg = aggs.get(b.id)!;
    if (bg.value !== ag.value) return bg.value - ag.value;
    if (ag.lastAt && bg.lastAt) return bg.lastAt.getTime() - ag.lastAt.getTime();
    if (ag.lastAt) return -1;
    if (bg.lastAt) return 1;
    return 0;
  });
  const out = new Map<string, number>();
  sorted.forEach((p, i) => out.set(p.id, i));
  return out;
}

/**
 * Trend based on rank position change: today's rank vs rank as of end of yesterday.
 * "up" = moved up (lower rank number), "down" = dropped, "flat" = no change.
 */
export function trendByPlayer(
  entries: EntryRow[],
  metric: RankMetric = ENTRY_KIND_GG
): Map<string, Trend> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const currentRanks = rankFrom(entries, metric);
  const prevEntries = entries.filter((e) => e.createdAt.getTime() < todayStart.getTime());
  const prevRanks = rankFrom(prevEntries, metric);

  const out = new Map<string, Trend>();
  for (const r of ROSTER) {
    const cur = currentRanks.get(r.id) ?? 0;
    const prev = prevRanks.get(r.id) ?? 0;
    if (cur < prev) out.set(r.id, "up");
    else if (cur > prev) out.set(r.id, "down");
    else out.set(r.id, "flat");
  }
  return out;
}

function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(d.getDate() + diff);
  return m;
}

/** Per-player GG counts per calendar week (Mon-aligned), last `windowWeeks` weeks. */
export function ggStackedByWeek(
  entries: EntryRow[],
  windowWeeks = 12
): DayGgStackPoint[] {
  return titleStackedByWeek(entries, ENTRY_KIND_GG, windowWeeks);
}

/** Per-player title counts per calendar week (Mon-aligned), last `windowWeeks` weeks. */
export function titleStackedByWeek(
  entries: EntryRow[],
  metric: RankMetric,
  windowWeeks = 12
): DayGgStackPoint[] {
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== metric) continue;
    const key = dayKeyLocal(mondayOf(e.createdAt));
    if (!counts.has(key)) counts.set(key, new Map());
    const dm = counts.get(key)!;
    dm.set(e.playerId, (dm.get(e.playerId) ?? 0) + 1);
  }

  const thisMonday = mondayOf(new Date());
  const out: DayGgStackPoint[] = [];
  for (let i = windowWeeks - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - i * 7);
    const key = dayKeyLocal(d);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const dm = counts.get(key) ?? new Map<string, number>();
    const point: DayGgStackPoint = { day: key, label };
    for (const r of ROSTER) point[r.id] = dm.get(r.id) ?? 0;
    out.push(point);
  }
  return out;
}

/** Per-player GG counts per calendar month, last `windowMonths` months. */
export function ggStackedByMonth(
  entries: EntryRow[],
  windowMonths = 6
): DayGgStackPoint[] {
  return titleStackedByMonth(entries, ENTRY_KIND_GG, windowMonths);
}

/** Per-player title counts per calendar month, last `windowMonths` months. */
export function titleStackedByMonth(
  entries: EntryRow[],
  metric: RankMetric,
  windowMonths = 6
): DayGgStackPoint[] {
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== metric) continue;
    const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!counts.has(key)) counts.set(key, new Map());
    const dm = counts.get(key)!;
    dm.set(e.playerId, (dm.get(e.playerId) ?? 0) + 1);
  }

  const now = new Date();
  const out: DayGgStackPoint[] = [];
  for (let i = windowMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    const dm = counts.get(key) ?? new Map<string, number>();
    const point: DayGgStackPoint = { day: key, label };
    for (const r of ROSTER) point[r.id] = dm.get(r.id) ?? 0;
    out.push(point);
  }
  return out;
}

/**
 * Per-player counts plus last-activity timestamps. Legacy rows without `kind`
 * normalize to GG.
 */
export function aggregateByPlayer(entries: EntryRow[]): Map<string, PlayerAgg> {
  const map = emptyAggMap();
  for (const e of entries) {
    const agg = map.get(e.playerId);
    if (!agg) continue;
    const k = normalizeEntryKind(e.kind);
    if (k === ENTRY_KIND_MATCH) {
      agg.matches++;
      if (!agg.lastMatch || e.createdAt > agg.lastMatch) {
        agg.lastMatch = e.createdAt;
      }
    } else if (k === ENTRY_KIND_WIN) {
      agg.wins++;
      if (!agg.lastWin || e.createdAt > agg.lastWin) {
        agg.lastWin = e.createdAt;
      }
    } else if (k === ENTRY_KIND_LOSS) {
      agg.losses++;
      if (!agg.lastLoss || e.createdAt > agg.lastLoss) {
        agg.lastLoss = e.createdAt;
      }
    } else if (k === ENTRY_KIND_GG) {
      agg.gg++;
      agg.totalTitles++;
      if (!agg.lastGg || e.createdAt > agg.lastGg) {
        agg.lastGg = e.createdAt;
      }
    } else if (k === ENTRY_KIND_MVP) {
      agg.mvp++;
      agg.totalTitles++;
      if (!agg.lastMvp || e.createdAt > agg.lastMvp) {
        agg.lastMvp = e.createdAt;
      }
    } else if (k === ENTRY_KIND_SVP) {
      agg.svp++;
      agg.totalTitles++;
      if (!agg.lastSvp || e.createdAt > agg.lastSvp) {
        agg.lastSvp = e.createdAt;
      }
    }
  }
  return map;
}

export function aggregateMatchesByPlayer(
  matches: MatchRow[],
  entries: EntryRow[]
): MatchAggSummary {
  const byPlayer = emptyMatchAggMap();
  const matchEntries = new Map<string, EntryRow[]>();
  const winEntries = new Map<string, EntryRow[]>();
  const lossEntries = new Map<string, EntryRow[]>();
  // Used only for legacy inference: GG title at same timestamp → the player lost.
  const ggEntries = new Map<string, EntryRow[]>();

  for (const entry of entries) {
    if (!isRosterPlayer(entry.playerId)) continue;
    const kind = normalizeEntryKind(entry.kind);
    const target =
      kind === ENTRY_KIND_MATCH
        ? matchEntries
        : kind === ENTRY_KIND_WIN
          ? winEntries
          : kind === ENTRY_KIND_LOSS
            ? lossEntries
            : kind === ENTRY_KIND_GG
              ? ggEntries
              : null;
    if (!target) continue;
    const list = target.get(entry.playerId) ?? [];
    list.push(entry);
    target.set(entry.playerId, list);
  }

  for (const index of [matchEntries, winEntries, lossEntries, ggEntries]) {
    for (const list of index.values()) {
      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
  }

  let normalizedTotalMatches = 0;

  for (const match of matches) {
    const at = match.playedAt ?? match.createdAt;
    const rosteredPlayers = new Map<string, boolean | null | undefined>();

    for (const player of match.players ?? []) {
      if (!isRosterPlayer(player.playerId)) continue;
      if (!rosteredPlayers.has(player.playerId)) {
        rosteredPlayers.set(player.playerId, player.won);
      }
    }

    if (rosteredPlayers.size === 0) continue;
    normalizedTotalMatches++;

    for (const [playerId, won] of rosteredPlayers) {
      const agg = byPlayer.get(playerId);
      if (!agg) continue;
      recordMatchParticipation(agg, at, won);
      consumeNearestEntry(matchEntries, playerId, at, 2_000);
      if (won === true) {
        consumeNearestEntry(winEntries, playerId, at, 2_000);
      } else if (won === false) {
        consumeNearestEntry(lossEntries, playerId, at, 2_000);
        // Consume any GG title entry for this loser so it doesn't surface as an
        // orphan in the pass below and produce a double-counted loss.
        consumeNearestEntry(ggEntries, playerId, at, 2_000);
      }
    }
  }

  const legacyClusters = new Map<
    string,
    { at: Date; players: Set<string> }
  >();

  for (const [playerId, leftoverEntries] of matchEntries) {
    for (const entry of leftoverEntries) {
      const key = secondKey(entry.createdAt);
      const cluster = legacyClusters.get(key) ?? {
        at: entry.createdAt,
        players: new Set<string>(),
      };
      cluster.players.add(playerId);
      if (entry.createdAt < cluster.at) cluster.at = entry.createdAt;
      legacyClusters.set(key, cluster);
    }
  }

  for (const [key, cluster] of legacyClusters) {
    for (const playerId of cluster.players) {
      const agg = byPlayer.get(playerId);
      if (!agg) continue;
      let won: boolean;
      if (consumeEntryInSecond(winEntries, playerId, key)) {
        won = true;
      } else if (consumeEntryInSecond(lossEntries, playerId, key)) {
        won = false;
      } else {
        // Legacy entry: no explicit win/loss written. Infer from GG title presence:
        // a GG entry at the same second means the player received the worst-loser
        // title → they lost. No GG → assume win.
        won = !consumeEntryInSecond(ggEntries, playerId, key);
      }
      recordMatchParticipation(agg, cluster.at, won);
    }
  }

  // Orphaned GG entries: a GG title that has no paired `match` entry in the same
  // second (i.e. the GG was logged standalone, or the match entry crossed a second
  // boundary). Every GG title means the player lost, so record each as a loss.
  let orphanedGgCount = 0;
  for (const [playerId, leftoverGgs] of ggEntries) {
    const agg = byPlayer.get(playerId);
    if (!agg) continue;
    for (const entry of leftoverGgs) {
      recordMatchParticipation(agg, entry.createdAt, false);
      orphanedGgCount++;
    }
  }

  return {
    byPlayer,
    totalMatches: normalizedTotalMatches + legacyClusters.size + orphanedGgCount,
    inferredLegacyMatches: legacyClusters.size + orphanedGgCount,
  };
}
