"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trophy,
  Users,
  Swords,
  PlusCircle,
  BarChart3,
  Crown,
  Shield,
  Sparkles,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { CURRENT_TITLE } from "@/lib/config";
import { useViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playerColor, playerInitial } from "@/lib/player-color";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  enabled?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Leaderboard", icon: Trophy, enabled: true },
  { href: "/players", label: "Players", icon: Users },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/log", label: "Match Entry", icon: PlusCircle, enabled: true },
  { href: "/stats", label: "Stats", icon: BarChart3, enabled: true },
  { href: "/mvp-race", label: "MVP Race", icon: Crown },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/heroes", label: "Heroes", icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar({
  onOpenViewerPicker,
}: {
  onOpenViewerPicker: () => void;
}) {
  const pathname = usePathname();
  const { viewer } = useViewer();
  const color = viewer ? playerColor(viewer.id) : null;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-card/80 backdrop-blur-xl lg:flex",
      )}
    >
      <div className="px-6 pt-7 pb-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center bg-primary/15 text-primary glow-primary-soft"
          >
            <Trophy className="size-5" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold uppercase tracking-[0.18em] text-foreground">
              OMGG
            </span>
            <span className="block text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Match Tracker
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const disabled = !item.enabled;

            const inner = (
              <span
                className={cn(
                  "relative flex items-center gap-3 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors",
                  active
                    ? "bg-primary/10 text-primary accent-bar-active"
                    : disabled
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                <span className="truncate">{item.label}</span>
              </span>
            );

            if (disabled) {
              return (
                <li key={item.href} className="cursor-not-allowed">
                  {inner}
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined}>
                  {inner}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-white/5 px-5 py-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Season
          </div>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
            disabled
          >
            <span className="font-display tracking-wider uppercase">{CURRENT_TITLE}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <RefreshCw className="size-3" aria-hidden />
          <span>Live</span>
        </div>

        <button
          type="button"
          onClick={onOpenViewerPicker}
          className={cn(
            "flex w-full items-center gap-3 border border-white/5 bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
          )}
        >
          {viewer && color ? (
            <Avatar className={cn("size-9", color.bg)}>
              <AvatarFallback className={cn(color.bg, color.text, "font-semibold")}>
                {playerInitial(viewer.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="size-9 bg-muted">
              <AvatarFallback className="bg-muted text-muted-foreground">
                ?
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {viewer?.name ?? "Pick a player"}
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-primary">
              {viewer ? "Your profile" : "Set up"}
            </div>
          </div>
        </button>

        <Link href="/log">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary uppercase tracking-[0.18em] glow-primary-soft"
          >
            New Match
          </Button>
        </Link>
      </div>
    </aside>
  );
}
