"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { ComponentPicker } from "@/components/playground/component-picker";
import { Stage } from "@/components/playground/stage";
import { TokenPanel } from "@/components/playground/token-panel";
import { PropertyPanel } from "@/components/playground/property-panel";
import { ExportPanel } from "@/components/playground/export-panel";
import { REGISTRY } from "@/components/playground/registry";
import { DEFAULT_TOKENS, type Tokens } from "@/components/playground/types";

export default function PlaygroundPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [selectedId, setSelectedId] = useState<string>(REGISTRY[0].id);
  const [tokens, setTokens] = useState<Tokens>(DEFAULT_TOKENS);
  const [propsById, setPropsById] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [lastAction, setLastAction] = useState<string | null>(null);

  const entry = REGISTRY.find((e) => e.id === selectedId) ?? REGISTRY[0];
  const props = propsById[entry.id] ?? entry.defaultProps;

  const updateProp = (key: string, value: unknown) => {
    setPropsById((prev) => ({
      ...prev,
      [entry.id]: { ...(prev[entry.id] ?? entry.defaultProps), [key]: value },
    }));
  };

  const resetEntry = () => {
    setPropsById((prev) => {
      const next = { ...prev };
      delete next[entry.id];
      return next;
    });
  };

  const resetTokens = () => setTokens(DEFAULT_TOKENS);

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <ComponentPicker
        entries={REGISTRY}
        selectedId={entry.id}
        onSelect={(id) => {
          setSelectedId(id);
          setLastAction(null);
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-baseline justify-between border-b border-white/5 bg-card/40 px-6 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Stage
            </div>
            <h1 className="mt-0.5 font-display text-lg font-bold uppercase tracking-[0.08em] text-foreground">
              {entry.label}
            </h1>
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {entry.group}
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <Stage
            tokens={tokens}
            lastAction={lastAction}
            fullBleed={entry.fullBleed}
          >
            {entry.render(props, { notify: setLastAction })}
          </Stage>
        </div>
      </main>

      <aside className="flex h-full w-[22rem] shrink-0 flex-col overflow-y-auto border-l border-white/5 bg-card/60">
        <TokenPanel
          tokens={tokens}
          onChange={setTokens}
          onReset={resetTokens}
        />
        <PropertyPanel
          componentLabel={entry.label}
          controls={entry.controls}
          values={props}
          onChange={updateProp}
          onReset={resetEntry}
        />
        <ExportPanel tokens={tokens} componentProps={props} />
      </aside>
    </div>
  );
}
