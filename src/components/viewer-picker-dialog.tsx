"use client";

import { useState } from "react";
import { ROSTER } from "@/lib/config";
import { useViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { playerColor, playerInitial } from "@/lib/player-color";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ViewerPickerDialog({
  open,
  onClose,
  forced = false,
}: {
  open: boolean;
  onClose: () => void;
  forced?: boolean;
}) {
  if (!open) return null;
  return <ViewerPickerDialogInner onClose={onClose} forced={forced} />;
}

function ViewerPickerDialogInner({
  onClose,
  forced,
}: {
  onClose: () => void;
  forced: boolean;
}) {
  const { viewer, setViewer } = useViewer();
  const [pending, setPending] = useState<string | null>(viewer?.id ?? null);

  const confirm = () => {
    if (!pending) return;
    setViewer(pending);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!forced) onClose();
      }}
    >
      <div
        className="surface-card relative w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!forced && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
          Welcome
        </div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-foreground">
          Who are you?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick your handle so the leaderboard can show your stats and recent matches.
        </p>

        <ul className="mt-5 grid grid-cols-2 gap-2">
          {ROSTER.map((p) => {
            const c = playerColor(p.id);
            const active = pending === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPending(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 border bg-card/60 px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10 glow-primary"
                      : "border-white/10 hover:bg-white/5",
                  )}
                >
                  <Avatar className={cn("size-9", c.bg)}>
                    <AvatarFallback className={cn(c.bg, c.text, "font-semibold")}>
                      {playerInitial(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-foreground">
                    {p.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex justify-end gap-2">
          {!forced && (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            disabled={!pending}
            onClick={confirm}
            className="glow-primary uppercase tracking-[0.16em]"
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
