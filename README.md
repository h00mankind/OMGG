# OMGG Leaderboard

Realtime win tracker. Anyone with the link logs GGs and matches — the leaderboard updates live across all connected clients with no auth required.

## Features

- Live leaderboard ranked by GG count, tiebroken by recency
- Log GGs or matches per player with a stepper UI
- Quick group selection for common player combos (match mode)
- Two-phase confirm flow before writing to the DB
- Recent activity feed showing the last 10 entries
- **Screenshot OCR** — upload a Dota 2 post-match scoreboard and an OpenRouter vision model extracts per-player hero, K/D/A, net worth, MMR change, and result, auto-mapped to your roster
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
   # Optional — enables screenshot OCR
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=qwen/qwen2.5-vl-72b-instruct
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

## Screenshot OCR

On `/log`, the **Upload match screenshot** button accepts a Dota 2 end-of-match scoreboard image. It POSTs to `/api/analyze-match`, which forwards the image to OpenRouter's vision endpoint with the current `ROSTER` injected into the prompt. The model returns structured JSON (match duration, winning side, and per-player hero/K-D-A/net worth/MMR change/rosterId), which is validated server-side before being sent back to the client.

The user reviews the extracted rows, deselects any they don't want logged, and confirms. On submit the app writes one `matches` row, one `matchPlayers` row per selected player (linked via InstantDB's forward link), **plus** compat `entries` rows so the existing leaderboard, stats, streaks, and charts keep working unchanged.

Images are discarded immediately after OCR — nothing is persisted except the structured stats.

**Required env vars:**

- `OPENROUTER_API_KEY` — server-only. Must **not** have `NEXT_PUBLIC_` prefix; the API route runs on the server and reads it directly.
- `OPENROUTER_MODEL` — optional, defaults to `qwen/qwen2.5-vl-72b-instruct`. Swap for any OpenRouter model that accepts `image_url` content parts (e.g. `google/gemini-2.5-flash`).

## Permissions tradeoff

No authentication. Anyone with the URL can view and log entries; entries cannot be edited or deleted through the client. Fine for a private group — for a public-facing app you'd want to add auth.
