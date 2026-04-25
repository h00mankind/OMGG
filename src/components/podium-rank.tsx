import { cn } from "@/lib/utils";

type Tier = "gold" | "silver" | "bronze";

const TIERS: Record<Tier, { ribbon: string; medal: string; star: string }> = {
  gold: {
    ribbon: "from-amber-400 to-amber-600",
    medal: "from-amber-300 via-amber-500 to-amber-700",
    star: "text-amber-100",
  },
  silver: {
    ribbon: "from-zinc-300 to-zinc-500",
    medal: "from-zinc-200 via-zinc-400 to-zinc-600",
    star: "text-zinc-50",
  },
  bronze: {
    ribbon: "from-orange-400 to-amber-700",
    medal: "from-orange-300 via-orange-500 to-orange-800",
    star: "text-orange-50",
  },
};

function tierFor(rank: number): Tier | null {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

export function PodiumRank({
  rank,
  showZero = false,
  hasValue = true,
  className,
}: {
  rank: number;
  showZero?: boolean;
  hasValue?: boolean;
  className?: string;
}) {
  const tier = hasValue ? tierFor(rank) : null;

  if (!tier) {
    return (
      <span
        className={cn(
          "flex size-8 items-center justify-center text-sm font-semibold tabular-nums text-muted-foreground",
          className,
        )}
      >
        {rank > 0 || showZero ? rank : ""}
      </span>
    );
  }

  const t = TIERS[tier];
  return (
    <span className={cn("relative inline-flex size-9 items-center justify-center", className)}>
      <svg
        viewBox="0 0 32 36"
        aria-hidden
        className="absolute inset-0 size-full drop-shadow-[0_0_6px_rgba(255,180,80,0.35)]"
      >
        <defs>
          <linearGradient id={`medal-${tier}`} x1="0%" y1="0%" x2="0%" y2="100%">
            {tier === "gold" && (
              <>
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </>
            )}
            {tier === "silver" && (
              <>
                <stop offset="0%" stopColor="#f3f4f6" />
                <stop offset="50%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#4b5563" />
              </>
            )}
            {tier === "bronze" && (
              <>
                <stop offset="0%" stopColor="#fdba74" />
                <stop offset="50%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#7c2d12" />
              </>
            )}
          </linearGradient>
        </defs>
        <path
          d="M8 0 L24 0 L20 14 L12 14 Z"
          fill={`url(#medal-${tier})`}
          opacity="0.85"
        />
        <circle
          cx="16"
          cy="22"
          r="11"
          fill={`url(#medal-${tier})`}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="1"
        />
        <circle cx="16" cy="22" r="7" fill="rgba(0,0,0,0.25)" />
      </svg>
      <span className={cn("relative z-10 text-[11px] font-bold tabular-nums", t.star)}>
        {rank}
      </span>
    </span>
  );
}
