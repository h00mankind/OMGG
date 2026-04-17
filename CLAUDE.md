# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

**OMGG** is a realtime win/match tracker. Anyone with the link logs GGs and matches; the leaderboard updates live via InstantDB subscriptions.

### Data layer — InstantDB

- `instant.schema.ts` — single `entries` entity: `{ playerId, title, kind, createdAt }`
- `instant.perms.ts` — public view + create, no update/delete (intentional; see README tradeoff note)
- `src/lib/db.ts` — exports the singleton `db` client (uses `NEXT_PUBLIC_INSTANT_APP_ID`)
- Push schema/perms changes with `npx instant-cli@latest push` (requires `INSTANT_APP_ADMIN_TOKEN`)
- `serverCreatedAt` vs `createdAt`: entries write a client `createdAt`, but the query orders by `serverCreatedAt` (InstantDB-assigned). The recent-activity feed renders `e.createdAt`. These are separate fields — don't conflate them.

### Configuration — `src/lib/config.ts`

Two exports drive everything:
- `CURRENT_TITLE` — acts as a namespace for the active leaderboard. Changing it starts a fresh leaderboard without deleting old data.
- `ROSTER` — array of `{ id, name }`. `id` is the stable key stored in the DB; `name` is display only.
- `GROUPS` — predefined player subsets for quick selection on the log page.

### Entry kinds — `src/lib/entry-kinds.ts`

Two kinds: `"gg"` and `"match"`. Legacy rows without `kind` are treated as GGs by `normalizeEntryKind`.

### Pages

Both pages are `"use client"` — there is no server rendering.

- `/` (`src/app/page.tsx`) — leaderboard. Single `db.useQuery` call fetches all entries for `CURRENT_TITLE` ordered by `serverCreatedAt desc`. The same result drives both the ranked table and the recent-activity feed (last 10 entries). All `ROSTER` members always appear in the table even with zero GGs; sort is GG count descending, tiebroken by `lastGg` recency.
- `/log` (`src/app/log/page.tsx`) — entry form. State is a `kind` toggle (`"match"` | `"gg"`) × `phase` toggle (`"select"` | `"confirm"`). Separate `matchCounts` and `ggCounts` maps are kept in state so switching kind doesn't reset the other side's counts. Group chips are only rendered in match mode. `logGgAndMatchesBatch` is called with one map populated and the other empty.

### Key libs

- `src/lib/entry-stats.ts` — `aggregateByPlayer`: folds raw entries into `{ gg, matches, lastGg, lastMatch }` per player. `ggCountsByDay`: returns last 14 days of GG counts (local time) for the bar chart.
- `src/lib/log-entries.ts` — `logGgAndMatchesBatch`: builds one DB transaction per unit (offset timestamps by 1ms to preserve insertion order).

### UI

shadcn/ui components under `src/components/ui/`. Add new components with:

```bash
npx shadcn@latest add <component>
```

**Important:** these components use `@base-ui/react` as the primitive layer (not Radix UI). The APIs and import paths differ from standard shadcn/ui — always check the generated file rather than assuming Radix conventions apply.

Charts use `recharts` via the `ChartContainer`/`ChartConfig` wrapper in `src/components/ui/chart.tsx`. Series colors are set via `var(--color-<dataKey>)` (resolved by `ChartContainer` from the config object) — not raw CSS vars like `--chart-1` directly in JSX.

Tailwind CSS v4 + `tw-animate-css`. Dark mode forced via `className="dark"` on `<html>`. Icons from `lucide-react` and `@phosphor-icons/react`.

When I say "watch mode", call agentation_watch_annotations in a loop.
For each annotation: acknowledge it, make the fix, then resolve it with a summary.
Continue watching until I say stop or timeout is reached.
