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

Titles — ONLY these three keys exist. Ignore everything else in the awards panel.
Titles live in the "Title for the Round" column (中文: 本场称号). A title
belongs to the player whose NAME ROW it is HORIZONTALLY ALIGNED WITH — bind by
row, not by proximity to neighboring icons or medals.

All three titles are rendered the SAME WAY visually: a small rounded-square
pill/badge with a GOLD or YELLOW frame/border sitting in the "Title for the
Round" column. They differ ONLY in what's INSIDE the pill:

    mvp  -> MVP, the BEST player overall. Awarded on the WINNING side ONLY.
            Pill contents: the 3 LATIN LETTERS "MVP" (gold/yellow, readable).
            If you cannot read the letters M-V-P inside the pill, it's not MVP.
    svp  -> SVP, the best player on the LOSING team (the most valuable loser).
            Awarded on the LOSING side ONLY.
            Pill contents: the 3 LATIN LETTERS "SVP" (silver or yellow).
            If you cannot read the letters S-V-P inside the pill, it's not SVP.
            Decorative flair (flowers / medals / emoji / confetti) may sit
            NEXT TO an SVP pill in the same cell — these are reward items,
            NEVER titles, NEVER GG.
    gg   -> GG, the WORST player on the losing team. Awarded on the LOSING
            side ONLY.

            GG PILL CONTENTS — GG is ALWAYS this ONE specific character:

                佃   (diàn — "tenant farmer")

            rendered in WHITE, inside the white pill, on a losing-side
            row. That is the ONE and ONLY glyph that represents GG. Shape
            cues for recognising 佃:
              • Narrow "person" radical (亻) on the LEFT (two simple strokes)
              • A small square / grid shape (田 — four sub-squares) on the
                RIGHT, taking up the majority of the glyph width
              • Overall: a vertical stroke + a mini window-pane

MANDATORY SCAN PROCEDURE for the titles panel — do this BEFORE emitting JSON:
  1. Identify the losing side (opposite of winningSide from the banner).
  2. Walk through EVERY row of the losing team, top to bottom. For each row
     inspect ONLY the "Title for the Round" cell for that row.
  3. For each gold/yellow-framed pill you find, inspect its CONTENTS:
       a. Latin letters "M-V-P" → mvp. (Should only occur on the winning
          side; if somehow seen on the losing side, treat as OCR error.)
       b. Latin letters "S-V-P" → svp.
       c. The specific white Chinese character 佃 (person radical 亻 on the
          left + a 田 "window-pane" square on the right), OR the Latin
          letters "GG" in white → gg.
       e. Empty / no pill → no title on that row.
  4. Walk every row of the winning team the same way, but only accept MVP
     matches.
  5. Before emitting: a match ALWAYS HAS ONLY one GG and SVP on losing side
     and one MVP on the winning side.

Hard constraints:
- Bind title → player by ROW ALIGNMENT only. Do NOT shuffle titles to a
  "better" candidate based on K/D or other stats.
- MVP, SVP, and GG ALWAYS appear on DIFFERENT rows (different players).
  NEVER stack two of these on the same row/player.
- Do NOT use MVP/SVP/GG title placement to decide "winningSide".
- Emit AT MOST ONE "mvp" (best player, winning side).
- Emit AT MOST ONE "svp" (best loser, losing side).
- Emit AT MOST ONE "gg" (worst player, losing side).
- "displayName" must exactly match the player's name from the "players" array
  (the same row the title is aligned with).
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

const MAX_DISPLAY_NAME = 64;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
function sanitizeDisplayName(v: unknown, fallback = "Unknown"): string {
  if (typeof v !== "string") return fallback;
  const cleaned = v.replace(CONTROL_CHARS, "").trim();
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, MAX_DISPLAY_NAME);
}

export type ValidationResult =
  | { ok: true; match: ExtractedMatch }
  | { ok: false; reason: string };

/**
 * Parse + sanitize the model's JSON. Returns a reason string when the shape
 * is unrecoverable. Coerces any `rosterId` not in `rosterIds` to null — never
 * trust the model to invent ids.
 */
export function validateExtraction(
  raw: unknown,
  rosterIds: Set<string>
): ExtractedMatch | null {
  const result = validateExtractionDetailed(raw, rosterIds);
  return result.ok ? result.match : null;
}

export function validateExtractionDetailed(
  raw: unknown,
  rosterIds: Set<string>
): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "raw is not an object" };
  }
  const r = raw as Record<string, unknown>;

  const winningSide = toSide(r.winningSide);
  if (!winningSide) {
    return {
      ok: false,
      reason: `winningSide missing or unrecognised (got: ${JSON.stringify(r.winningSide)})`,
    };
  }

  const playersRaw = Array.isArray(r.players) ? r.players : null;
  if (!playersRaw) {
    return { ok: false, reason: "players is not an array" };
  }

  const players: ExtractedPlayer[] = [];
  const skippedPlayers: string[] = [];
  for (let i = 0; i < playersRaw.length; i++) {
    const p = playersRaw[i];
    if (!p || typeof p !== "object") {
      skippedPlayers.push(`idx=${i} not-object`);
      continue;
    }
    const pr = p as Record<string, unknown>;
    const side = toSide(pr.side);
    if (!side) {
      skippedPlayers.push(`idx=${i} bad-side=${JSON.stringify(pr.side)}`);
      continue;
    }
    const rosterIdRaw = pr.rosterId;
    const rosterId =
      typeof rosterIdRaw === "string" && rosterIds.has(rosterIdRaw)
        ? rosterIdRaw
        : null;
    const slot = toNumber(pr.slot) || i + 1;
    players.push({
      slot,
      displayName: sanitizeDisplayName(pr.displayName),
      rosterId,
      side,
      won: side === winningSide,
    });
  }

  if (players.length === 0) {
    return {
      ok: false,
      reason: `no valid players (raw length=${playersRaw.length}, skipped=[${skippedPlayers.join("; ")}])`,
    };
  }

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
    const displayName = sanitizeDisplayName(t.displayName);
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

  const rawExtId =
    typeof r.externalMatchId === "string"
      ? r.externalMatchId.replace(CONTROL_CHARS, "").trim().slice(0, 64)
      : "";

  return {
    ok: true,
    match: {
      externalMatchId: rawExtId.length > 0 ? rawExtId : null,
      durationSeconds: toNullableNumber(r.durationSeconds),
      winningSide,
      players,
      titles,
    },
  };
}
