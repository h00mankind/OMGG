"use client";

import { cn } from "@/lib/utils";
import type { RegistryEntry } from "./types";

const GROUP_ORDER: RegistryEntry["group"][] = [
  "Cards",
  "Rows",
  "Bits",
  "Sidebar",
  "Primitives",
];

export function ComponentPicker({
  entries,
  selectedId,
  onSelect,
}: {
  entries: RegistryEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const grouped = new Map<RegistryEntry["group"], RegistryEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.group) ?? [];
    list.push(e);
    grouped.set(e.group, list);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/5 bg-card/60">
      <div className="border-b border-white/5 px-5 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Playground
        </div>
        <h2 className="mt-1 font-display text-base font-bold uppercase tracking-[0.08em] text-foreground">
          Components
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {GROUP_ORDER.map((group) => {
          const list = grouped.get(group);
          if (!list || list.length === 0) return null;
          return (
            <section key={group} className="mb-4">
              <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {group}
              </div>
              <ul>
                {list.map((entry) => {
                  const active = entry.id === selectedId;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(entry.id)}
                        className={cn(
                          "block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.15em] transition-colors",
                          active
                            ? "bg-primary/15 text-primary accent-bar-active"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                        )}
                      >
                        {entry.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
