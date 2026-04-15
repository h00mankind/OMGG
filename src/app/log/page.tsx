"use client";

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ROSTER, GROUPS } from "@/lib/config";
import { logGgAndMatchesBatch, logMatchFromScan } from "@/lib/log-entries";
import type { ExtractedMatch } from "@/lib/dota-ocr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Check,
  Camera,
  Loader2,
  Minus,
  Plus,
  Trophy,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LogKind = "gg" | "match";
type LogPhase = "select" | "confirm" | "success" | "scan-uploading" | "scan-review";

const ROSTER_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  ROSTER.map((p) => [p.id, p.name])
);

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const zeroCounts = () =>
  Object.fromEntries(ROSTER.map((p) => [p.id, 0])) as Record<string, number>;

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMatchWord(n: number): string {
  return n === 1 ? "match" : "matches";
}

/* ------------------------------------------------------------------ */
/*  Group chips for quick selection                                    */
/* ------------------------------------------------------------------ */

function GroupChips({
  counts,
  setCounts,
  disabled,
}: {
  counts: Record<string, number>;
  setCounts: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        Quick select
      </h2>
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((group) => {
          const allActive = group.playerIds.every((id) => (counts[id] ?? 0) > 0);
          const noneActive = group.playerIds.every((id) => (counts[id] ?? 0) === 0);
          const isActive = allActive && !noneActive;
          return (
            <Button
              key={group.label}
              variant={isActive ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              onClick={() => {
                setCounts((prev) => {
                  const next = { ...prev };
                  if (isActive) {
                    for (const id of group.playerIds) next[id] = 0;
                  } else {
                    for (const id of group.playerIds) {
                      if ((next[id] ?? 0) === 0) next[id] = 1;
                    }
                  }
                  return next;
                });
              }}
            >
              {group.label}
              <Badge variant={isActive ? "secondary" : "outline"} className="ml-1">
                {group.playerIds.length}
              </Badge>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-player stepper list                                            */
/* ------------------------------------------------------------------ */

function PlayerSteppers({
  label,
  counts,
  bump,
  disabled,
}: {
  label: string;
  counts: Record<string, number>;
  bump: (playerId: string, delta: number) => void;
  disabled: boolean;
}) {
  const activeCount = ROSTER.filter((p) => (counts[p.id] ?? 0) > 0).length;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {label}
        {activeCount > 0 && (
          <span className="ml-1.5 text-foreground">
            ({activeCount} selected)
          </span>
        )}
      </h2>
      <div className="grid grid-cols-1 gap-2">
        {ROSTER.map((player) => {
          const count = counts[player.id] ?? 0;
          const isActive = count > 0;
          return (
            <Card
              key={player.id}
              size="sm"
              className={cn(isActive && "ring-primary ring-2")}
            >
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      {initials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {player.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={disabled || count === 0}
                    onClick={() => bump(player.id, -1)}
                    aria-label={`Decrease for ${player.name}`}
                  >
                    <Minus className="size-4" aria-hidden />
                  </Button>
                  <span className="tabular-nums min-w-8 text-center text-sm font-medium">
                    {count}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={disabled}
                    onClick={() => bump(player.id, 1)}
                    aria-label={`Increase for ${player.name}`}
                  >
                    <Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LogPage() {
  const [kind, setKind] = useState<LogKind>("match");
  const [phase, setPhase] = useState<LogPhase>("select");
  const [matchCounts, setMatchCounts] = useState(zeroCounts);
  const [ggCounts, setGgCounts] = useState(zeroCounts);
  const [scan, setScan] = useState<ExtractedMatch | null>(null);
  const [scanSelection, setScanSelection] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const counts = kind === "match" ? matchCounts : ggCounts;
  const setCounts = kind === "match" ? setMatchCounts : setGgCounts;

  const bump = useCallback(
    (playerId: string, delta: number) => {
      if (phase !== "select") return;
      setCounts((prev) => ({
        ...prev,
        [playerId]: Math.max(0, (prev[playerId] ?? 0) + delta),
      }));
    },
    [phase, setCounts]
  );

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts]
  );

  const canLog = total > 0;

  const summaryItems = useMemo(
    () =>
      ROSTER.filter((p) => (counts[p.id] ?? 0) > 0).map((p) => ({
        name: p.name,
        count: counts[p.id],
      })),
    [counts]
  );

  const activeGroup = useMemo(() => {
    const activeIds = ROSTER.filter((p) => (counts[p.id] ?? 0) > 0).map((p) => p.id);
    if (activeIds.length === 0) return null;
    return (
      GROUPS.find(
        (g) =>
          g.playerIds.length === activeIds.length &&
          g.playerIds.every((id) => activeIds.includes(id))
      ) ?? null
    );
  }, [counts]);

  const resetFlow = useCallback(() => {
    setPhase("select");
    setMatchCounts(zeroCounts());
    setGgCounts(zeroCounts());
    setScan(null);
    setScanSelection({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("scan-uploading");
    const loadingToast = toast.loading("Analyzing screenshot…");
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
      for (const p of m.players) {
        seed[p.slot] = p.rosterId !== null;
      }
      setScan(m);
      setScanSelection(seed);
      setPhase("scan-review");
      toast.success("Screenshot analyzed", { id: loadingToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze", {
        id: loadingToast,
      });
      setPhase("select");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleScanRow = (slot: number) => {
    setScanSelection((prev) => ({ ...prev, [slot]: !prev[slot] }));
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
    const winners = scan.players.filter(
      (p) => p.rosterId && scanSelection[p.slot] && p.won
    ).length;
    toast.success(
      `Match logged — ${scanSelectedCount} roster player${
        scanSelectedCount === 1 ? "" : "s"
      }, ${winners} GG`
    );
    setPhase("success");
    setTimeout(resetFlow, 900);
  };

  const handleLog = () => {
    if (!canLog) return;

    const emptyMap: Record<string, number> = {};

    if (kind === "match") {
      logGgAndMatchesBatch(emptyMap, matchCounts);
    } else {
      logGgAndMatchesBatch(ggCounts, emptyMap);
    }

    const kindLabel = kind === "gg" ? "GG" : formatMatchWord(total);
    const parts = summaryItems.map((p) => `${p.name} +${p.count}`);
    toast.success(`${kindLabel}: ${parts.join(", ")}`);
    setPhase("success");
    setTimeout(resetFlow, 900);
  };

  const confirmSummary =
    kind === "match"
      ? `${total} ${formatMatchWord(total)} for ${activeGroup ? activeGroup.label : `${summaryItems.length} players`}`
      : `${total} GG total`;

  const confirmDetail = summaryItems
    .map((p) =>
      kind === "match"
        ? `${p.name}: +${p.count} ${formatMatchWord(p.count)}`
        : `${p.name}: +${p.count} GG`
    )
    .join(", ");

  const showManualUI = phase !== "scan-uploading" && phase !== "scan-review";

  return (
    <div className="mx-auto max-w-2xl px-8 pt-4 pb-32 space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Screenshot upload entry point */}
      {phase === "select" && (
        <section className="space-y-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
            Upload match screenshot
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Auto-extract match stats with AI
          </p>
        </section>
      )}

      {phase === "scan-uploading" && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">
              Analyzing screenshot…
            </span>
          </CardContent>
        </Card>
      )}

      {phase === "scan-review" && scan && (
        <ScanReview
          scan={scan}
          selection={scanSelection}
          toggle={toggleScanRow}
          onBack={resetFlow}
        />
      )}

      {showManualUI && (
        <>
          {/* Kind toggle */}
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={kind === "match" ? "default" : "outline"}
                size="lg"
                disabled={phase !== "select"}
                onClick={() => setKind("match")}
                className={cn(phase !== "select" && "opacity-60")}
              >
                <Swords className="size-4" aria-hidden />
                Match
              </Button>
              <Button
                variant={kind === "gg" ? "default" : "outline"}
                size="lg"
                disabled={phase !== "select"}
                onClick={() => setKind("gg")}
                className={cn(phase !== "select" && "opacity-60")}
              >
                <Trophy className="size-4" aria-hidden />
                GG
              </Button>
            </div>
          </section>

          {/* Group chips (match mode only) */}
          {kind === "match" && (
            <GroupChips
              counts={matchCounts}
              setCounts={setMatchCounts}
              disabled={phase !== "select"}
            />
          )}

          {/* Per-player steppers */}
          <PlayerSteppers
            label={kind === "match" ? "Matches per player" : "GG per player"}
            counts={counts}
            bump={bump}
            disabled={phase !== "select"}
          />
        </>
      )}

      {/* Action area */}
      <div className="sticky bottom-28 pt-2 space-y-3 rounded-xl bg-background/85 backdrop-blur-md -mx-4 px-4 z-30">
        {phase === "select" && (
          <Button
            size="lg"
            className="w-full"
            disabled={!canLog}
            onClick={() => setPhase("confirm")}
          >
            {kind === "match"
              ? `Review — ${total} ${formatMatchWord(total)}`
              : `Review — ${total} GG`}
          </Button>
        )}
        {phase === "success" && (
          <Button
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-600 transition-all"
            disabled
          >
            <Check className="size-5" aria-hidden />
            Logged!
          </Button>
        )}
        {phase === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle>{confirmSummary}?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{confirmDetail}</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setPhase("select")}
                >
                  Back
                </Button>
                <Button className="w-full sm:w-auto" onClick={handleLog}>
                  Yes, log it
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {phase === "scan-review" && scan && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={resetFlow}
            >
              Discard
            </Button>
            <Button
              className="w-full sm:flex-1"
              disabled={scanSelectedCount === 0}
              onClick={handleLogScan}
            >
              Log match ({scanSelectedCount} player
              {scanSelectedCount === 1 ? "" : "s"})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scan review                                                        */
/* ------------------------------------------------------------------ */

function ScanReview({
  scan,
  selection,
  toggle,
  onBack,
}: {
  scan: ExtractedMatch;
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
  onBack: () => void;
}) {
  const grouped = useMemo(() => {
    const byId = [...scan.players].sort((a, b) => a.slot - b.slot);
    return {
      radiant: byId.filter((p) => p.side === "radiant"),
      dire: byId.filter((p) => p.side === "dire"),
    };
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
        <ScanSideList
          label="Radiant"
          players={grouped.radiant}
          selection={selection}
          toggle={toggle}
          won={scan.winningSide === "radiant"}
        />
        <ScanSideList
          label="Dire"
          players={grouped.dire}
          selection={selection}
          toggle={toggle}
          won={scan.winningSide === "dire"}
        />
      </CardContent>
    </Card>
  );
}

function ScanSideList({
  label,
  players,
  selection,
  toggle,
  won,
}: {
  label: string;
  players: ExtractedMatch["players"];
  selection: Record<number, boolean>;
  toggle: (slot: number) => void;
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
          const selected = !!selection[p.slot];
          return (
            <button
              key={p.slot}
              type="button"
              disabled={!isRoster}
              onClick={() => toggle(p.slot)}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2 flex items-center gap-3 transition-colors",
                isRoster
                  ? selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/40"
                  : "border-border/50 opacity-60 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "size-4 rounded border flex items-center justify-center shrink-0",
                  isRoster && selected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
                aria-hidden
              >
                {isRoster && selected && <Check className="size-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {p.displayName}
                  </span>
                  {isRoster ? (
                    <Badge variant="secondary" className="text-xs">
                      {ROSTER_NAME_BY_ID[p.rosterId!]}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      not in roster
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.hero} · {p.kills}/{p.deaths}/{p.assists} ·{" "}
                  {p.netWorth.toLocaleString()} NW
                  {p.mmrChange !== null && (
                    <>
                      {" · "}
                      <span
                        className={cn(
                          p.mmrChange >= 0 ? "text-emerald-500" : "text-red-500"
                        )}
                      >
                        {p.mmrChange >= 0 ? "+" : ""}
                        {p.mmrChange} MMR
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
