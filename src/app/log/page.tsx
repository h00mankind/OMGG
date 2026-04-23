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
import { BorderBeam } from "border-beam";
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
const ROSTER_BY_ID = new Map(ROSTER.map((p) => [p.id, p]));
const emptyTitles = (): Record<TitleKey, string | null> => ({
  mvp: null,
  svp: null,
  gg: null,
});
const emptyStatuses = (): Record<string, WlStatus> =>
  Object.fromEntries(ROSTER.map((p) => [p.id, "off" as WlStatus]));

type Phase = "idle" | "uploading" | "review" | "confirm" | "success";
type ConfirmOrigin = "manual" | "scan";

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LogPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [confirmOrigin, setConfirmOrigin] = useState<ConfirmOrigin | null>(null);
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
    setConfirmOrigin(null);
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
        if (json?.reason) console.error("[analyze-match] reason:", json.reason);
        if (json?.raw) console.error("[analyze-match] raw:", json.raw);
        const detail = json?.reason ? ` — ${json.reason}` : "";
        throw new Error((json?.error || `Request failed (${res.status})`) + detail);
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
        players: prev.players.map((p) => {
          if (p.slot === slot) return { ...p, rosterId };
          if (rosterId && p.rosterId === rosterId) return { ...p, rosterId: null };
          return p;
        }),
        titles: prev.titles.map((t) =>
          targetName && normalizeName(t.displayName) === targetName
            ? { ...t, rosterId }
            : t
        ),
      };
    });
    setScanSelection((prev) => {
      const next = { ...prev, [slot]: rosterId !== null };
      if (rosterId) {
        const prevScan = scan;
        if (prevScan) {
          for (const p of prevScan.players) {
            if (p.slot !== slot && p.rosterId === rosterId) next[p.slot] = false;
          }
        }
      }
      return next;
    });
  };

  const addTitleToPlayer = (slot: number, key: TitleKey) => {
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

  const setScanWinningSide = (winningSide: "radiant" | "dire") => {
    setScan((prev) => {
      if (!prev || prev.winningSide === winningSide) return prev;
      return {
        ...prev,
        winningSide,
        players: prev.players.map((player) => ({
          ...player,
          won: player.side === winningSide,
        })),
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
    setConfirmOrigin(null);
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
    setConfirmOrigin(null);
    setPhase("success");
    setTimeout(resetAll, 900);
  };

  const goToConfirmManual = () => {
    if (!canLogManual) return;
    setError(null);
    setConfirmOrigin("manual");
    setPhase("confirm");
  };

  const goToConfirmScan = () => {
    if (!scan || scanSelectedCount === 0) return;
    setError(null);
    setConfirmOrigin("scan");
    setPhase("confirm");
  };

  const backFromConfirm = () => {
    const previousPhase = confirmOrigin === "scan" && scan ? "review" : "idle";
    setConfirmOrigin(null);
    setPhase(previousPhase);
  };

  const handleConfirmLog = () => {
    if (confirmOrigin === "scan") {
      handleLogScan();
      return;
    }
    if (confirmOrigin === "manual") {
      handleLogManual();
    }
  };

  const showManualForm = phase === "idle";
  const showScan = phase === "review" && scan;
  const confirmData: ConfirmData | null =
    phase !== "confirm"
      ? null
      : confirmOrigin === "manual"
        ? {
            mode: "manual",
            wonPlayerIds: manualWonIds,
            lostPlayerIds: manualLostIds,
            titles,
          }
        : confirmOrigin === "scan" && scan
          ? {
              mode: "scan",
              scan,
              selection: scanSelection,
              imageUrl: scanImageUrl,
            }
          : null;
  const canConfirmLog =
    confirmOrigin === "manual"
      ? canLogManual
      : confirmOrigin === "scan"
        ? !!scan && scanSelectedCount > 0
        : false;

  return (
    <div className="mx-auto max-w-2xl px-8 pt-4 pb-32 space-y-5">
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
        <BorderBeam size="md" colorVariant="ocean" duration={1.96} strength={0.8} borderRadius={0}>
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">
                Analyzing screenshot…
              </span>
            </CardContent>
          </Card>
        </BorderBeam>
      )}

      {showScan && (
        <ScanReview
          scan={scan}
          imageUrl={scanImageUrl}
          selection={scanSelection}
          toggle={toggleScanRow}
          onSetWinningSide={setScanWinningSide}
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
        />
      )}

      {confirmData && <ConfirmSummary data={confirmData} />}

      {/* Sticky action bar */}
      <div className="sticky bottom-28 -mx-8 px-8 z-30 will-change-transform">
        {/* Progressive blur fade above the action bar */}
        <div aria-hidden className="pointer-events-none h-8 bg-linear-to-b from-transparent to-background/85" />
        <div className="pb-3 bg-background/85 backdrop-blur-md">
        {phase === "idle" && (
          <Button
            size="lg"
            className="w-full"
            disabled={!canLogManual}
            onClick={goToConfirmManual}
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
              onClick={goToConfirmScan}
            >
              Log match ({scanSelectedCount} player{scanSelectedCount === 1 ? "" : "s"})
            </Button>
          </div>
        )}
        {phase === "confirm" && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" className="w-full sm:w-auto" onClick={backFromConfirm}>
              Back
            </Button>
            <Button
              className="w-full sm:flex-1"
              disabled={!canConfirmLog}
              onClick={handleConfirmLog}
            >
              Confirm & log
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Manual entry                                                       */
/* ------------------------------------------------------------------ */

const MANUAL_TITLE_LABELS: Record<TitleKey, string> = {
  mvp: "MVP",
  svp: "SVP",
  gg: "GG",
};

type ConfirmData =
  | {
      mode: "manual";
      wonPlayerIds: string[];
      lostPlayerIds: string[];
      titles: Record<TitleKey, string | null>;
    }
  | {
      mode: "scan";
      scan: ExtractedMatch;
      selection: Record<number, boolean>;
      imageUrl: string | null;
    };

type ConfirmTitleItem = {
  key: string;
  label: string;
  playerName: string;
};

function rosterNameFor(playerId: string, fallback = "Unknown"): string {
  return ROSTER_BY_ID.get(playerId)?.name ?? fallback;
}

function selectedScanNames(
  data: Extract<ConfirmData, { mode: "scan" }>,
  won: boolean
): string[] {
  return data.scan.players.flatMap((p) => {
    if (!p.rosterId || !data.selection[p.slot] || p.won !== won) return [];
    return [rosterNameFor(p.rosterId, p.displayName)];
  });
}

function ConfirmRosterSection({
  title,
  names,
  tone,
}: {
  title: string;
  names: string[];
  tone: "win" | "loss";
}) {
  const toneClass =
    tone === "win"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-red-500/30 bg-red-500/10 text-red-300";

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {names.map((name, index) => (
            <span
              key={`${name}:${index}`}
              className={cn("rounded-md border px-2 py-1 text-xs font-medium", toneClass)}
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No players selected.</p>
      )}
    </section>
  );
}

function ConfirmSummary({ data }: { data: ConfirmData }) {
  const winners =
    data.mode === "manual"
      ? data.wonPlayerIds.map((id) => rosterNameFor(id))
      : selectedScanNames(data, true);
  const losers =
    data.mode === "manual"
      ? data.lostPlayerIds.map((id) => rosterNameFor(id))
      : selectedScanNames(data, false);
  const titleItems: ConfirmTitleItem[] =
    data.mode === "manual"
      ? TITLE_ORDER.flatMap((key) => {
          const playerId = data.titles[key];
          if (!playerId) return [];
          return [
            {
              key,
              label: MANUAL_TITLE_LABELS[key],
              playerName: rosterNameFor(playerId),
            },
          ];
        })
      : data.scan.titles.map((title) => ({
          key: title.key,
          label: TITLE_LABELS[title.key] ?? title.label,
          playerName: title.rosterId
            ? rosterNameFor(title.rosterId, title.displayName)
            : title.displayName,
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review match</CardTitle>
        <p className="text-xs text-muted-foreground">
          Confirm to log. This can&apos;t be edited or deleted after.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.mode === "scan" && (
          <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Result
                </div>
                <div className="mt-0.5 text-foreground">
                  {data.scan.winningSide === "radiant" ? "Radiant" : "Dire"} won
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Duration
                </div>
                <div className="mt-0.5 text-foreground">
                  {formatDuration(data.scan.durationSeconds)}
                </div>
              </div>
            </div>
            {data.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt="Screenshot preview"
                className="max-h-44 w-full rounded-md border border-border object-cover"
              />
            )}
          </section>
        )}

        <ConfirmRosterSection title="Winners" names={winners} tone="win" />
        <ConfirmRosterSection title="Losers" names={losers} tone="loss" />

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Titles
          </h3>
          {titleItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {titleItems.map((item) => (
                <Badge
                  key={`${item.key}:${item.playerName}`}
                  className={cn("border text-[11px]", titleBadgeClass(item.key))}
                >
                  {item.label} — {item.playerName}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No titles assigned.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function AddManualTitleSelect({
  options,
  onAdd,
}: {
  options: TitleKey[];
  onAdd: (key: TitleKey) => void;
}) {
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value as TitleKey;
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
      {options.map((k) => (
        <option key={k} value={k}>
          {MANUAL_TITLE_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

function ManualEntry({
  statuses,
  onCycle,
  titles,
  setTitles,
}: {
  statuses: Record<string, WlStatus>;
  onCycle: (playerId: string) => void;
  titles: Record<TitleKey, string | null>;
  setTitles: React.Dispatch<React.SetStateAction<Record<TitleKey, string | null>>>;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        Who played?{" "}
        <span className="text-foreground/60">Tap to cycle W → L → off</span>
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {ROSTER.map((player) => {
          const status = statuses[player.id] ?? "off";
          const active = status !== "off";

          // At most one title per player
          const playerTitle =
            TITLE_ORDER.find((k) => titles[k] === player.id) ?? null;

          // Available titles only when player has none yet
          const availableTitles =
            playerTitle === null
              ? TITLE_ORDER.filter((k) => {
                  if (titles[k] !== null) return false;
                  if (k === "mvp") return status === "win";
                  return status === "loss";
                })
              : [];

          return (
            <div
              key={player.id}
              role="button"
              tabIndex={0}
              onClick={() => onCycle(player.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onCycle(player.id);
              }}
              className={cn(
                "rounded-lg border transition-colors px-3 py-2.5 flex items-center gap-2 cursor-pointer select-none",
                status === "win" && "border-emerald-500/60 bg-emerald-500/10",
                status === "loss" && "border-red-500/60 bg-red-500/10",
                status === "off" && "border-border hover:bg-muted/40"
              )}
            >
              <Avatar className="h-7 w-7 shrink-0">
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
                  "flex-1 text-sm font-medium truncate min-w-0",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {player.name}
              </span>
              {/* Title control — left of status pill, stops cycle propagation */}
              {active && playerTitle !== null && (
                <Badge
                  className={cn(
                    "text-[10px] shrink-0 flex items-center gap-0.5",
                    titleBadgeClass(playerTitle)
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {MANUAL_TITLE_LABELS[playerTitle]}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTitles((prev) => ({ ...prev, [playerTitle]: null }));
                    }}
                    aria-label={`Remove ${MANUAL_TITLE_LABELS[playerTitle]}`}
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              )}
              {active && playerTitle === null && availableTitles.length > 0 && (
                <AddManualTitleSelect
                  options={availableTitles}
                  onAdd={(key) =>
                    setTitles((prev) => ({ ...prev, [key]: player.id }))
                  }
                />
              )}
              <StatusPill status={status} />
            </div>
          );
        })}
      </div>
    </section>
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

/* ------------------------------------------------------------------ */
/*  Scan review (AI flow)                                              */
/* ------------------------------------------------------------------ */

function titleBadgeClass(key: string): string {
  if (key === "mvp") return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  if (key === "svp") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  // gg → white/zinc
  return "bg-zinc-100/10 text-zinc-200 border-zinc-400/30";
}

function AddTitleSelect({
  options,
  onAdd,
}: {
  options: TitleKey[];
  onAdd: (key: TitleKey) => void;
}) {
  if (options.length === 0) return null;

  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value as TitleKey;
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
      {options.map((k) => (
        <option key={k} value={k}>
          {TITLE_LABELS[k]}
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
  onSetWinningSide,
  onReassignPlayer,
  onAddTitle,
  onRemoveTitle,
  onBack,
}: {
  scan: ExtractedMatch;
  imageUrl: string | null;
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
  onSetWinningSide: (winningSide: "radiant" | "dire") => void;
  onReassignPlayer: (slot: number, rosterId: string | null) => void;
  onAddTitle: (slot: number, key: TitleKey) => void;
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

  const takenTitleKeys = useMemo(() => {
    const set = new Set<TitleKey>();
    scan.titles.forEach((t) => {
      if (TITLE_ORDER.includes(t.key as TitleKey)) {
        set.add(t.key as TitleKey);
      }
    });
    return set;
  }, [scan.titles]);

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
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Result
          </span>
          <div className="flex border border-border overflow-hidden">
            {(["radiant", "dire"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => onSetWinningSide(side)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  scan.winningSide === side
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {side === "radiant" ? "Radiant Won" : "Dire Won"}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            Use this if OCR picked the wrong winner.
          </span>
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
          takenTitleKeys={takenTitleKeys}
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
          takenTitleKeys={takenTitleKeys}
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
                  className={cn("text-xs flex items-center gap-1", titleBadgeClass(t.key))}
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
  takenTitleKeys,
  won,
}: {
  label: string;
  players: ExtractedMatch["players"];
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
  onReassign: (slot: number, rosterId: string | null) => void;
  onAddTitle: (slot: number, key: TitleKey) => void;
  onRemoveTitle: (index: number) => void;
  titlesByName: Map<string, IndexedTitle[]>;
  takenTitleKeys: Set<TitleKey>;
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
          const availableTitles = TITLE_ORDER.filter((key) => {
            if (takenTitleKeys.has(key)) return false;
            if (key === "mvp") return p.won;
            return !p.won;
          });
          return (
            <div
              key={p.slot}
              className={cn(
                "w-full rounded-md border px-3 py-2 flex items-center gap-3 transition-colors",
                !isRoster && "border-border/50 bg-muted/20",
                isRoster && p.won && selected && "border-emerald-500/60 bg-emerald-500/10",
                isRoster && p.won && !selected && "border-emerald-500/30 bg-emerald-500/5",
                isRoster && !p.won && selected && "border-red-500/60 bg-red-500/10",
                isRoster && !p.won && !selected && "border-red-500/30 bg-red-500/5"
              )}
            >
              <button
                type="button"
                disabled={!isRoster}
                onClick={() => toggle(p.slot)}
                aria-label={selected ? "Unselect" : "Select"}
                className={cn(
                  "size-4 rounded border flex items-center justify-center shrink-0",
                  selected && p.won && "bg-emerald-500 border-emerald-500 text-white",
                  selected && !p.won && "bg-red-500 border-red-500 text-white",
                  !selected && "border-muted-foreground/40",
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
                      className={cn("text-[10px] flex items-center gap-1", titleBadgeClass(t.key))}
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
                  {availableTitles.length > 0 && (
                    <AddTitleSelect
                      options={availableTitles}
                      onAdd={(key) => onAddTitle(p.slot, key)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
