export type Side = "radiant" | "dire";

export type ExtractedPlayer = {
  slot: number;
  displayName: string;
  rosterId: string | null;
  side: Side;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
  mmrChange: number | null;
  won: boolean;
};

export type ExtractedMatch = {
  externalMatchId: string | null;
  durationSeconds: number | null;
  winningSide: Side;
  players: ExtractedPlayer[];
};

export function buildPrompt(roster: { id: string; name: string }[]): {
  system: string;
  user: string;
} {
  const rosterList = roster.map((r) => `- ${r.id} (${r.name})`).join("\n");
  const rosterIdUnion = roster.map((r) => `"${r.id}"`).join(" | ");

  const system =
    "You are an expert Dota 2 post-match scoreboard OCR. " +
    "You read a single screenshot of the end-of-game scoreboard and return strict JSON " +
    "matching the schema described by the user. You never invent data: if a field is " +
    "unreadable, use null or 0 as instructed. You return exactly 10 players " +
    "(5 Radiant, 5 Dire), top-to-bottom as they appear. You match players to the " +
    "provided roster by display name, and context clues like hero and side. " +
    "Clan tags like [OMP], emoji, and unicode tricks are expected — strip them " +
    "mentally when matching. If a player cannot be confidently mapped to a roster " +
    "id, set rosterId to null. Output ONLY the JSON object. No prose. No markdown fences.";

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
      "hero": string,
      "kills": number,
      "deaths": number,
      "assists": number,
      "netWorth": number,
      "mmrChange": number | null,
      "won": boolean
    }
  ]
}

Rules:
- "players" must contain exactly 10 entries.
- "won" is true iff the player's side equals winningSide.
- "durationSeconds" = minutes*60 + seconds from the visible match timer.
- "netWorth" is total gold (the large number in the Property column). Parse "23.4k" as 23400, "1.2m" as 1200000.
- "mmrChange" is the green "+25" or red "-25" if visible near the MMR; otherwise null.
- "rosterId" MUST be one of the listed ids above or null. Do not invent new ids.
- If a stat is truly unreadable, use 0 for numbers (except mmrChange/externalMatchId/durationSeconds which use null).
- Output ONLY the JSON object.`;

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
  const lower = v.toLowerCase();
  return SIDES.includes(lower as Side) ? (lower as Side) : null;
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
      hero: typeof pr.hero === "string" ? pr.hero : "",
      kills: Math.max(0, Math.round(toNumber(pr.kills))),
      deaths: Math.max(0, Math.round(toNumber(pr.deaths))),
      assists: Math.max(0, Math.round(toNumber(pr.assists))),
      netWorth: Math.max(0, Math.round(toNumber(pr.netWorth))),
      mmrChange: toNullableNumber(pr.mmrChange),
      won: side === winningSide,
    });
  }

  if (players.length === 0) return null;

  return {
    externalMatchId:
      typeof r.externalMatchId === "string" && r.externalMatchId.length > 0
        ? r.externalMatchId
        : null,
    durationSeconds: toNullableNumber(r.durationSeconds),
    winningSide,
    players,
  };
}
