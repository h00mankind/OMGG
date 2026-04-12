import { ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_MATCH,
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

/** GG row counts per local calendar day, last `windowDays` days including today. Matches excluded. */
export function ggCountsByDay(
  entries: EntryRow[],
  windowDays: number = DEFAULT_GG_DAY_WINDOW
): DayGgPoint[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (normalizeEntryKind(e.kind) === ENTRY_KIND_MATCH) continue;
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
  lastGg: Date | null;
  lastMatch: Date | null;
};

function emptyAggMap(): Map<string, PlayerAgg> {
  const m = new Map<string, PlayerAgg>();
  for (const r of ROSTER) {
    m.set(r.id, {
      gg: 0,
      matches: 0,
      lastGg: null,
      lastMatch: null,
    });
  }
  return m;
}

/** Per-player GG and match counts plus last activity per kind. Legacy rows without `kind` count as GG. */
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
    } else {
      agg.gg++;
      if (!agg.lastGg || e.createdAt > agg.lastGg) {
        agg.lastGg = e.createdAt;
      }
    }
  }
  return map;
}
