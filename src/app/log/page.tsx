"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CURRENT_TITLE, ROSTER, GROUPS } from "@/lib/config";
import { logGgAndMatchesBatch } from "@/lib/log-entries";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Toaster, toast } from "sonner";
import { ArrowLeft, Minus, Plus, Trophy, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

type LogKind = "gg" | "match";

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
  const [phase, setPhase] = useState<"select" | "confirm">("select");
  const [matchCounts, setMatchCounts] = useState(zeroCounts);
  const [ggCounts, setGgCounts] = useState(zeroCounts);

  const counts = kind === "match" ? matchCounts : ggCounts;
  const setCounts = kind === "match" ? setMatchCounts : setGgCounts;

  const bump = useCallback(
    (playerId: string, delta: number) => {
      if (phase === "confirm") return;
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
  }, []);

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
    resetFlow();
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit gap-1.5 px-0"
            )}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to leaderboard
          </Link>
          <Badge variant="secondary" className="w-fit">
            {CURRENT_TITLE}
          </Badge>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Quick log</h1>
          <p className="text-sm text-muted-foreground">
            {phase === "select"
              ? "Pick what to log, set counts, then confirm."
              : "Confirm to save."}
          </p>
        </header>

        {/* Kind toggle */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            What happened?
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={kind === "match" ? "default" : "outline"}
              size="lg"
              disabled={phase === "confirm"}
              onClick={() => setKind("match")}
              className={cn(phase === "confirm" && "opacity-60")}
            >
              <Swords className="size-4" aria-hidden />
              Match
            </Button>
            <Button
              variant={kind === "gg" ? "default" : "outline"}
              size="lg"
              disabled={phase === "confirm"}
              onClick={() => setKind("gg")}
              className={cn(phase === "confirm" && "opacity-60")}
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
            disabled={phase === "confirm"}
          />
        )}

        {/* Per-player steppers */}
        <PlayerSteppers
          label={kind === "match" ? "Matches per player" : "GG per player"}
          counts={counts}
          bump={bump}
          disabled={phase === "confirm"}
        />

        {/* Action area */}
        <div className="sticky bottom-4 pt-2 space-y-3">
          {phase === "select" ? (
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
          ) : (
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
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleLog}
                  >
                    Yes, log it
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
