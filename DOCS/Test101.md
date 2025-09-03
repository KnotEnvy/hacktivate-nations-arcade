# Test 101

This repo uses Jest + ts-jest to test TypeScript modules with the `@/*` path alias. The initial test suite covers core services that are stable and high-leverage for future expansion.

## What’s Included
- CurrencyService tests: reward calculation, add/spend behavior, storage, and change listeners.
- AchievementService tests: unlocking logic by requirement and `gameId` filtering.
- GameLoader tests: registration, discovery, and graceful handling of unknown IDs.

Key files:
- `jest.config.js` – ts-jest preset, jsdom env, `@/*` alias mapping.
- `jest.setup.ts` – cleans `localStorage` before each test.
- Tests:
  - `src/services/__tests__/CurrencyService.test.ts`
  - `src/services/__tests__/AchievementService.test.ts`
  - `src/services/__tests__/GameLoader.test.ts`

## Install & Run
1) Install dev dependencies:
```
npm install -D jest ts-jest @types/jest jest-environment-jsdom
```
2) (Optional) Initialize ts-jest config if you want a generated file:
```
npx ts-jest config:init
```
3) Run tests:
```
npm test
# or
npm run test:watch
```
4) Coverage:
```
npm test -- --coverage
```

## Notes & Tips
- Environment: Tests run in `jsdom` so `window`/`localStorage` are available. We reset storage in `jest.setup.ts`.
- Path alias: `@/*` resolves to `src/*` via `moduleNameMapper` in `jest.config.js`.
- Adding tests: Prefer unit tests for pure logic (services, utils). For canvas-heavy games, unit test calculations and state, and keep rendering under small integration tests or manual QA.
- Audio tests: `AudioManager` is browser API–heavy; mock `AudioContext` if needed or assert interaction points only.
- Keep tests fast, deterministic, and side-effect free (mock time, randoms, and network when introduced).

