# OMGG Leaderboard

Realtime win tracker. Anyone with the link logs GGs and matches — the leaderboard updates live across all connected clients with no auth required.

## Features

- Live leaderboard ranked by GG count, tiebroken by recency
- Log GGs or matches per player with a stepper UI
- Quick group selection for common player combos (match mode)
- Two-phase confirm flow before writing to the DB
- Recent activity feed showing the last 10 entries
- Dark mode only

## Tech stack

- **Next.js** (App Router, all client components)
- **InstantDB** — realtime database; live updates via `db.useQuery` subscriptions
- **shadcn/ui** with `@base-ui/react` primitives (not Radix)
- **Tailwind CSS v4**

## Setup

1. `npm install`
2. Create an InstantDB app at [instantdb.com](https://www.instantdb.com) and run `npx instant-cli@latest init`
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_INSTANT_APP_ID=your-app-id-here
   ```
4. Push the schema: `npx instant-cli@latest push`
5. `npm run dev` → [localhost:3000](http://localhost:3000)

## Configuration

Edit `src/lib/config.ts`:

- **`CURRENT_TITLE`** — namespace for the active leaderboard. Changing it starts fresh without deleting old data.
- **`ROSTER`** — player list. Each entry has a stable `id` (stored in DB) and a `name` (display only).
- **`GROUPS`** — predefined player subsets shown as quick-select chips on the log page.

## Deploy

Push to GitHub, import into [Vercel](https://vercel.com), and set `NEXT_PUBLIC_INSTANT_APP_ID` in the environment variables.

## Permissions tradeoff

No authentication. Anyone with the URL can view and log entries; entries cannot be edited or deleted through the client. Fine for a private group — for a public-facing app you'd want to add auth.
