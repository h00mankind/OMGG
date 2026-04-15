"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import { ROSTER } from "@/lib/config";
import { logManualMatch, logMatchFromScan } from "@/lib/log-entries";
import { TITLE_LABELS, type ExtractedMatch } from "@/lib/dota-ocr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Check,
  Camera,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  AI daily quota (client-only)                                       */
/* ------------------------------------------------------------------ */

const AI_DAILY_LIMIT = 15;
const AI_STORAGE_KEY = "omgg:ai-uses-v1";

type QuotaRecord = { date: string; count: number };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadQuota(): QuotaRecord {
  if (typeof window === "undefined") return { date: "", count: 0 };
  try {
    const raw = window.localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return { date: "", count: 0 };
    const p = JSON.parse(raw);
    if (p && typeof p.date === "string" && typeof p.count === "number") return p;
  } catch {}
  return { date: "", count: 0 };
}

const quotaListeners = new Set<() => void>();

function subscribeToQuota(cb: () => void): () => void {
  quotaListeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    quotaListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function saveQuota(q: QuotaRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(q));
  quotaListeners.forEach((cb) => cb());
}

// Memoized snapshot so useSyncExternalStore gets a stable reference when value didn't change.
let cachedRemaining = AI_DAILY_LIMIT;
let cachedRaw: string | null = null;
function computeRemaining(): number {
  if (typeof window === "undefined") return AI_DAILY_LIMIT;
  const raw = window.localStorage.getItem(AI_STORAGE_KEY);
  if (raw === cachedRaw) return cachedRemaining;
  cachedRaw = raw;
  const s = loadQuota();
  const today = todayKey();
  const used = s.date === today ? s.count : 0;
  cachedRemaining = Math.max(0, AI_DAILY_LIMIT - used);
  return cachedRemaining;
}

function useAiQuota() {
  const remaining = useSyncExternalStore(
    subscribeToQuota,
    computeRemaining,
    () => AI_DAILY_LIMIT
  );
  const consume = useCallback(() => {
    const today = todayKey();
    const s = loadQuota();
    const next: QuotaRecord =
      s.date === today
        ? { date: today, count: s.count + 1 }
        : { date: today, count: 1 };
    saveQuota(next);
  }, []);
  return { remaining, consume };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type WlStatus = "off" | "win" | "loss";
type TitleKey = "gg" | "mvp" | "svp";

const TITLE_ORDER: TitleKey[] = ["mvp", "svp", "gg"];
const emptyTitles = (): Record<TitleKey, string | null> => ({
  mvp: null,
  svp: null,
  gg: null,
});
const emptyStatuses = (): Record<string, WlStatus> =>
  Object.fromEntries(ROSTER.map((p) => [p.id, "off" as WlStatus]));

type Phase = "idle" | "uploading" | "review" | "success";

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LogPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const { remaining: aiRemaining, consume: consumeAi } = useAiQuota();

  // Manual form state
  const [statuses, setStatuses] = useState<Record<string, WlStatus>>(
    emptyStatuses
  );
  const [titles, setTitles] = useState<Record<TitleKey, string | null>>(
    emptyTitles
  );

  // AI scan state
  const [scan, setScan] = useState<ExtractedMatch | null>(null);
  const [scanSelection, setScanSelection] = useState<Record<number, boolean>>({});
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cycleStatus = useCallback((playerId: string) => {
    setStatuses((prev) => {
      const cur = prev[playerId] ?? "off";
      const next: WlStatus =
        cur === "off" ? "win" : cur === "win" ? "loss" : "off";
      // If the player is leaving the match, drop any title pointing to them.
      if (next === "off") {
        setTitles((t) => {
          let changed = false;
          const out = { ...t };
          for (const k of TITLE_ORDER) {
            if (out[k] === playerId) {
              out[k] = null;
              changed = true;
            }
          }
          return changed ? out : t;
        });
      } else if (cur === "win" && next === "loss") {
        // moving from winners → losers invalidates MVP if pointed at this player
        setTitles((t) => (t.mvp === playerId ? { ...t, mvp: null } : t));
      }
      return { ...prev, [playerId]: next };
    });
  }, []);

  const resetAll = useCallback(() => {
    setPhase("idle");
    setError(null);
    setStatuses(emptyStatuses());
    setTitles(emptyTitles());
    setScan(null);
    setScanSelection({});
    setScanImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const manualWonIds = useMemo(
    () => ROSTER.filter((p) => statuses[p.id] === "win").map((p) => p.id),
    [statuses]
  );
  const manualLostIds = useMemo(
    () => ROSTER.filter((p) => statuses[p.id] === "loss").map((p) => p.id),
    [statuses]
  );
  const manualTotal = manualWonIds.length + manualLostIds.length;
  const canLogManual = manualTotal > 0;

  const titleCandidates = useMemo(() => {
    const winners = manualWonIds
      .map((id) => ROSTER.find((r) => r.id === id)!)
      .filter(Boolean);
    const losers = manualLostIds
      .map((id) => ROSTER.find((r) => r.id === id)!)
      .filter(Boolean);
    return { winners, losers };
  }, [manualWonIds, manualLostIds]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (aiRemaining <= 0) {
      setError(`Daily AI limit reached (${AI_DAILY_LIMIT}). Use manual entry below.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPhase("uploading");
    setError(null);
    setScanImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/analyze-match", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.match) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      const m = json.match as ExtractedMatch;
      const seed: Record<number, boolean> = {};
      for (const p of m.players) seed[p.slot] = p.rosterId !== null;
      setScan(m);
      setScanSelection(seed);
      consumeAi();
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
      setPhase("idle");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleScanRow = (slot: number) =>
    setScanSelection((prev) => ({ ...prev, [slot]: !prev[slot] }));

  const setScanPlayerRoster = (slot: number, rosterId: string | null) => {
    setScan((prev) => {
      if (!prev) return prev;
      const target = prev.players.find((p) => p.slot === slot);
      const targetName = target ? normalizeName(target.displayName) : "";
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.slot === slot ? { ...p, rosterId } : p
        ),
        titles: prev.titles.map((t) =>
          targetName && normalizeName(t.displayName) === targetName
            ? { ...t, rosterId }
            : t
        ),
      };
    });
    setScanSelection((prev) => ({ ...prev, [slot]: rosterId !== null }));
  };

  const addTitleToPlayer = (slot: number, key: string) => {
    setScan((prev) => {
      if (!prev) return prev;
      const player = prev.players.find((p) => p.slot === slot);
      if (!player) return prev;
      const label = TITLE_LABELS[key];
      if (!label) return prev;
      return {
        ...prev,
        titles: [
          ...prev.titles,
          {
            key,
            label,
            displayName: player.displayName,
            rosterId: player.rosterId,
          },
        ],
      };
    });
  };

  const removeTitleAt = (index: number) => {
    setScan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        titles: prev.titles.filter((_, i) => i !== index),
      };
    });
  };

  const scanSelectedCount = useMemo(
    () =>
      scan
        ? scan.players.filter((p) => p.rosterId && scanSelection[p.slot]).length
        : 0,
    [scan, scanSelection]
  );

  const handleLogScan = () => {
    if (!scan || scanSelectedCount === 0) return;
    logMatchFromScan(scan, scanSelection);
    setPhase("success");
    setTimeout(resetAll, 900);
  };

  const handleLogManual = () => {
    if (!canLogManual) return;
    logManualMatch({
      wonPlayerIds: manualWonIds,
      lostPlayerIds: manualLostIds,
      titles,
    });
    setPhase("success");
    setTimeout(resetAll, 900);
  };

  const showManualForm = phase === "idle";
  const showScan = phase === "review" && scan;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-32 space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* AI upload — always available unless review/uploading */}
      {phase === "idle" && (
        <section className="space-y-1.5">
          <div className="flex items-stretch gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={aiRemaining <= 0}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              Scan screenshot
            </Button>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 text-xs",
                aiRemaining > 0
                  ? "border-border text-muted-foreground"
                  : "border-red-500/30 text-red-500"
              )}
              title={`AI uses today: ${AI_DAILY_LIMIT - aiRemaining}/${AI_DAILY_LIMIT}`}
            >
              <Sparkles className="size-3.5" aria-hidden />
              <span className="tabular-nums">
                {aiRemaining}/{AI_DAILY_LIMIT}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-extract players and titles from a post-match screenshot.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </section>
      )}

      {phase === "uploading" && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">
              Analyzing screenshot…
            </span>
          </CardContent>
        </Card>
      )}

      {showScan && (
        <ScanReview
          scan={scan}
          imageUrl={scanImageUrl}
          selection={scanSelection}
          toggle={toggleScanRow}
          onReassignPlayer={setScanPlayerRoster}
          onAddTitle={addTitleToPlayer}
          onRemoveTitle={removeTitleAt}
          onBack={resetAll}
        />
      )}

      {showManualForm && (
        <ManualEntry
          statuses={statuses}
          onCycle={cycleStatus}
          titles={titles}
          setTitles={setTitles}
          candidates={titleCandidates}
        />
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-28 pt-2 -mx-4 px-4 z-30 bg-background/85 backdrop-blur-md">
        {phase === "idle" && (
          <Button
            size="lg"
            className="w-full"
            disabled={!canLogManual}
            onClick={handleLogManual}
          >
            {canLogManual
              ? `Log match · ${manualWonIds.length}W / ${manualLostIds.length}L`
              : "Pick players to log a match"}
          </Button>
        )}
        {showScan && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" className="w-full sm:w-auto" onClick={resetAll}>
              Discard
            </Button>
            <Button
              className="w-full sm:flex-1"
              disabled={scanSelectedCount === 0}
              onClick={handleLogScan}
            >
              Log match ({scanSelectedCount} player{scanSelectedCount === 1 ? "" : "s"})
            </Button>
          </div>
        )}
        {phase === "success" && (
          <Button
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-600"
            disabled
          >
            <Check className="size-5" aria-hidden />
            Logged!
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Manual entry                                                       */
/* ------------------------------------------------------------------ */

function ManualEntry({
  statuses,
  onCycle,
  titles,
  setTitles,
  candidates,
}: {
  statuses: Record<string, WlStatus>;
  onCycle: (playerId: string) => void;
  titles: Record<TitleKey, string | null>;
  setTitles: React.Dispatch<React.SetStateAction<Record<TitleKey, string | null>>>;
  candidates: {
    winners: { id: string; name: string }[];
    losers: { id: string; name: string }[];
  };
}) {
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Who played?{" "}
          <span className="text-foreground/60">Tap to cycle W → L → off</span>
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {ROSTER.map((player) => {
            const status = statuses[player.id] ?? "off";
            const active = status !== "off";
            return (
              <button
                type="button"
                key={player.id}
                onClick={() => onCycle(player.id)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-colors",
                  status === "win" &&
                    "border-emerald-500/60 bg-emerald-500/10",
                  status === "loss" &&
                    "border-red-500/60 bg-red-500/10",
                  status === "off" && "border-border hover:bg-muted/40"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      status === "win" && "bg-emerald-500 text-white",
                      status === "loss" && "bg-red-500 text-white"
                    )}
                  >
                    {initials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "flex-1 text-sm font-medium truncate",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {player.name}
                </span>
                <StatusPill status={status} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Titles <span className="text-foreground/60">(optional)</span>
        </h2>
        <div className="grid grid-cols-1 gap-2">
          <TitleRow
            label="MVP"
            hint="best winner"
            value={titles.mvp}
            options={candidates.winners}
            onChange={(id) =>
              setTitles((prev) => ({ ...prev, mvp: id }))
            }
          />
          <TitleRow
            label="SVP"
            hint="best loser"
            value={titles.svp}
            options={candidates.losers}
            onChange={(id) =>
              setTitles((prev) => ({ ...prev, svp: id }))
            }
          />
          <TitleRow
            label="GG"
            hint="worst loser"
            value={titles.gg}
            options={candidates.losers}
            onChange={(id) =>
              setTitles((prev) => ({ ...prev, gg: id }))
            }
          />
        </div>
      </section>
    </>
  );
}

function StatusPill({ status }: { status: WlStatus }) {
  if (status === "win") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        W
      </Badge>
    );
  }
  if (status === "loss") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border border-red-500/40">
        L
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      —
    </Badge>
  );
}

function TitleRow({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (id: string | null) => void;
}) {
  const disabled = options.length === 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
        disabled && "opacity-60"
      )}
    >
      <div className="min-w-16">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      </div>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          disabled && "cursor-not-allowed"
        )}
      >
        <option value="">
          {disabled ? "— no players —" : "— none —"}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scan review (AI flow)                                              */
/* ------------------------------------------------------------------ */

function AddTitleSelect({ onAdd }: { onAdd: (key: string) => void }) {
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value;
        if (v) onAdd(v);
        e.currentTarget.value = "";
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded border border-dashed border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground",
        "hover:text-foreground focus:outline-none"
      )}
    >
      <option value="">+ title</option>
      {Object.entries(TITLE_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function RosterSelect({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (rosterId: string | null) => void;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "rounded border border-border bg-background px-2 py-1 text-xs",
        "focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
    >
      <option value="">— none —</option>
      {ROSTER.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

type IndexedTitle = { title: ExtractedMatch["titles"][number]; index: number };

function ScanReview({
  scan,
  imageUrl,
  selection,
  toggle,
  onReassignPlayer,
  onAddTitle,
  onRemoveTitle,
  onBack,
}: {
  scan: ExtractedMatch;
  imageUrl: string | null;
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
  onReassignPlayer: (slot: number, rosterId: string | null) => void;
  onAddTitle: (slot: number, key: string) => void;
  onRemoveTitle: (index: number) => void;
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const byId = [...scan.players].sort((a, b) => a.slot - b.slot);
    return {
      radiant: byId.filter((p) => p.side === "radiant"),
      dire: byId.filter((p) => p.side === "dire"),
    };
  }, [scan]);

  const titlesByName = useMemo(() => {
    const map = new Map<string, IndexedTitle[]>();
    scan.titles.forEach((t, index) => {
      const key = normalizeName(t.displayName);
      const list = map.get(key) ?? [];
      list.push({ title: t, index });
      map.set(key, list);
    });
    return map;
  }, [scan.titles]);

  const unmatchedTitles = useMemo(() => {
    const playerNames = new Set(
      scan.players.map((p) => normalizeName(p.displayName))
    );
    const out: IndexedTitle[] = [];
    scan.titles.forEach((t, index) => {
      if (!playerNames.has(normalizeName(t.displayName))) {
        out.push({ title: t, index });
      }
    });
    return out;
  }, [scan]);

  const winLabel = scan.winningSide === "radiant" ? "Radiant Wins" : "Dire Wins";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{winLabel}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDuration(scan.durationSeconds)}
              {scan.externalMatchId ? ` · ID ${scan.externalMatchId}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Uploaded screenshot"
            className="w-full rounded-md border border-border"
          />
        )}
        <ScanSideList
          label="Radiant"
          players={grouped.radiant}
          selection={selection}
          toggle={toggle}
          onReassign={onReassignPlayer}
          onAddTitle={onAddTitle}
          onRemoveTitle={onRemoveTitle}
          titlesByName={titlesByName}
          won={scan.winningSide === "radiant"}
        />
        <ScanSideList
          label="Dire"
          players={grouped.dire}
          selection={selection}
          toggle={toggle}
          onReassign={onReassignPlayer}
          onAddTitle={onAddTitle}
          onRemoveTitle={onRemoveTitle}
          titlesByName={titlesByName}
          won={scan.winningSide === "dire"}
        />
        {unmatchedTitles.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Unmatched titles
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {unmatchedTitles.map(({ title: t, index }) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs flex items-center gap-1"
                >
                  {t.label} · {t.displayName}
                  <button
                    type="button"
                    onClick={() => onRemoveTitle(index)}
                    aria-label="Remove title"
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function ScanSideList({
  label,
  players,
  selection,
  toggle,
  onReassign,
  onAddTitle,
  onRemoveTitle,
  titlesByName,
  won,
}: {
  label: string;
  players: ExtractedMatch["players"];
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
  onReassign: (slot: number, rosterId: string | null) => void;
  onAddTitle: (slot: number, key: string) => void;
  onRemoveTitle: (index: number) => void;
  titlesByName: Map<string, IndexedTitle[]>;
  won: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {won && (
          <Badge variant="secondary" className="text-emerald-500">
            Won
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {players.map((p) => {
          const isRoster = p.rosterId !== null;
          const selected = isRoster && !!selection[p.slot];
          const playerTitles = titlesByName.get(normalizeName(p.displayName)) ?? [];
          return (
            <div
              key={p.slot}
              className={cn(
                "w-full rounded-md border px-3 py-2 flex items-center gap-3 transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : isRoster
                    ? "border-border"
                    : "border-border/50 bg-muted/20"
              )}
            >
              <button
                type="button"
                disabled={!isRoster}
                onClick={() => toggle(p.slot)}
                aria-label={selected ? "Unselect" : "Select"}
                className={cn(
                  "size-4 rounded border flex items-center justify-center shrink-0",
                  selected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                  !isRoster && "opacity-40 cursor-not-allowed"
                )}
              >
                {selected && <Check className="size-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {p.displayName}
                  </span>
                  <RosterSelect
                    value={p.rosterId}
                    onChange={(id) => onReassign(p.slot, id)}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {playerTitles.map(({ title: t, index }) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-[10px] bg-amber-500/15 text-amber-500 border-amber-500/30 flex items-center gap-1"
                    >
                      {t.label}
                      <button
                        type="button"
                        onClick={() => onRemoveTitle(index)}
                        aria-label={`Remove ${t.label}`}
                        className="opacity-60 hover:opacity-100"
                      >
                        <X className="size-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <AddTitleSelect
                    onAdd={(key) => onAddTitle(p.slot, key)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
