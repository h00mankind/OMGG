"use client";

import { cn } from "@/lib/utils";
import type { Tokens } from "./types";

export function Stage({
  tokens,
  lastAction,
  fullBleed,
  children,
}: {
  tokens: Tokens;
  lastAction: string | null;
  fullBleed?: boolean;
  children: React.ReactNode;
}) {
  const styleVars = {
    "--primary": tokens.primary,
    "--surface": tokens.surface,
    "--surface-2": tokens.surface2,
    ...(tokens.fontDisplay
      ? {}
      : { "--font-display": "var(--font-sans)" }),
  } as React.CSSProperties;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        style={styleVars}
        className={cn(
          "dark relative flex flex-1 items-start justify-center overflow-auto bg-background p-10",
        )}
      >
        <div
          className={cn(
            "w-full",
            fullBleed ? "max-w-none" : "max-w-2xl",
          )}
        >
          {children}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 bg-card/60 px-5 py-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Last action
        </div>
        <div className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
          {lastAction ?? "—"}
        </div>
      </div>
    </div>
  );
}
