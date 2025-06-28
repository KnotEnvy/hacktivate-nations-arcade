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

## Game Development

1. Create a folder inside `src/games` for your game module.
2. Implement the `GameModule` interface defined in `src/games/shared/GameModule.ts` or extend `BaseGame` from `src/games/shared/BaseGame.ts`.
3. Register the game in `src/games/registry.ts` so the loader can discover it.
4. Use services from `src/services` for input, audio, analytics and currency rewards.
5. Run `npm run dev` and select your game from the arcade hub to test it locally.
6. Submit a pull request with your game and any assets under `public/`.

## Scripts

- `npm run dev` – start the development server.
- `npm run build` – create an optimized production build.
- `npm start` – run the production build locally.
- `npm run lint` – check code style with ESLint.
- `npm run type-check` – verify the project compiles with TypeScript.
- `npm test` – run Jest tests (if installed).

## Contributing

Contributions are welcome! Check out the docs in `DOCS/` for the development plan and product requirements. Feel free to open issues or pull requests with ideas, bug fixes or new games.

