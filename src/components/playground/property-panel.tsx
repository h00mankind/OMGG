"use client";

import { ControlInput } from "./control-input";
import type { Control } from "./types";

export function PropertyPanel({
  controls,
  values,
  onChange,
  onReset,
  componentLabel,
}: {
  controls: Control[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
  componentLabel: string;
}) {
  return (
    <section className="space-y-3 border-b border-white/5 p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Component Props
          </h3>
          <p className="mt-0.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
            {componentLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary hover:text-primary/80"
        >
          Reset
        </button>
      </div>

      {controls.length === 0 ? (
        <p className="text-xs text-muted-foreground">No props to tweak.</p>
      ) : (
        <div className="space-y-3">
          {controls.map((c) => (
            <ControlInput
              key={c.key}
              control={c}
              value={values[c.key]}
              onChange={(v) => onChange(c.key, v)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
