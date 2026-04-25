import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playerColor, playerInitial } from "@/lib/player-color";

export type RecentEntryItem = {
  id: string;
  resultLabel: string;
  resultTone: "win" | "loss" | "neutral";
  agoLabel: string;
  participants: { id: string; name: string }[];
  pointsLabel?: string | null;
};

export function RecentEntriesCard({
  entries,
  onViewAll,
}: {
  entries: RecentEntryItem[];
  onViewAll?: () => void;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Recent Entries
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
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">No entries yet.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li
              key={e.id}
              className="border-b border-white/5 px-5 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-display text-xs font-semibold uppercase tracking-[0.12em]",
                    e.resultTone === "win"
                      ? "text-emerald-400"
                      : e.resultTone === "loss"
                        ? "text-rose-400"
                        : "text-foreground/80",
                  )}
                >
                  {e.resultLabel}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {e.agoLabel}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex -space-x-1.5">
                  {e.participants.slice(0, 5).map((p) => {
                    const c = playerColor(p.id);
                    return (
                      <Avatar
                        key={p.id}
                        className={cn("size-6 ring-2 ring-card", c.bg)}
                      >
                        <AvatarFallback
                          className={cn(c.bg, c.text, "text-[9px] font-semibold")}
                        >
                          {playerInitial(p.name)}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
                {e.pointsLabel && (
                  <span className="ml-auto font-display text-xs font-semibold tabular-nums text-foreground">
                    {e.pointsLabel}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
