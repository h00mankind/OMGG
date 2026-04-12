import type { TransactionChunk } from "@instantdb/core";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { CURRENT_TITLE } from "@/lib/config";
import { ENTRY_KIND_GG, ENTRY_KIND_MATCH } from "@/lib/entry-kinds";

/**
 * One DB row per unit. GG and matches can be logged together in one transaction.
 */
export function logGgAndMatchesBatch(
  ggByPlayer: Record<string, number>,
  matchesByPlayer: Record<string, number>
) {
  const txs: TransactionChunk<"entries", Record<string, unknown>>[] = [];
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
