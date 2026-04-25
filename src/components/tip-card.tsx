import { Lightbulb } from "lucide-react";

export function TipCard({
  title = "Tip",
  body,
}: {
  title?: string;
  body: string;
}) {
  return (
    <section className="surface-card flex gap-3 p-5">
      <span className="flex size-9 shrink-0 items-center justify-center bg-amber-500/15 text-amber-300">
        <Lightbulb className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          {title}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </section>
  );
}
