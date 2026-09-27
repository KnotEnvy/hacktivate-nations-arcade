# Game Polish Guide

Last updated: September 27, 2026 (tier 0 polish round)

How a game in this arcade gets taken from "works" to "ready for the public",
and the tools that exist for it. The Endless Runner round
(`src/games/runner/RECAP.md`) set the bar; the tier 0 round applied the
same process to five games at once and produced the shared pieces below.

---

## The one rule that comes before the others: identity

The arcade wants other developers to contribute games. So games must NOT
come out looking like one house made them all. Each game is its own
studio's work: its own palette, iconography, motion language, copy voice,
sound vocabulary, HUD layout and way of showing lives, combos and timers.
Two games side by side should look like two studios shipping on the same
platform.

What is shared, like a console platform's system font:

- **Type.** Orbitron for display numerals and titles, Inter for prose,
  JetBrains Mono for values. On canvas these come from
  `src/games/shared/hud/canvasUi.ts` (`displayFont`, `sansFont`,
  `monoFont`). No `Arial`, no bare `monospace`.
- **Two semantic colours.** Amber (`UI.coin`) always means currency and is
  never decorative. Red means a problem.

Everything else in the design system (`DOCS/UI-DESIGN-SYSTEM-HANDOFF.md`)
describes the harness around the games, not the games. The helpers in
`canvasUi.ts` (`panel`, `chip`, `bar`, `banner`, `lifePips`, `heart`,
`edgeVignette`, `ease`) are a convenience, not a template; a game should
draw its own chrome whenever the helpers do not fit its look.

## Architecture pattern

```
src/games/<id>/
├── <Name>Game.ts          # extends BaseGame; orchestration + rules
├── systems/               # HUD renderer, particles, shake, spawning, combo…
├── entities/              # drawn, animated game objects
├── __tests__/             # rules tests on gameTestHarness (see below)
├── RECAP.md               # what the game is now, bugs fixed, open items
└── index.ts
```

Keep the main file under 1,500 logical lines (ESLint warns past that);
split into systems and entities like the runner does.

## Shared pieces every game can use

| Module | What it gives you |
| --- | --- |
| `src/games/shared/BaseGame.ts` | Lifecycle. `renderBaseHud = false` and draw your own HUD in `onRenderUI`. Run your death/victory beat, THEN `endGame()`. Implement `onRenderEnded(ctx)` to keep the final frame on screen under the run shell's summary (games without it get the old black frame). |
| `src/games/shared/hud/canvasUi.ts` | Platform type, the two semantic colours, optional drawing helpers. |
| `src/games/shared/input/PressTracker.ts` | Turns InputManager's level state into edges: `justPressed`, `tapped`, `longPressed`, `swipe`, pointer down/up, mouse and touch folded into one pointer. Call `update()` once per frame. |
| `src/games/shared/gameTestHarness.ts` | `initGame`, `step`, `makeCtx`, stub `Services` for jest. |
| `src/dev/game-capture/GameCapture.tsx` | Dev-only screenshot harness for any registered game (`/dev/game?game=<id>`), driven by `tests/e2e/tier0-capture.spec.ts`. |

## Rules the reviewer checks

- **Deterministic and dt-driven.** No `Date.now()` / `performance.now()`
  for gameplay or animation; use `gameTime` and `dt`. No `setTimeout` /
  `setInterval` (they run through pause and after destroy). No `1/60`
  constants; timers live in `onUpdate`, never in render. Never mutate
  state while drawing. The loop clamps `dt` to 0.05s — physics must not
  tunnel at that step (substep if it would).
- **Input.** Edges through `PressTracker`. Keyboard AND touch must each be
  able to do everything the game needs, per the manifest's `inputSchema`.
  The run shell owns pause; games do not bind Escape/P.
- **Run lifecycle.** After the shell's Start, a READY beat that names the
  controls and does not punish immediately. A death or victory beat
  (about 1.2–2s) before `endGame()`. `restart()` returns to READY with
  everything reset.
- **Chrome.** The HUD never overlaps the playfield. No emoji in HUD,
  banners, popups or recaps — draw icons as shapes in the game's style.
- **Audio.** The hub starts music; games do not. Use specific `SoundName`s
  (`bounce`, `hit`, `explosion`, `win`, `whoosh`, `success`, `coin`,
  `powerup`, `click`, `collision`, `error`) and rate-limit bursts.
- **Economy.** Coins paid = `floor(score / 100) + pickups × 10`.
  `pickups` means a literal collectible (or a match). Each RECAP states
  the expected payout of a typical three-minute run so the tier can be
  balanced as a set.
- **Contracts.** Keep every `extendedGameData` key, every
  `trackGameSpecificStat` key and every localStorage key the game already
  used; achievements and saved bests depend on them. Adding keys is fine.
- **Performance.** No per-frame `shadowBlur` on more than a handful of
  draws; cache static layers in offscreen canvases; cap particles.

## Tests

Pin RULES, not tuning numbers, in `src/games/<id>/__tests__/` on
`gameTestHarness.ts`, reaching private state through a typed
`internals()` cast as `src/games/runner/__tests__/fairness.test.ts` does.
Every bug fixed in a polish round gets a test that would have failed
before the fix. For games with spawning, a reflex-bot playability test
(see `src/games/runner/__tests__/playability.test.ts`) is the strongest
fairness check there is: a dumb bot that only reacts must survive.

Run a game's suite with `npm run test:dev -- --runInBand src/games/<id>`.
These are development-era tests; the CI gate stays lean on purpose
(`DOCS/START-HERE.md`).

## Looking at a game

Unit tests record draw calls, never pixels. To judge how a game looks,
capture it:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium \   # only on runners whose Chromium differs
CAPTURE_GAMES=snake npx playwright test tier0-capture --project=chromium
```

Frames land in `.captures/tier0/<id>/`. Each game's scene list lives in
`tests/e2e/tier0-capture.spec.ts`; scenes reach into the game's private
fields to jump to a moment, so they change when the game does. Several
runs can share a machine by setting `PLAYWRIGHT_PORT`. The harness page
is `src/app/dev/game/page.tsx`, generated by `scripts/sync-dev-routes.js`
and deleted before type-check, lint and build; it never ships.

## The deploy gate, unchanged

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

## Per-game status

| Game | Tier | Polish round | Notes |
| --- | --- | --- | --- |
| Endless Runner | 0 | September 19, 2026 | `src/games/runner/RECAP.md` |
| Snake | 0 | September 27, 2026 | `src/games/snake/RECAP.md` |
| Minesweeper | 0 | September 27, 2026 | `src/games/minesweeper/RECAP.md` |
| Mini Breakout | 0 | September 27, 2026 | `src/games/breakout/RECAP.md` |
| Memory Match | 0 | September 27, 2026 | `src/games/memory/RECAP.md` |
| Tap Dodge | 0 | September 27, 2026 | `src/games/tapdodge/RECAP.md` |
| Block Puzzle, Color Drop, Tower Builder, Mini Golf, Bubble Pop | 1 | next | |
| Retro Strike, Space Shooter, Asteroids, Frog Hop, Crystal Caverns, Speed Racer | 2 | after tier 1, one or two per session | |
