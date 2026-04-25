"use client";

import { cn } from "@/lib/utils";
import type { Control } from "./types";

export function ControlInput({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const id = `pg-control-${control.key}`;
  const labelEl = (
    <label
      htmlFor={id}
      className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
    >
      {control.label}
    </label>
  );

  if (control.type === "text") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <input
          id={id}
          type="text"
          value={(value as string) ?? ""}
          placeholder={control.placeholder}
          onChange={(e) => onChange(e.currentTarget.value)}
          className={cn(
            "w-full border border-white/10 bg-card/40 px-2.5 py-1.5 text-sm text-foreground",
            "focus:border-primary/50 focus:outline-none",
          )}
        />
      </div>
    );
  }

  if (control.type === "number") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <input
          id={id}
          type="number"
          value={Number(value ?? 0)}
          min={control.min}
          max={control.max}
          step={control.step ?? 1}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          className={cn(
            "w-full border border-white/10 bg-card/40 px-2.5 py-1.5 text-sm tabular-nums text-foreground",
            "focus:border-primary/50 focus:outline-none",
          )}
        />
      </div>
    );
  }

  if (control.type === "select") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
          className={cn(
            "w-full border border-white/10 bg-card/40 px-2.5 py-1.5 text-sm text-foreground",
            "focus:border-primary/50 focus:outline-none",
          )}
        >
          {control.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (control.type === "boolean") {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-between gap-3 border border-white/5 bg-card/40 px-2.5 py-1.5"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {control.label}
        </span>
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.currentTarget.checked)}
          className="size-4 accent-primary"
        />
      </label>
    );
  }

  if (control.type === "slider") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          {labelEl}
          <span className="font-display text-xs font-semibold tabular-nums text-foreground">
            {Number(value ?? 0)}
          </span>
        </div>
        <input
          id={id}
          type="range"
          value={Number(value ?? 0)}
          min={control.min}
          max={control.max}
          step={control.step ?? 1}
          onChange={(e) => onChange(Number(e.currentTarget.value))}
          className="w-full accent-primary"
        />
      </div>
    );
  }

  return null;
}
