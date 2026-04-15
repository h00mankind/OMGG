import { ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_GG,
  ENTRY_KIND_LOSS,
  ENTRY_KIND_MATCH,
  ENTRY_KIND_WIN,
  normalizeEntryKind,
} from "@/lib/entry-kinds";

export type EntryRow = {
  playerId: string;
  kind?: string | null;
  createdAt: Date;
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
  matches: number;
  wins: number;
  losses: number;
  lastGg: Date | null;
  lastMatch: Date | null;
  lastWin: Date | null;
  lastLoss: Date | null;
};

function emptyAggMap(): Map<string, PlayerAgg> {
  const m = new Map<string, PlayerAgg>();
  for (const r of ROSTER) {
    m.set(r.id, {
      gg: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      lastGg: null,
      lastMatch: null,
      lastWin: null,
      lastLoss: null,
    });
  }
  return m;
}

/** Per-player GG counts per calendar day, last `windowDays` days. Matches excluded. */
export function ggStackedByDay(
  entries: EntryRow[],
  windowDays: number = DEFAULT_GG_DAY_WINDOW
): DayGgStackPoint[] {
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== ENTRY_KIND_GG) continue;
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

/** Compute rank (0-based) from a subset of entries using the same sort as the leaderboard. */
function rankFrom(subset: EntryRow[]): Map<string, number> {
  const aggs = new Map<string, { gg: number; lastGg: Date | null }>();
  for (const r of ROSTER) aggs.set(r.id, { gg: 0, lastGg: null });
  for (const e of subset) {
    if (normalizeEntryKind(e.kind) !== ENTRY_KIND_GG) continue;
    const a = aggs.get(e.playerId);
    if (!a) continue;
    a.gg++;
    if (!a.lastGg || e.createdAt > a.lastGg) a.lastGg = e.createdAt;
  }
  const sorted = [...ROSTER].sort((a, b) => {
    const ag = aggs.get(a.id)!;
    const bg = aggs.get(b.id)!;
    if (bg.gg !== ag.gg) return bg.gg - ag.gg;
    if (ag.lastGg && bg.lastGg) return bg.lastGg.getTime() - ag.lastGg.getTime();
    if (ag.lastGg) return -1;
    if (bg.lastGg) return 1;
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
export function trendByPlayer(entries: EntryRow[]): Map<string, Trend> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const currentRanks = rankFrom(entries);
  const prevEntries = entries.filter((e) => e.createdAt.getTime() < todayStart.getTime());
  const prevRanks = rankFrom(prevEntries);

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
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== ENTRY_KIND_GG) continue;
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
  const counts = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) !== ENTRY_KIND_GG) continue;
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
 * normalize to GG. MVP/SVP are countable entries too, but they don't map to
 * any field on PlayerAgg — they're surfaced via the `matchTitles` table.
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
      if (!agg.lastGg || e.createdAt > agg.lastGg) {
        agg.lastGg = e.createdAt;
      }
    }
  }
  return map;
}
