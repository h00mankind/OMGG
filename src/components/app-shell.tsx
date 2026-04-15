"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Plus, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CURRENT_TITLE } from "@/lib/config";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Leaderboard", icon: Trophy },
  { href: "/log", label: "Log", icon: Plus, primary: true },
  { href: "/stats", label: "Stats", icon: Flame },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-8">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-primary"
          >
            OMGG
          </Link>
          <Badge variant="secondary">{CURRENT_TITLE}</Badge>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Progressive blur gradient behind nav */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[39]"
        style={{ height: "calc(env(safe-area-inset-bottom) + 7rem)" }}
      >
        <div className="h-full w-full bg-gradient-to-t from-background via-background/70 to-transparent" />
      </div>

      <nav
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-8 will-change-transform"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3",
            "rounded-none border border-white/10 bg-background/40 px-3 py-2",
            "shadow-2xl shadow-black/40 backdrop-blur-2xl"
          )}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            if ("primary" in item && item.primary) {
              return (
                <Link
                  key={item.href}
                  href={active ? "/" : item.href}
                  aria-label={active ? "Close log" : item.label}
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center transition-all",
                    "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                    "-mt-6 hover:scale-105 active:scale-95"
                  )}
                >
                  <Plus
                    className={cn(
                      "size-6 transition-transform duration-300 ease-in-out",
                      active && "rotate-45"
                    )}
                    aria-hidden
                    strokeWidth={2.5}
                  />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("size-5", active && "text-primary")}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
