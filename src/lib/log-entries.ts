import type { TransactionChunk } from "@instantdb/core";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { CURRENT_TITLE } from "@/lib/config";
import { ENTRY_KIND_GG, ENTRY_KIND_MATCH } from "@/lib/entry-kinds";
import type { ExtractedMatch } from "@/lib/dota-ocr";

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
          hero: p.hero,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          netWorth: p.netWorth,
          ...(p.mmrChange !== null ? { mmrChange: p.mmrChange } : {}),
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

      if (p.won) {
        txs.push(
          db.tx.entries[id()].update({
            playerId: p.rosterId,
            title: CURRENT_TITLE,
            kind: ENTRY_KIND_GG,
            createdAt: t + o,
          })
        );
        o += 1;
      }
    }
  }

  return db.transact(txs);
}
