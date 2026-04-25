"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ROSTER, type RosterMember } from "@/lib/config";

const STORAGE_KEY = "omgg.viewerId";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function readId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {}
  emit();
}

const rosterById = new Map(ROSTER.map((p) => [p.id, p]));

export function useViewer(): {
  viewer: RosterMember | null;
  ready: boolean;
  setViewer: (id: string | null) => void;
} {
  const id = useSyncExternalStore(subscribe, readId, () => null);
  const viewer = id ? rosterById.get(id) ?? null : null;

  const setViewer = useCallback((next: string | null) => writeId(next), []);

  return {
    viewer,
    ready: typeof window !== "undefined",
    setViewer,
  };
}
