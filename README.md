# HacktivateNations Arcade

HacktivateNations Arcade is a Next.js + TypeScript arcade hub for modular retro mini-games. Players sign in, move between games, earn a shared currency, unlock tiers, and sync progression through Supabase.

## Current State

- The arcade hub, progression loop, auth flow, trusted progression route, sync outbox, and leaderboard plumbing are already implemented.
- `src/games/registry.ts` currently registers 17 playable games, including Speed Racer.
- `src/data/Games.ts` still lists a broader 27-entry catalog, with the unregistered items rendered as coming soon in the UI.
- The production UX is sign-in-first; the old guest gameplay/profile flow is no longer the intended path.
- PWA install/offline claims are intentionally disabled until the required assets and service-worker surface are complete.
- The production home route uses a lightweight boot shell and loads the full arcade hub, Supabase auth/sync clients, and procedural audio system dynamically for faster startup.

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

- `src/lib/supabase.ts` initializes the browser client
- `src/lib/supabase.types.ts` contains generated database typings
- `src/services/SupabaseArcadeService.ts` centralizes profile, wallet, achievement, challenge, and leaderboard calls
- `src/hooks/useSupabaseAuth.ts` owns auth bootstrap and auth actions
- `supabase/001_init.sql` provisions the expected schema, views, RPCs, and RLS policies

After any SQL change, apply `supabase/001_init.sql` to the target project and regenerate `src/lib/supabase.types.ts`.

If Supabase env vars are absent or broken, auth is unavailable and the app remains behind the sign-in gate.

## Game Registry Notes

Speed Racer is complete and registered. Treat `src/games/registry.ts` as the source of truth for released playable games, and keep `src/data/Games.ts` aligned for catalog display.

If adding or replacing a game later:

1. Create the game folder under `src/games/<id>`
2. Implement the `GameModule` interface or extend `src/games/shared/BaseGame.ts`
3. Register the game in `src/games/registry.ts`
4. Align the catalog entry in `src/data/Games.ts`
5. Add the thumbnail under `public/games/<id>/<id>-thumb.svg`
6. Verify the end-of-game payload reports the score, reward, and any stats needed for shared progression/analytics
7. Run the verification commands and test the game through the signed-in hub

If you are replacing an existing coming-soon catalog entry, keep the id aligned across `src/data/Games.ts`, `src/games/registry.ts`, any thumbnail path, and any game-specific challenge or analytics references.

## Scripts

- `npm run dev` starts the development server
- `npm run build` creates a production build
- `npm start` runs the production build
- `npm run lint` runs ESLint
- `npm run type-check` runs TypeScript without emitting files
- `npm test -- --runInBand` runs Jest serially
- `npm run e2e` runs Playwright

The current deploy gate is:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run build
```

Playwright specs should be refreshed before treating `npm run e2e` as a blocking launch gate because older specs still assumed the retired guest hub flow.

## Production Notes

- Do not commit populated `.env` files
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of the client bundle and deployment logs
- Treat `src/games/registry.ts` as the source of truth for what is actually playable
- Keep the live Supabase project, `supabase/001_init.sql`, and `src/lib/supabase.types.ts` aligned
- Use `DOCS/VERCEL-PRODUCTION-RUNBOOK.md` and `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` before promoting a preview to production
