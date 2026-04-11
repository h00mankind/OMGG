import { ROSTER } from "@/lib/config";
import { ENTRY_KIND_MATCH, normalizeEntryKind } from "@/lib/entry-kinds";

export type EntryRow = {
  playerId: string;
  kind?: string | null;
  createdAt: Date;
};

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
