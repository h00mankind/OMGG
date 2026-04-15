export const CURRENT_TITLE = "Leaderboard";

export type RosterMember = {
  id: string;
  name: string;
  aliases: string[];
};

export const ROSTER: RosterMember[] = [
  { id: "h00man", name: "h00man", aliases: ["h00mankind", "YZR", "Yarzar"] },
  { id: "ayoe", name: "Ayoe", aliases: ["Swarley"] },
  {
    id: "wy",
    name: "WY",
    aliases: ["Win Htain", "Wai Yan", "Bottom Gun", "Mickvrave"],
  },
  {
    id: "valen",
    name: "Valen",
    aliases: ["Ko Sai", "Thorfinn", "Ko Sai Ma Sel Ya"],
  },
  { id: "pucku", name: "pucku", aliases: ["ziki"] },
  {
    id: "mk",
    name: "MK",
    aliases: ["Ghost of Suki-qeema", "Mad A Low Min Khant", "Min Khant"],
  },
];

/** Predefined groups for quick player selection. */
export const GROUPS: { label: string; playerIds: string[] }[] = [
  { label: "Trio", playerIds: ["h00man", "ayoe", "wy"] },
  { label: "Quad", playerIds: ["h00man", "ayoe", "wy", "valen"] },
  { label: "Full Squad", playerIds: ["h00man", "ayoe", "wy", "valen", "pucku"] },
];
