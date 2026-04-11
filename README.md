# OMGG Leaderboard

Realtime win tracker. Anyone with the link picks a name and taps to log wins. The leaderboard updates live across all connected clients.

## Setup

1. `npm install`
2. Create an InstantDB app at [instantdb.com](https://www.instantdb.com) and run `npx instant-cli@latest init` to authenticate and generate your app ID.
3. Set the env var — create `.env.local`:
   ```
   NEXT_PUBLIC_INSTANT_APP_ID=your-app-id-here
   ```
4. Push the schema: `npx instant-cli@latest push`
5. `npm run dev` → open [localhost:3000](http://localhost:3000)

## Configuration

Edit `src/lib/config.ts`:

- **`CURRENT_TITLE`** — the game/event being tracked (e.g. `"Victory Royale"`). Change this to start a fresh leaderboard; old entries stay in the DB under the previous title.
- **`ROSTER`** — the list of players. Each entry has an `id` (stable slug) and `name` (display name). Add or remove players here.

## Permissions tradeoff

This is a public-link app with no authentication. Anyone with the URL can view the leaderboard and log wins. Entries cannot be edited or deleted through the client. This keeps the UX frictionless but means a determined user could spam entries via the API. For a private group this is fine; for a public-facing app you'd want to add auth.

## Deploy

Push to GitHub and import into [Vercel](https://vercel.com). Set `NEXT_PUBLIC_INSTANT_APP_ID` in the Vercel environment variables.
