# HacktivateNations Arcade

HacktivateNations Arcade is a Next.js + TypeScript arcade hub for modular retro mini-games. Players can move between games, earn a shared currency, unlock tiers, and optionally sync progress through Supabase.

## Current State

- The arcade hub, progression loop, auth flow, and leaderboard plumbing are already implemented.
- The live registry currently contains the shipped games. The broader catalog also includes roadmap entries that are now marked as coming soon in the UI.
- PWA install/offline claims are intentionally disabled until the required assets and service worker surface are completed.

## Installation

```bash
git clone https://github.com/your-org/hacktivate-nations-arcade.git
cd hacktivate-nations-arcade
npm install
npm run type-check
npm run dev
```

The app runs on `http://localhost:3000` by default. Use `npm run build` and `npm start` for a production build.

## Supabase Setup

Copy `env.example` to `.env.local` for local development and fill in the values:

```bash
cp env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # server-only, never expose to the client
```

Required files and services:

- `src/lib/supabase.ts` initializes the browser client.
- `src/lib/supabase.types.ts` contains generated database typings.
- `src/services/SupabaseArcadeService.ts` centralizes profile, wallet, achievement, challenge, and leaderboard calls.
- `src/hooks/useSupabaseAuth.ts` owns auth bootstrap and resend/sign-in flows.
- `supabase/001_init.sql` provisions the expected schema, view, RPC, and RLS policies.

If Supabase env vars are absent, the arcade runs in guest mode with local-only persistence.

## Game Development

1. Create a folder under `src/games/<id>`.
2. Implement the `GameModule` interface or extend `src/games/shared/BaseGame.ts`.
3. Register the game in `src/games/registry.ts`.
4. Add a thumbnail under `public/games/<id>/<id>-thumb.svg`.
5. Reuse shared services from `src/services` for input, audio, analytics, achievements, and currency.
6. Run `npm run dev` and verify the game through the hub.

## Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm start` runs the production build.
- `npm run lint` runs ESLint.
- `npm run type-check` runs TypeScript without emitting files.
- `npm test` runs Jest.
- `npm run e2e` runs Playwright.

## Production Notes

- Do not commit populated `.env` files.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of the client bundle and deployment logs.
- Treat `src/games/registry.ts` as the source of truth for what is actually playable.
