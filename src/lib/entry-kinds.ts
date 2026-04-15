export const ENTRY_KIND_GG = "gg";
export const ENTRY_KIND_MATCH = "match";
export const ENTRY_KIND_WIN = "win";
export const ENTRY_KIND_LOSS = "loss";
export const ENTRY_KIND_MVP = "mvp";
export const ENTRY_KIND_SVP = "svp";

export type EntryKind =
  | typeof ENTRY_KIND_GG
  | typeof ENTRY_KIND_MATCH
  | typeof ENTRY_KIND_WIN
  | typeof ENTRY_KIND_LOSS
  | typeof ENTRY_KIND_MVP
  | typeof ENTRY_KIND_SVP;

const KNOWN: Record<string, EntryKind> = {
  gg: ENTRY_KIND_GG,
  match: ENTRY_KIND_MATCH,
  win: ENTRY_KIND_WIN,
  loss: ENTRY_KIND_LOSS,
  mvp: ENTRY_KIND_MVP,
  svp: ENTRY_KIND_SVP,
};

export function normalizeEntryKind(
  kind: string | null | undefined
): EntryKind {
  if (typeof kind === "string" && kind in KNOWN) return KNOWN[kind];
  // Legacy rows without `kind` are GGs.
  return ENTRY_KIND_GG;
}

export function entryKindShortLabel(kind: EntryKind): string {
  if (kind === ENTRY_KIND_MATCH) return "match";
  if (kind === ENTRY_KIND_WIN) return "win";
  if (kind === ENTRY_KIND_LOSS) return "loss";
  if (kind === ENTRY_KIND_MVP) return "MVP";
  if (kind === ENTRY_KIND_SVP) return "SVP";
  return "GG";
}
