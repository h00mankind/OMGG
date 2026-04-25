import { ROSTER } from "@/lib/config";

const PALETTE: { bg: string; text: string; ring: string }[] = [
  { bg: "bg-fuchsia-600/80", text: "text-white", ring: "ring-fuchsia-500/40" },
  { bg: "bg-emerald-600/80", text: "text-white", ring: "ring-emerald-500/40" },
  { bg: "bg-amber-600/80", text: "text-white", ring: "ring-amber-500/40" },
  { bg: "bg-sky-600/80", text: "text-white", ring: "ring-sky-500/40" },
  { bg: "bg-rose-600/80", text: "text-white", ring: "ring-rose-500/40" },
  { bg: "bg-violet-600/80", text: "text-white", ring: "ring-violet-500/40" },
];

const colorByPlayer = new Map(
  ROSTER.map((p, i) => [p.id, PALETTE[i % PALETTE.length]])
);

export function playerColor(playerId: string) {
  return (
    colorByPlayer.get(playerId) ?? {
      bg: "bg-zinc-700",
      text: "text-white",
      ring: "ring-zinc-500/40",
    }
  );
}

export function playerInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}
