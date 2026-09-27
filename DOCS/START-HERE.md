# Start Here

Last updated: September 27, 2026

This is the minimal handoff set for the next team. The production-hardening pass, Speed Racer implementation, procedural audio pass, startup-performance pass, and the harness UI/menu-flow pass are all complete. The remaining work before public launch is per-game polish, signed-in browser QA, and final production operations.

## July 12 Platform Hardening Update

- Deployment target is Vercel, not GitHub Pages; the trusted API requires a server runtime.
- Next.js is on the patched 15.5 maintenance line and CI audits production dependencies for high/critical findings.
- Linux/Vercel import casing is aligned with the tracked `src/data/Achievements.ts` filename.
- Authoritative progression tables are browser read-only; trusted RPC execution is service-role-only.
- Achievement claims are session-derived, challenge claims and unlock purchases are atomic, and queued mutations are account-bound.
- Public signup, auth callback credential cleanup, explicit sign-out failures, security headers, and accessible account/onboarding/audio dialogs are implemented.
- Existing Supabase projects must apply `supabase/003_lock_down_progression.sql` before deployment. Never run the destructive `001_init.sql` against the live project.
- Platform verification passes: type-check, lint, focused non-game tests, and the 10-test release approval suite.
- Production build verification is still required after the current local dev server is stopped or in the Vercel preview build.

## Read Order

1. `README.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md` — broad current-state handoff
3. This file's "What To Work On Next"

Then, only what your task touches:

- `DOCS/UI-DESIGN-SYSTEM-HANDOFF.md` — **read before any harness UI work** (design tokens, the `components/ui` primitives, the game library, the hub and run shells)
- `DOCS/GAME_ENHANCEMENT_GUIDE.md` — if you are polishing an individual game's visuals
- `DOCS/AUDIO-SYSTEM-HANDOFF.md` — music, sound effects, the audio settings modal, launch/hub music
- `DOCS/UserSystemsHandoff.md` — auth, persistence, Supabase, progression sync, analytics ownership, local-save boundaries
- `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` — changing live Supabase schema or verifying the trusted progression RPC path
- `DOCS/VERCEL-PRODUCTION-RUNBOOK.md` — any Vercel production task
- `DOCS/Test101.md` — the quality gate and what it deliberately does not run
- `DOCS/leveling.md` — the XP curve
- `DOCS/self-hosting-beta.md` — Docker + Caddy self-hosting
- `DOCS/HacktivateNations Arcade - Product Requirements Document v2.md` — product intent
- `src/games/dungeon-crawl/Crawler_handoff.json` — if you are touching Dungeon Crawl; it is the single source of truth for the game's v3/v4 AD&D transformation and its metric/achievement contracts. Note: its reference library (`DOCS/ADD2ndEdition/`) is gitignored and must be obtained from the project owner.

`DOCS/archive/` holds superseded planning docs and finished build todos. Nothing
there describes the current repo — see `DOCS/archive/README.md`.

## Current Verified Repo State

Verified on April 15, 2026:

- `npm test -- --runInBand` passes
- `npm run e2e` passed against the then-current guest-era smoke specs
- `.github/workflows/ci.yml` now mirrors the local verification gates
- trusted `record-session` derives gameplay progression server-side and commits through `public.commit_trusted_game_session(...)`

Verified on April 16, 2026:

- `npm run lint` passes
- `npm run type-check` passes
- `npm run build` passes
- the arcade now runs as a signed-in product flow; the guest gameplay/profile path has been retired from the main UX
- first-time signed-in accounts hydrate clean defaults instead of inheriting stale guest/local stats
- queued sync work surfaces offline state, failed replay diagnostics, and a manual retry action in the hub
- the route/RPC contract for `commit_trusted_game_session(...)` is aligned with the deployed SQL, and the wallet update ambiguity in `supabase/001_init.sql` is fixed
- analytics storage is now account-scoped via `hacktivate-analytics:<ownerId>` and no longer reads the legacy shared guest bucket
- the catalog listed 27 entries, while `src/games/registry.ts` registered 16 playable games at that point

Verified on April 25, 2026 after the procedural music/SB32 pass:

- `npm.cmd test -- ProceduralMusicEngine.patches.test.ts --runInBand` passes
- `npm.cmd test -- AudioManager.test.ts --runInBand` passes
- `npm.cmd run type-check` passes
- `npm.cmd run lint` passes
- `npm.cmd run build` passes
- procedural music playback is no longer silenced by delayed track cleanup during hub/lab transitions
- `hub_music` and `game_music` compatibility aliases now route through procedural SB32-style tracks instead of the old legacy music generator
- the new `hub_sb32_intro` / "SB32 Power-On" track is first in hub auto-rotation and visible at the top of the Hub/Menu track browser

Verified on April 30, 2026 after Speed Racer completion and startup optimization:

- `src/games/registry.ts` now registers 17 playable games, including `speed-racer`
- `/` now renders a lightweight arcade boot shell and dynamically loads the full hub
- Supabase auth/sync clients and the procedural audio engine are deferred until hydration/session/audio use instead of being part of the first route payload
- production build reports `/` at 103 kB first-load JS
- `npm.cmd run type-check` passes
- `npm.cmd run lint` passes
- `npm.cmd test -- --runInBand` passes as a 10-test release approval suite
- `npm.cmd run build` passes
- Playwright now covers a lightweight browser smoke path for the current signed-in access boundary, but signed-in gameplay QA remains a manual deployment-readiness check

Verified on May 28, 2026 after the test-coverage + CI-realignment pass:

- development-era Jest coverage expanded 155 → 323 tests: new unit tests for `src/lib` pure logic (`unlocks`, `challenges`, `gameCatalog`, `utils`), React component render tests, and characterization tests pinning the `GameModule` public surface of PlatformGame / SpaceShooter / FrogHop (plus a reusable `src/games/shared/gameTestHarness.ts`)
- these run via `npm run test:dev -- --runInBand` and are for development use; they are intentionally NOT part of the production CI gate (see Testing Philosophy below)
- the production CI gate remains lean and unchanged: `type-check`, `lint`, the 10-test release-approval suite (`npm test -- --runInBand`), and `build`
- Playwright `browser-smoke` stays a manual `workflow_dispatch` job; signed-in browser/gameplay QA remains a manual deployment-readiness check
- a warning-only `max-lines` ESLint guardrail (1500 logical lines, tests exempt) flags monoliths without failing CI; current flagged files are the known large games/services, to be refactored when each is next actively extended
- `npm test -- --runInBand`, `npm run type-check`, and `npm run lint` pass

## Testing Philosophy

Tests are written and exercised while **building** a game or subsystem. Once a feature ships, the production gate does not re-run the full development-era suite — it confirms the platform builds, the release-critical paths pass, and (via manual QA) that games load and play correctly. Concretely:

- **Production / deploy gate (fast, the only CI gate):** `npm run type-check`, `npm run lint`, `npm test -- --runInBand` (10-test release-approval suite), `npm run build`.
- **Development suite (situational):** `npm run test:dev -- --runInBand` (749 tests) — run when actively building or changing a subsystem, not as a release gate.
- **Platform / gameplay correctness:** verified by manual signed-in browser QA and the optional Playwright `browser-smoke` job (`workflow_dispatch`).

**Do not add the development suite to the CI gate — the lean gate is a deliberate choice to keep builds fast.**

## September 8, 2026 — Harness UI & Menu Flow Pass

The shell outside the games was taken from rough-draft to a single design system.
Read `DOCS/UI-DESIGN-SYSTEM-HANDOFF.md` before touching any harness UI — it is
now the design-system handoff, not the old retro-CRT proposal (that direction was
reviewed and rejected).

- Design tokens live in the `@theme` block of `src/app/globals.css`. Tailwind v4
  here has no `@config`, so the old `tailwind.config.mjs` was dead and has been
  deleted; classes such as `bg-primary-600` and `arcade.*` never rendered.
- New shared primitives under `src/components/ui`: `Panel`, `Chip`/`Tag`,
  `ProgressBar`, `StatTile`, `Icon` (stroke icon set replacing emoji navigation)
  and `Menu`, plus a rebuilt `Button`.
- `GameCarousel` is gone. The game selection screen is now `GameLibrary`
  (featured card, search, category and status filters, tier shelves, card grid),
  with its browsing rules extracted to the pure module `src/lib/gameLibrary.ts`.
- `src/data/Games.ts` entries gained `category` and `tagline`; fill both in for
  every new game. Tier display names live in `TIER_LABELS` in `src/lib/constants.ts`.
- `ArcadeHub` is composed from `HubHeader`, `HubGate`, `HubNotifications` and
  `SyncStatus`; five header buttons collapsed into one overflow menu.
- `ThemedGameCanvas` gained a real end-of-run summary with *Play again* and
  *Back to hub*; a finished run previously had no way forward.
- `npm run dev` now also serves `/dev/hub-preview`, a mock-state harness for
  reviewing the menus without a Supabase project. It is stripped before
  type-check, lint and build like the other dev routes.

Verified on September 8, 2026:

- `npm run type-check`, `npm run lint`, `npm test -- --runInBand` (10-test
  release approval suite) and `npm run build` all pass
- `npm run test:dev -- --runInBand` passes (the `GameCarousel` suite was replaced
  by the `GameLibrary` component and `gameLibrary` logic suites)
- `npm run e2e` arcade-smoke passes (3/3) against the signed-out access boundary
- production build reports `/` at 105 kB first-load JS (was 103 kB)

## September 19, 2026 — Endless Runner polish round

The first per-game polish round is done, on the tier-0 headliner. Full notes
live in `src/games/runner/RECAP.md`; the short version:

- The world, the cast, the chrome and the feel were all reworked. The HUD moved
  to `src/games/runner/systems/HudRenderer.ts` and now runs on the design system
  in `DOCS/UI-DESIGN-SYSTEM-HANDOFF.md`.
- Nineteen live bugs were fixed along the way, most of them rules rather than
  pixels: the "slide under it" barrier could not be slid under, pits were
  harmless, spawn gaps shrank below a jump arc as the run sped up, the base HUD
  drew over the game's own, boss contact ignored the invulnerability window so
  three lives could go in a fifth of a second, and hover drones floated above a
  standing runner's head.
- 21 tests now pin those rules (`npm run test:dev -- src/games/runner`). They
  assert the invariants, not the tuning numbers — including a reflex bot that
  plays a full run and has to clear a boss every time.
- A dev-only capture harness mirrors the Dungeon Crawl one:
  `npx playwright test runner-capture --project=chromium` writes one PNG per
  scene to `.captures/runner/`, including magnified crops of the runner. Like
  the dungeon capture spec it is deliberately NOT in the CI gate.
- `playwright.config.ts` honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, for
  sandboxed runners whose Chromium build does not match Playwright's download.

Verified on September 19, 2026: `npm run type-check`, `npm run lint`,
`npm test -- --runInBand` (10-test release approval suite), `npm run build`, and
`npm run test:dev -- --runInBand` (767 tests) all pass.

## September 27, 2026 — Tier 0 polish round

All five remaining tier-0 games had their polish round in one session, in
parallel, each as the work of its own imagined studio so the tier does not
read as one house style (the arcade wants other developers to contribute, so
the games must look like they could have come from different ones). Only
the platform's type and its two semantic colours are shared. Each game's
`src/games/<id>/RECAP.md` is the account; `DOCS/GAME_ENHANCEMENT_GUIDE.md`
is the process; `DOCS/TIER0-PLAYTEST.md` is the human playtest script that
gates promotion of the tier.

| Game | Studio | Headline fixes |
| --- | --- | --- |
| Snake | Mosslight | Gliding body, two-deep turn queue, a real respawn instead of freezing into the wall, capped pace ladder |
| Minesweeper | Fieldmark | **The game could not be won** (win never checked after a cascade); chording, long-press and flag-mode flags for touch, boards that fit |
| Mini Breakout | Floodlight | HUD off the bricks, substepped physics (no tunnelling), aimed serves, visible damage, mouse control, six power-ups |
| Memory Match | Lamplit Parlour | Five-table ladder with two modes, drawn card faces, release-triggered input, no more `setTimeout` races; two unreachable achievements fixed |
| Tap Dodge | highway signage | Touch could not dodge lasers; pattern-based spawning with a guaranteed path (reflex-bot test), restraint over pile-on effects |

Shared pieces that came out of it: `src/games/shared/hud/canvasUi.ts`
(platform type on canvas, optional helpers), `src/games/shared/input/
PressTracker.ts` (edge-triggered input, tap / long-press / swipe),
`BaseGame.onRenderEnded` and `endGameSound` / `endGameOutcome` (additive;
games without them behave as before), a generic screenshot harness
(`src/dev/game-capture`, driven by `tests/e2e/tier0-capture.spec.ts`, not in
the CI gate), and two service fixes (a mouse button released off the canvas
now releases; the press tracker's first mouse frame after touch).

Economy note for the owner: coins paid are `floor(score/100) + pickups × 10`.
Estimated payout for an average three-minute run, per the RECAPs — Snake
~140, Minesweeper ~80–125 (a hard win ~540), Breakout ~250, Memory ~310
(a full five-table run ~640), Tap Dodge ~600. Tap Dodge and Memory pay the
most; the knobs are named in each RECAP if the tier should be flattened.

Achievement data changed in `src/data/Achievements.ts`: `memory_speed_demon`
now checks `fast_tables >= 1` (the old check compared a time under 30s
against `>= 30` and could never unlock) and `memory_master` is the five-table
run instead of ten levels.

Next: the tier 1 round (Block Puzzle, Color Drop, Tower Builder, Mini Golf,
Bubble Pop) on the same process, after the tier 0 playtest.

Verified on September 27, 2026 on the integrated tree: `npm run type-check`,
`npm run lint` (the same three pre-existing `max-lines` warnings),
`npm test -- --runInBand` (10-test release approval suite),
`npm run test:dev -- --runInBand` (1,010 tests, up from 767) and
`npm run build` (`/` still 105 kB first-load JS) all pass. The tier 0
capture spec renders every scene of all five games.


## What To Work On Next

Highest-value remaining work:

1. **Per-game polish rounds.** The harness pass is done; Endless Runner and
   the rest of tier 0 have had their rounds. Next is the tier 0 human
   playtest (`DOCS/TIER0-PLAYTEST.md`), then tier 1 on the same process
   (`DOCS/GAME_ENHANCEMENT_GUIDE.md`), then tier 2 one or two games per
   session. Each game owns its own art direction; only the platform's type
   and its two semantic colours are shared.
2. **Signed-in browser QA** against the deployed preview and production
   candidates. Verify auth, wallet updates, leaderboard writes, achievements,
   daily challenges, analytics ownership, queued sync retry, audio
   unlock/playback, and sign-out/sign-in account reset. The automated gate
   deliberately does not cover a signed-in gameplay session.
3. **Release-only operational decisions.**
   - Decide whether placeholder leaderboard rows remain acceptable in production
   - Add monitoring/error tracking if that is still part of launch scope
   - Rotate Supabase keys if any prior real values were shared outside the
     current secure deployment setup
4. **Keep the live Supabase project, `supabase/001_init.sql`, and
   `src/lib/supabase.types.ts` aligned** after any future SQL change.

Known smaller items:

- `AudioSettings.tsx` (1,809 lines) is the last major surface not on the design
  system, and is the largest file flagged by the `max-lines` warning.
- The shared `public/games/coming-soon-thumb.svg` is a plain grey box, so
  unbuilt games render an icon placeholder in the library instead of art.

## Verification

Run the deploy gate before promotion:

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

Use `npm run test:dev -- --runInBand` (749 tests) only when actively changing a
subsystem and you want the broader development-era coverage — it is not a
release gate. `npm run e2e` is a manual browser smoke check.

While reviewing harness UI, `npm run dev` also serves `/dev/hub-preview`, which
mounts the real menu components against mock state so they can be inspected
without a Supabase project. Dev-only routes are stripped before type-check,
lint and build.
