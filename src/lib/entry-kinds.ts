export const ENTRY_KIND_GG = "gg";
export const ENTRY_KIND_MATCH = "match";

export type EntryKind = typeof ENTRY_KIND_GG | typeof ENTRY_KIND_MATCH;

export function normalizeEntryKind(
  kind: string | null | undefined
): EntryKind {
  return kind === ENTRY_KIND_MATCH ? ENTRY_KIND_MATCH : ENTRY_KIND_GG;
}

export function entryKindShortLabel(kind: EntryKind): string {
  return kind === ENTRY_KIND_MATCH ? "match" : "GG";
}
