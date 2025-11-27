# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router lives in `src/app` (layout, global styles, routes) with shared UI in `src/components`, data seeds in `src/data`, hooks in `src/hooks`, utilities in `src/lib`, and Zustand stores in `src/stores`.
- Games sit under `src/games/<id>` and share contracts in `src/games/shared` with discovery handled by `src/games/registry.ts`.
- Core services for audio, analytics, currency, challenges, input, and user state live in `src/services`; assets and thumbnails belong under `public/games/<id>/`.
- Unit tests stay close to code in `src/**/__tests__`, while Playwright specs live in `tests/e2e`. Product notes and plans are in `DOCS/`.

## Build, Test, and Development Commands
- `npm run dev` – start the app on `http://localhost:3000`.
- `npm run build` / `npm start` – produce and serve the production build; `npm run analyze` to inspect bundle output.
- `npm run lint` / `npm run lint:fix` and `npm run type-check` – enforce ESLint + TypeScript gates; `npm run format` or `format:check` for Prettier.
- `npm test`, `npm run test:watch`, `npm run test:coverage` – Jest unit suites (jsdom, ts-jest).
- `npm run e2e`, `npm run e2e:headed`, `npm run e2e:report` – Playwright end-to-end flows (dev server auto-starts via config).

## Coding Style & Naming Conventions
- TypeScript with `@/*` path aliases; strict mode is on. Prefer module-scoped helpers over utils in components.
- Prettier: 2-space indent, 80-character width, semicolons, single quotes, trailing commas (es5), no extra parens on arrow args.
- ESLint extends `next/core-web-vitals`, `@typescript-eslint`, and `prettier`; `no-unused-vars` and `prefer-const` are errors, `any` is discouraged, and only `console.warn/error` are allowed.
- Use PascalCase for components/classes, camelCase for functions/variables, and kebab-case for files and directories (e.g., `src/games/space`).

## Testing Guidelines
- Co-locate unit tests in `__tests__` folders with `.test.ts[x]` suffixes; prefer Testing Library for React hooks/components and avoid mocking shared services unless necessary.
- Aim for meaningful coverage on services and game logic; check `npm run test:coverage` before merging sizable changes.
- E2E specs under `tests/e2e` assume the dev server; use stable data-testids and keep scenarios fast and focused on player flows (load arcade, launch game, earn currency).

## Commit & Pull Request Guidelines
- Follow the existing history: concise, present-tense summaries under ~72 chars (e.g., `cleaned up registry`, `added e2e for runner`); include scope when helpful.
- PRs should describe the change, link issues, list commands run (lint/type-check/tests/e2e), and attach screenshots or recordings for UI/gameplay tweaks.
- When adding a game: create `src/games/<id>`, implement `GameModule`/`BaseGame`, register in `src/games/registry.ts`, and add `public/games/<id>/<id>-thumb.svg` (512×512). Reuse services (`AudioManager`, `InputManager`, `CurrencyService`, etc.) instead of bespoke wiring.
