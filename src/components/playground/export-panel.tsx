"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Tokens } from "./types";

function tokensToCss(tokens: Tokens): string {
  return [
    "/* @playground:tokens-start */",
    "/* Tokens controlled by /playground. */",
    ".dark {",
    `  --primary: ${tokens.primary};`,
    `  --surface: ${tokens.surface};`,
    `  --surface-2: ${tokens.surface2};`,
    "}",
    "/* @playground:tokens-end */",
  ].join("\n");
}

export function ExportPanel({
  tokens,
  componentProps,
}: {
  tokens: Tokens;
  componentProps: Record<string, unknown>;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label}`);
    } catch {
      setStatus("Copy failed");
    }
  };

  const save = async () => {
    setStatus("Saving…");
    try {
      const res = await fetch("/api/playground/save-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary: tokens.primary,
          surface: tokens.surface,
          surface2: tokens.surface2,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        setStatus(`Save failed (${res.status}): ${body.slice(0, 80)}`);
        return;
      }
      setStatus("Saved to globals.css — will hot-reload");
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  return (
    <section className="space-y-3 p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Export
      </h3>
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary uppercase tracking-[0.16em]"
          onClick={() => copy(tokensToCss(tokens), "CSS")}
        >
          Copy CSS
        </Button>
        <Button
          size="sm"
          className="w-full glow-primary uppercase tracking-[0.16em]"
          onClick={save}
        >
          Save to globals.css
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full uppercase tracking-[0.16em]"
          onClick={() =>
            copy(
              JSON.stringify(componentProps, null, 2),
              "props",
            )
          }
        >
          Copy props
        </Button>
      </div>
      {status && (
        <p className="text-[11px] text-muted-foreground">{status}</p>
      )}
    </section>
  );
}
