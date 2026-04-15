export type Side = "radiant" | "dire";

export type ExtractedPlayer = {
  slot: number;
  displayName: string;
  rosterId: string | null;
  side: Side;
  won: boolean;
};

export type ExtractedTitle = {
  key: string;
  label: string;
  displayName: string;
  rosterId: string | null;
};

export type ExtractedMatch = {
  externalMatchId: string | null;
  durationSeconds: number | null;
  winningSide: Side;
  players: ExtractedPlayer[];
  titles: ExtractedTitle[];
};

/**
 * Canonical English label for every title we track. Keys are snake_case and
 * stable — they are what gets persisted. Labels are what the UI shows.
 * These are the flavor titles from the Dota 2 Chinese (Perfect World) client's
 * post-match awards panel. Some appear in Chinese on-screen; the model maps
 * them to these canonical English keys.
 */
export const TITLE_LABELS: Record<string, string> = {
  mvp: "MVP",
  svp: "SVP",
  gg: "GG",
};

const TITLE_KEYS = Object.keys(TITLE_LABELS);

export function buildPrompt(
  roster: { id: string; name: string; aliases?: string[] }[]
): {
  system: string;
  user: string;
} {
  const rosterList = roster
    .map((r) => {
      const aliasPart =
        r.aliases && r.aliases.length > 0
          ? ` — also known as: ${r.aliases.join(", ")}`
          : "";
      return `- ${r.id} (${r.name})${aliasPart}`;
    })
    .join("\n");
  const rosterIdUnion = roster.map((r) => `"${r.id}"`).join(" | ");
  const titleKeyUnion = TITLE_KEYS.map((k) => `"${k}"`).join(" | ");

  const system =
    "You are an expert Dota 2 post-match scoreboard OCR. " +
    "You read a single screenshot of the end-of-game scoreboard and return strict JSON " +
    "matching the schema described by the user. You return exactly 10 players " +
    "(5 Radiant, 5 Dire), top-to-bottom as they appear. You match players to the " +
    "provided roster by display name OR any known alias (roster entries list " +
    "aliases; a match on an alias is as valid as a match on the primary name). " +
    "Clan tags like [OMP], emoji, and unicode tricks are expected — strip them " +
    "mentally when matching. If a player cannot be confidently mapped to a roster " +
    "id, set rosterId to null. You ALSO extract up to three flavor titles from " +
    "the post-match awards panel: MVP, SVP, and GG (the loser-side flavor title). " +
    "For match outcome, you MUST read the large victory banner at the center top " +
    "of the screenshot. It usually says 'Radiant wins' or 'Dire wins' (sometimes " +
    "'Radiant victory' / 'Dire victory'). This banner is the source of truth for " +
    "winningSide. Do NOT infer the winner from title placement, roster presence, " +
    "or which side contains familiar players. " +
    "Output ONLY the JSON object. No prose. No markdown fences.";

  const user = `Roster (id (display name)):
${rosterList}

Return a single JSON object with this EXACT shape:

{
  "externalMatchId": string | null,
  "durationSeconds": number | null,
  "winningSide": "radiant" | "dire",
  "players": [
    {
      "slot": number,              // 1..10 top-to-bottom in the image
      "displayName": string,       // raw visible name (you may keep clan tags/emoji)
      "rosterId": ${rosterIdUnion} | null,
      "side": "radiant" | "dire",
      "won": boolean
    }
  ],
  "titles": [
    {
      "key": ${titleKeyUnion},
      "displayName": string,       // raw visible name of the player awarded the title
      "rosterId": ${rosterIdUnion} | null
    }
  ]
}

Rules:
- "players" must contain exactly 10 entries.
- Determine "winningSide" from the large center-top victory banner only:
  "Radiant wins" / "Dire wins" (or equivalent victory wording).
- The victory banner is the source of truth. If the screenshot shows one of our
  roster members on the losing side, keep them on the losing side.
- "won" is true iff the player's side equals winningSide.
- "durationSeconds" = minutes*60 + seconds from the visible match timer.
- "rosterId" MUST be one of the listed ids above or null. Do not invent new ids.
- Do NOT extract hero, K/D/A, net worth, GPM, MMR, or any other stats.

Titles — ONLY these three keys exist. Ignore everything else in the awards panel:
    mvp  -> MVP, the BEST player overall. Awarded on the WINNING side, usually
            gold/yellow text. Chinese: 全场最佳 / 最有价值 / MVP.
    svp  -> SVP, the best player on the LOSING team (the most valuable loser).
            Awarded on the LOSING side, usually silver/yellow text. Chinese:
            次佳 / 次席 / SVP.
    gg   -> GG, the WORST player of the match. Awarded on the LOSING side in
            plain white text. Its icon is a Chinese character that LOOKS LIKE
            the glyph "田" (a square split into four smaller squares). That
            icon is easy to confuse with the AFK/挂机 badge — if the player
            was clearly present and playing, prefer "gg" over any AFK guess.
            Chinese: 白板 / 白板先生 / GG.

Instructions for the titles panel:
- Do NOT use MVP/SVP/GG title placement to decide "winningSide".
- Emit AT MOST ONE "mvp" (best player, winning side).
- Emit AT MOST ONE "svp" (best loser, losing side).
- Emit AT MOST ONE "gg" (worst player, losing side).
- These three titles are MUTUALLY EXCLUSIVE per player: a single player can
  hold at most ONE of {mvp, svp, gg}. Never assign two of these to the same
  displayName.
- "displayName" must exactly match the player's name from the "players" array.
- If a title is not clearly visible, omit it (return fewer entries or []).
- Do NOT emit any other title keys. They are not tracked.

Output ONLY the JSON object.`;

  return { system, user };
}

const SIDES: readonly Side[] = ["radiant", "dire"] as const;

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toSide(v: unknown): Side | null {
  if (typeof v !== "string") return null;
  const lower = v.toLowerCase().trim();
  if (SIDES.includes(lower as Side)) return lower as Side;
  if (lower.includes("radiant")) return "radiant";
  if (lower.includes("dire")) return "dire";
  return null;
}

/**
 * Parse + sanitize the model's JSON. Returns null if the shape is unrecoverable.
 * Coerces any `rosterId` not in `rosterIds` to null — never trust the model to
 * invent ids.
 */
export function validateExtraction(
  raw: unknown,
  rosterIds: Set<string>
): ExtractedMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const winningSide = toSide(r.winningSide);
  if (!winningSide) return null;

  const playersRaw = Array.isArray(r.players) ? r.players : null;
  if (!playersRaw) return null;

  const players: ExtractedPlayer[] = [];
  for (let i = 0; i < playersRaw.length; i++) {
    const p = playersRaw[i];
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const side = toSide(pr.side);
    if (!side) continue;
    const rosterIdRaw = pr.rosterId;
    const rosterId =
      typeof rosterIdRaw === "string" && rosterIds.has(rosterIdRaw)
        ? rosterIdRaw
        : null;
    const slot = toNumber(pr.slot) || i + 1;
    players.push({
      slot,
      displayName: typeof pr.displayName === "string" ? pr.displayName : "Unknown",
      rosterId,
      side,
      won: side === winningSide,
    });
  }

  if (players.length === 0) return null;

  const titlesRaw = Array.isArray(r.titles) ? r.titles : [];
  const titles: ExtractedTitle[] = [];
  const usedKeys = new Set<string>();
  const claimedPlayers = new Set<string>();
  for (const tr of titlesRaw) {
    if (!tr || typeof tr !== "object") continue;
    const t = tr as Record<string, unknown>;
    const key = typeof t.key === "string" ? t.key.toLowerCase() : null;
    if (!key || !(key in TITLE_LABELS)) continue;
    if (usedKeys.has(key)) continue;
    const displayName =
      typeof t.displayName === "string" && t.displayName.length > 0
        ? t.displayName
        : "Unknown";
    const playerKey = displayName.toLowerCase();
    if (claimedPlayers.has(playerKey)) continue;
    usedKeys.add(key);
    claimedPlayers.add(playerKey);
    const rosterIdRaw = t.rosterId;
    const rosterId =
      typeof rosterIdRaw === "string" && rosterIds.has(rosterIdRaw)
        ? rosterIdRaw
        : null;
    titles.push({
      key,
      label: TITLE_LABELS[key],
      displayName,
      rosterId,
    });
  }

  return {
    externalMatchId:
      typeof r.externalMatchId === "string" && r.externalMatchId.length > 0
        ? r.externalMatchId
        : null,
    durationSeconds: toNullableNumber(r.durationSeconds),
    winningSide,
    players,
    titles,
  };
}
