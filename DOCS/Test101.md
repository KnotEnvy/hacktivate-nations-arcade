# Test 101 - HacktivateNations Arcade

Last updated: May 7, 2026

This project uses a small, practical quality gate. The goal is to catch broken TypeScript, lint regressions, service logic failures, and production build failures without making every change wait on slow or brittle browser automation.

## Current CI Shape

Required GitHub Actions job:

```bash
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

`npm test` now runs the final release approval suite only: 10 real-data checks covering the catalog, registry, game loading, assets, unlock economy, daily challenges, trusted progression, procedural music assignments, and Supabase auth configuration guard.

Optional browser smoke job:

```bash
npm run e2e
```

The Playwright job is manual in GitHub Actions. Use it when changing the app shell, auth gate, core navigation, public instructions page, or when you want browser-level confidence before sharing a build. It is not intended to block every small game or service change.

## What Is Tested

### Unit and Integration Tests

The default Jest gate covers the systems that most directly affect launch stability:

- current 17 playable / 10 coming-soon catalog shape
- registry and playable catalog alignment
- all playable game modules load with matching manifests
- shipped thumbnail assets and asset budgets
- signed-in unlock economy and default Runner access
- real daily challenge generation from valid templates
- trusted Speed Racer progression and achievement derivation
- procedural music assignments for hub and playable games
- Supabase public auth configuration fail-closed behavior

The broader development-era Jest suites are still available when they are useful:

```bash
npm run test:dev -- --runInBand
```

Use `test:dev` while actively changing hooks, services, Supabase sync, audio internals, or any subsystem where the old focused tests help. Do not make those development suites part of the final approval gate unless the launch risk changes.

### Browser Smoke Tests

Playwright currently covers the current signed-in product boundary:

- `/` boots into the arcade shell
- the user reaches either the sign-in gate or the authentication-unavailable state
- the sign-in modal opens when Supabase auth is configured
- `/instructions` remains available without an authenticated session

The old guest-era e2e specs were removed because they expected direct hub access, onboarding dismissal, and guest game launch. Those assumptions no longer match the production app.

## Commands

```bash
npm run type-check          # TypeScript, no emit
npm run lint                # Next/ESLint
npm test -- --runInBand     # 10-test release approval suite
npm run test:dev -- --runInBand # broader development-era Jest suites
npm run build               # production build
```

Browser checks:

```bash
npm run e2e:install         # first time only
npm run e2e                 # current browser smoke tests
npm run e2e:headed          # visible browser
npm run e2e:ui              # Playwright UI runner
npm run e2e:report          # open latest HTML report
```

## Adding New Games

Before merging a new playable game:

1. Register the game in `src/games/registry.ts`.
2. Keep the catalog entry in `src/data/Games.ts` aligned.
3. Add focused development tests while building if the change is risky, then decide whether the final approval suite needs one durable check updated or added.
4. Run the required local gate: `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`.
5. Run `npm run e2e` when the game changes the shell, auth boundary, public pages, or shared navigation.
6. Manually smoke the new game through a signed-in account before public release.

## CI Philosophy

This arcade is expected to have a small audience, so the workflow should help development rather than dominate it. Keep the required gate deterministic and fast. Use Playwright as a targeted browser smoke tool, not as a full production-grade cross-browser matrix.
