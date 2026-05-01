# Vercel Production Deployment Runbook

Last updated: April 30, 2026

Use this when preparing the final preview and production deployment for HacktivateNations Arcade.

## Current Launch State

- Speed Racer is complete and registered.
- `src/games/registry.ts` currently registers 17 playable games.
- The app is a signed-in-only product flow; guest gameplay/profile paths are retired.
- `/` renders a lightweight boot shell, then dynamically loads the full arcade hub.
- Supabase auth/sync clients and procedural audio load after hydration/session/audio use instead of shipping in the first route payload.
- Latest production build verification reports `/` at 103 kB first-load JS.
- No SQL changes were made during the final startup optimization pass.

## Required Environment Variables

Set these in Vercel for Preview and Production:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public client config.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in client code, screenshots, logs, or docs.
- Keep Preview and Production pointed at the intended Supabase project for that environment.
- If real Supabase keys were ever shared outside the secure deployment setup, rotate them before public launch.

## Supabase Preflight

Before deploying against a live project:

1. Confirm the target Supabase project is correct.
2. Confirm Auth redirect URLs include:
   - local: `http://localhost:3000/auth/callback`
   - preview: `https://<preview-domain>/auth/callback`
   - production: `https://<production-domain>/auth/callback`
3. Confirm `public.commit_trusted_game_session(...)`, `public.record_leaderboard_score(...)`, and `public.upsert_leaderboard_score(...)` exist.
4. If any SQL changed, apply `supabase/001_init.sql`, regenerate `src/lib/supabase.types.ts`, and run a signed-in replay test.
5. Use `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` for exact SQL/RPC checks.

## Local Deploy Gate

Run this before creating or promoting the deployment:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run build
```

Current note:

- Playwright specs should be refreshed before making `npm.cmd run e2e` a blocking launch gate. Existing specs were written for the retired guest hub flow.
- Until that refresh is complete, use signed-in manual browser QA as the launch source of truth.

## Vercel Preview Checklist

1. Push the release branch and create a Vercel preview deployment.
2. Confirm build succeeds in Vercel.
3. Confirm the preview has the intended Supabase environment variables.
4. Add the preview callback URL in Supabase Auth if needed.
5. Open the preview in a clean browser profile.
6. Verify the first screen appears quickly with the arcade boot shell before the full hub loads.
7. Sign in with a real QA account.
8. Verify the account hydrates wallet, unlocks, achievements, challenges, and profile data.
9. Play Runner and Speed Racer from the hub.
10. Confirm game end records trusted progression:
    - wallet changes reconcile
    - leaderboard row updates
    - achievements reconcile
    - challenge progress updates
    - account-scoped analytics stay attached to the signed-in user
11. Smoke test audio:
    - first user interaction unlocks hub music
    - Hub/Menu track browser lists `SB32 Power-On` first
    - mute, music volume, and SFX volume remain independent
12. Simulate a failed network write if possible, then reconnect and confirm queued sync drains once.
13. Sign out and sign in as a different account; confirm no cross-account local state bleed.

## Production Promotion Checklist

1. Confirm the preview passed local gate and signed-in browser QA.
2. Confirm Supabase Auth production callback URL is configured.
3. Confirm production Vercel environment variables point to the intended Supabase project.
4. Confirm no populated `.env` files or secrets are committed.
5. Confirm placeholder leaderboard rows are either accepted for launch or removed by product decision.
6. Confirm monitoring/error tracking decision:
   - if required for launch, verify it is configured before promotion
   - if deferred, record the decision in the launch notes
7. Promote the tested preview to production.
8. Smoke test production with a real account:
   - sign in
   - launch hub
   - play one short session
   - verify trusted progression
   - verify audio unlock
   - sign out

## Post-Deploy Watch

For the first production window, watch for:

- Auth callback failures
- RPC errors mentioning `commit_trusted_game_session`
- wallet or leaderboard writes failing independently from game completion
- queued sync count rising and not draining
- users stuck on account hydration
- audio not starting after first interaction
- unexpectedly large first-load bundle regressions

If the live schema drifts, stop app-side debugging and re-check `supabase/001_init.sql`, live RPC signatures, and `src/lib/supabase.types.ts` first.
