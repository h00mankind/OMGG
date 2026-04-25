const STEPS = [
  {
    n: 1,
    title: "Upload a post-match screenshot",
    body: "We'll scan and extract players and their titles.",
  },
  {
    n: 2,
    title: "Review player list",
    body: "Cycle each player's result: Win, Loss, or did not play.",
  },
  {
    n: 3,
    title: "Confirm & log",
    body: "Save the match. Updates the leaderboard live.",
  },
];

export function HowItWorksCard() {
  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-white/5 px-5 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          How It Works
        </h3>
      </header>
      <ol className="space-y-4 px-5 py-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center bg-primary/15 font-display text-sm font-bold text-primary glow-primary-soft">
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
                {s.title}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
