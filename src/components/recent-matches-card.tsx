import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playerColor, playerInitial } from "@/lib/player-color";

export type RecentMatchItem = {
  id: string;
  outcome: "W" | "L" | "—";
  agoLabel: string;
  titleLabel?: string | null;
  participants: { id: string; name: string }[];
  durationLabel?: string | null;
};

export function RecentMatchesCard({
  matches,
  onViewAll,
}: {
  matches: RecentMatchItem[];
  onViewAll?: () => void;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Recent Matches
        </h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary hover:text-primary/80"
          >
            View All
          </button>
        )}
      </header>
      {matches.length === 0 ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">No matches yet.</p>
      ) : (
        <ul>
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 border-b border-white/5 px-5 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {m.agoLabel}
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-display text-xs font-semibold uppercase tracking-[0.12em]",
                    m.titleLabel === "MVP"
                      ? "text-orange-400"
                      : m.titleLabel === "SVP"
                        ? "text-yellow-300"
                        : "text-foreground/80",
                  )}
                >
                  {m.titleLabel ?? "Match"}
                </div>
              </div>

              <div className="flex shrink-0 -space-x-1.5">
                {m.participants.slice(0, 5).map((p) => {
                  const c = playerColor(p.id);
                  return (
                    <Avatar
                      key={p.id}
                      className={cn(
                        "size-7 ring-2 ring-card",
                        c.bg,
                      )}
                    >
                      <AvatarFallback
                        className={cn(c.bg, c.text, "text-[10px] font-semibold")}
                      >
                        {playerInitial(p.name)}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>

              <span
                className={cn(
                  "ml-auto inline-flex size-7 items-center justify-center font-display text-sm font-bold tabular-nums",
                  m.outcome === "W"
                    ? "bg-emerald-500/15 text-emerald-400 glow-win"
                    : m.outcome === "L"
                      ? "bg-rose-500/15 text-rose-400 glow-loss"
                      : "bg-muted/40 text-muted-foreground",
                )}
              >
                {m.outcome}
              </span>

              <span className="ml-1 text-right">
                <span className="block font-display text-xs font-semibold tabular-nums text-foreground">
                  {m.durationLabel ?? "—"}
                </span>
                <span className="block text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Ranked
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
