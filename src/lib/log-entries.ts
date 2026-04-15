import type { TransactionChunk } from "@instantdb/core";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { CURRENT_TITLE, ROSTER } from "@/lib/config";
import {
  ENTRY_KIND_GG,
  ENTRY_KIND_LOSS,
  ENTRY_KIND_MATCH,
  ENTRY_KIND_WIN,
} from "@/lib/entry-kinds";
import { TITLE_LABELS, type ExtractedMatch } from "@/lib/dota-ocr";

/**
 * One DB row per unit. GG and matches can be logged together in one transaction.
 */
export function logGgAndMatchesBatch(
  ggByPlayer: Record<string, number>,
  matchesByPlayer: Record<string, number>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txs: TransactionChunk<any, any>[] = [];
  const t = Date.now();
  let o = 0;

  const push = (playerId: string, n: number, kind: string) => {
    const count = Math.max(0, Math.floor(Number(n)) || 0);
    for (let i = 0; i < count; i++) {
      txs.push(
        db.tx.entries[id()].update({
          playerId,
          title: CURRENT_TITLE,
          kind,
          createdAt: t + o,
        })
      );
      o += 1;
    }
  };

  for (const [playerId, raw] of Object.entries(ggByPlayer)) {
    push(playerId, raw, ENTRY_KIND_GG);
  }
  for (const [playerId, raw] of Object.entries(matchesByPlayer)) {
    push(playerId, raw, ENTRY_KIND_MATCH);
  }

  if (txs.length === 0) return;
  db.transact(txs);
}

/**
 * Writes a scanned match to DB: one `matches` row, one `matchPlayers` row per
 * selected player (linked to the match), plus compat `entries` rows for
 * roster-matched players so the existing leaderboard keeps working.
 */
export function logMatchFromScan(
  match: ExtractedMatch,
  selectionBySlot: Record<number, boolean>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txs: TransactionChunk<any, any>[] = [];
  const matchId = id();
  const t = Date.now();
  let o = 0;

  txs.push(
    db.tx.matches[matchId].update({
      title: CURRENT_TITLE,
      ...(match.externalMatchId
        ? { externalMatchId: match.externalMatchId }
        : {}),
      durationSeconds: match.durationSeconds ?? 0,
      winningSide: match.winningSide,
      playedAt: t,
      createdAt: t,
    })
  );

  for (const p of match.players) {
    if (!selectionBySlot[p.slot]) continue;

    const mpId = id();
    txs.push(
      db.tx.matchPlayers[mpId]
        .update({
          ...(p.rosterId ? { playerId: p.rosterId } : {}),
          displayName: p.displayName,
          side: p.side,
          hero: "",
          kills: 0,
          deaths: 0,
          assists: 0,
          netWorth: 0,
          won: p.won,
          createdAt: t + o,
        })
        .link({ match: matchId })
    );
    o += 1;

    if (p.rosterId) {
      txs.push(
        db.tx.entries[id()].update({
          playerId: p.rosterId,
          title: CURRENT_TITLE,
          kind: ENTRY_KIND_MATCH,
          createdAt: t + o,
        })
      );
      o += 1;

      txs.push(
        db.tx.entries[id()].update({
          playerId: p.rosterId,
          title: CURRENT_TITLE,
          kind: p.won ? ENTRY_KIND_WIN : ENTRY_KIND_LOSS,
          createdAt: t + o,
        })
      );
      o += 1;
    }
  }

  for (const title of match.titles) {
    txs.push(
      db.tx.matchTitles[id()]
        .update({
          titleKey: title.key,
          label: title.label,
          ...(title.rosterId ? { playerId: title.rosterId } : {}),
          displayName: title.displayName,
          createdAt: t + o,
        })
        .link({ match: matchId })
    );
    o += 1;

    // Mirror the title as a countable entry for the leaderboard.
    // gg/mvp/svp are valid entry kinds.
    if (title.rosterId) {
      txs.push(
        db.tx.entries[id()].update({
          playerId: title.rosterId,
          title: CURRENT_TITLE,
          kind: title.key,
          createdAt: t + o,
        })
      );
      o += 1;
    }
  }

  return db.transact(txs);
}

export type ManualMatchInput = {
  wonPlayerIds: string[];
  lostPlayerIds: string[];
  titles: {
    gg?: string | null;
    mvp?: string | null;
    svp?: string | null;
  };
};

/**
 * Manual match logger — no OCR, no matchPlayers stat rows. Writes a `matches`
 * row plus match/win/loss/title entries for roster members the user selected.
 */
export function logManualMatch(input: ManualMatchInput) {
  const rosterById = new Map(ROSTER.map((r) => [r.id, r]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txs: TransactionChunk<any, any>[] = [];
  const matchId = id();
  const t = Date.now();
  let o = 0;

  const hasWinners = input.wonPlayerIds.length > 0;
  const winningSide = hasWinners ? "radiant" : "dire";
  const losingSide = winningSide === "radiant" ? "dire" : "radiant";

  txs.push(
    db.tx.matches[matchId].update({
      title: CURRENT_TITLE,
      durationSeconds: 0,
      winningSide,
      playedAt: t,
      createdAt: t,
    })
  );

  const writePlayer = (playerId: string, won: boolean) => {
    const r = rosterById.get(playerId);
    if (!r) return;
    const mpId = id();
    txs.push(
      db.tx.matchPlayers[mpId]
        .update({
          playerId,
          displayName: r.name,
          side: won ? winningSide : losingSide,
          hero: "",
          kills: 0,
          deaths: 0,
          assists: 0,
          netWorth: 0,
          won,
          createdAt: t + o,
        })
        .link({ match: matchId })
    );
    o += 1;

    txs.push(
      db.tx.entries[id()].update({
        playerId,
        title: CURRENT_TITLE,
        kind: ENTRY_KIND_MATCH,
        createdAt: t + o,
      })
    );
    o += 1;

    txs.push(
      db.tx.entries[id()].update({
        playerId,
        title: CURRENT_TITLE,
        kind: won ? ENTRY_KIND_WIN : ENTRY_KIND_LOSS,
        createdAt: t + o,
      })
    );
    o += 1;
  };

  for (const pid of input.wonPlayerIds) writePlayer(pid, true);
  for (const pid of input.lostPlayerIds) writePlayer(pid, false);

  const writeTitle = (key: "gg" | "mvp" | "svp", playerId?: string | null) => {
    if (!playerId) return;
    const r = rosterById.get(playerId);
    if (!r) return;
    txs.push(
      db.tx.matchTitles[id()]
        .update({
          titleKey: key,
          label: TITLE_LABELS[key],
          playerId,
          displayName: r.name,
          createdAt: t + o,
        })
        .link({ match: matchId })
    );
    o += 1;
    txs.push(
      db.tx.entries[id()].update({
        playerId,
        title: CURRENT_TITLE,
        kind: key,
        createdAt: t + o,
      })
    );
    o += 1;
  };

  writeTitle("gg", input.titles.gg);
  writeTitle("mvp", input.titles.mvp);
  writeTitle("svp", input.titles.svp);

  return db.transact(txs);
}
