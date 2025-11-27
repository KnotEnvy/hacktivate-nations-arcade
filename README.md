# HacktivateNations Arcade

HacktivateNations Arcade is a web‑based hub for modular, retro‑inspired mini games. Built with Next.js and TypeScript, the project lets players jump between games, earn a shared currency and unlock new experiences—all without refreshing the page.

## Purpose

Our goal is to create a plug‑and‑play arcade where the community can contribute new games easily. Each game follows a common `GameModule` contract and plugs into shared services such as input handling, audio, analytics and the in‑game currency. The codebase is designed for rapid iteration and offline‑friendly play via PWA support.

## Installation

```bash
# clone the repository
git clone https://github.com/your-org/hacktivate-nations-arcade.git
cd hacktivate-nations-arcade

# install dependencies
npm install

# verify TypeScript setup
npm run type-check

# start the dev server
npm run dev
```

The application runs on [http://localhost:3000](http://localhost:3000) by default. Use `npm run build` and `npm start` to create and serve a production build.

## Available Games

HacktivateNations Arcade ships with a growing collection of mini games. The current lineup includes:

- **Endless Runner** – dodge obstacles and grab coins while sprinting forward.
- **Snake** – classic snake action with collectible coins and food.
- **Block Puzzle** – a falling-block puzzler (in progress).

Each game implements the same `GameModule` interface and relies on shared services such as `useInput` for controls and `AudioManager` for sounds.

## Game Development

1. Create a folder inside `src/games` for your game module.
2. Implement the `GameModule` interface defined in `src/games/shared/GameModule.ts` or extend `BaseGame` from `src/games/shared/BaseGame.ts`.
3. Register the game in `src/games/registry.ts` so the loader can discover it.
4. Add a thumbnail under `public/games/<id>/<id>-thumb.svg` (512x512). Keep the house style (simple shapes, bold colors) for visual consistency in the hub.
5. Use services from `src/services` for input, audio, analytics and currency rewards.
6. Run `npm run dev` and select your game from the arcade hub to test it locally.
7. Submit a pull request with your game and any assets under `public/`.

## Scripts

- `npm run dev` – start the development server.
- `npm run build` – create an optimized production build.
- `npm start` – run the production build locally.
- `npm run lint` – check code style with ESLint.
- `npm run type-check` – verify the project compiles with TypeScript.
- `npm test` – run Jest tests (if installed).

## Contributing

Contributions are welcome! Check out the docs in `DOCS/` for the development plan and product requirements. Feel free to open issues or pull requests with ideas, bug fixes or new games.

## Supabase Setup (persistence)

Add environment variables to `.env.local` (or your deployment provider):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # server-only, never ship to the client
```

Use `getSupabaseBrowserClient` or `createSupabaseServerClient` from `src/lib/supabase.ts` to talk to Supabase. Database typings live in `src/lib/supabase.types.ts`, and `SupabaseArcadeService` (in `src/services`) centralizes calls for profiles, wallets, sessions, achievements, and leaderboards. Sign-in uses a magic-link modal in the hub header, with the callback handled at `/auth/callback`.

