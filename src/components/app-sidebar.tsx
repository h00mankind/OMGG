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
  Wrench,
} from "lucide-react";
import { CURRENT_TITLE, type RosterMember } from "@/lib/config";
import { useViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playerColor, playerInitial } from "@/lib/player-color";
import { Button } from "@/components/ui/button";

type NavItemDef = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  enabled?: boolean;
  badge?: string;
};

const BASE_NAV: NavItemDef[] = [
  { href: "/", label: "Leaderboard", icon: Trophy, enabled: true },
  { href: "/players", label: "Players", icon: Users },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/log", label: "Match Entry", icon: PlusCircle, enabled: true },
  { href: "/stats", label: "Stats", icon: BarChart3, enabled: true },
  { href: "/mvp-race", label: "MVP Race", icon: Crown },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/heroes", label: "Heroes", icon: Sparkles },
];

const DEV_NAV: NavItemDef[] = [
  {
    href: "/playground",
    label: "Playground",
    icon: Wrench,
    enabled: true,
    badge: "DEV",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarLogo() {
  return (
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
  );
}

export function SidebarNavItem({
  icon: Icon,
  label,
  href,
  active = false,
  disabled = false,
  badge,
  onClick,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
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
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="border border-primary/30 px-1 py-px text-[8px] font-bold tracking-[0.2em] text-primary">
          {badge}
        </span>
      )}
    </span>
  );

  if (disabled) {
    return <li className="cursor-not-allowed">{inner}</li>;
  }
  if (href) {
    return (
      <li>
        <Link href={href} aria-current={active ? "page" : undefined}>
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    </li>
  );
}

export function SidebarSeasonSelector({
  title = CURRENT_TITLE,
}: {
  title?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Season
      </div>
      <button
        type="button"
        className="mt-1 flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
        disabled
      >
        <span className="font-display tracking-wider uppercase">{title}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

export function SidebarLiveBadge() {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
      <RefreshCw className="size-3" aria-hidden />
      <span>Live</span>
    </div>
  );
}

export function SidebarViewerChip({
  viewer,
  onClick,
}: {
  viewer: RosterMember | null;
  onClick?: () => void;
}) {
  const color = viewer ? playerColor(viewer.id) : null;

  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

export function AppSidebar({
  onOpenViewerPicker,
}: {
  onOpenViewerPicker: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { viewer } = useViewer();

  const nav =
    process.env.NODE_ENV !== "production"
      ? [...BASE_NAV, ...DEV_NAV]
      : BASE_NAV;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-card/80 backdrop-blur-xl lg:flex",
      )}
    >
      <SidebarLogo />

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {nav.map((item) => (
            <SidebarNavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.enabled ? item.href : undefined}
              active={isActive(pathname, item.href)}
              disabled={!item.enabled}
              badge={item.badge}
            />
          ))}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-white/5 px-5 py-5">
        <SidebarSeasonSelector />
        <SidebarLiveBadge />
        <SidebarViewerChip viewer={viewer} onClick={onOpenViewerPicker} />
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
