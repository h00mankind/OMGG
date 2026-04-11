export const CURRENT_TITLE = "Leaderboard";

export const ROSTER: { id: string; name: string }[] = [
  { id: "h00man", name: "h00man" },
  { id: "ayoe", name: "Ayoe" },
  { id: "wy", name: "WY" },
  { id: "valen", name: "Valen" },
  { id: "pucku", name: "pucku" },
  { id: "mk", name: "MK" },
];

/** Predefined groups for quick player selection. */
export const GROUPS: { label: string; playerIds: string[] }[] = [
  { label: "Trio", playerIds: ["h00man", "ayoe", "wy"] },
  { label: "Quad", playerIds: ["h00man", "ayoe", "wy", "valen"] },
  { label: "Full Squad", playerIds: ["h00man", "ayoe", "wy", "valen", "pucku"] },
];
