"use client";

import type { Tokens } from "./types";

export function TokenPanel({
  tokens,
  onChange,
  onReset,
}: {
  tokens: Tokens;
  onChange: (next: Tokens) => void;
  onReset: () => void;
}) {
  return (
    <section className="space-y-3 border-b border-white/5 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Global Tokens
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary hover:text-primary/80"
        >
          Reset
        </button>
      </div>

      <ColorRow
        label="--primary"
        value={tokens.primary}
        onChange={(v) => onChange({ ...tokens, primary: v })}
      />
      <ColorRow
        label="--surface"
        value={tokens.surface}
        onChange={(v) => onChange({ ...tokens, surface: v })}
      />
      <ColorRow
        label="--surface-2"
        value={tokens.surface2}
        onChange={(v) => onChange({ ...tokens, surface2: v })}
      />

      <label className="flex cursor-pointer items-center justify-between gap-3 border border-white/5 bg-card/40 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Display font
        </span>
        <input
          type="checkbox"
          checked={tokens.fontDisplay}
          onChange={(e) =>
            onChange({ ...tokens, fontDisplay: e.currentTarget.checked })
          }
          className="size-4 accent-primary"
        />
      </label>
    </section>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border border-white/5 bg-card/40 px-2.5 py-1.5">
      <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-24 bg-transparent font-mono text-xs text-foreground focus:outline-none"
      />
      <input
        type="color"
        value={normalizeHex(value)}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="size-7 cursor-pointer border border-white/10 bg-transparent"
      />
    </div>
  );
}

function normalizeHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}
