# Vercel Production Deployment Runbook

Last updated: July 12, 2026

Use this when preparing the final preview and production deployment for HacktivateNations Arcade.

GitHub Pages is not a supported deployment target for this application. The trusted progression route requires a Next.js server runtime and a server-only Supabase service-role key.

## Current Platform Launch State

- The app is a signed-in-only product flow; guest gameplay/profile paths are retired.
- `/` renders a lightweight boot shell, then dynamically loads the full arcade hub.
- Supabase auth/sync clients and procedural audio load after hydration/session/audio use instead of shipping in the first route payload.
- Public password signup and magic-link access are available when enabled in Supabase Auth.
- Authoritative progression tables are read-only to browser clients; trusted mutations use server-only RPCs.
- Offline mutation queues are account-bound and cannot replay into a different signed-in account.
- Next.js is pinned to the patched 15.5 maintenance line, and CI blocks high/critical production audit findings.
- `supabase/003_lock_down_progression.sql` must be applied to the existing project before deployment.

## Create The Vercel Project

1. In Vercel, import `KnotEnvy/hacktivate-nations-arcade`.
2. Keep the framework preset as **Next.js** and the project root as the repository root.
3. Use `npm ci` for install and `npm run build` for build.
4. Deploy `master` to Production; use pull requests or branches for Preview deployments.
5. Add all required environment variables separately to Preview and Production.
6. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or prefix it with `NEXT_PUBLIC_`.

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
4. Back up any beta data, then apply `supabase/003_lock_down_progression.sql` once to the existing project.
5. Do **not** apply `supabase/001_init.sql` to an existing project; it is a destructive clean-install baseline.
6. Confirm email/password signup is enabled if public account creation is intended.
7. Regenerate `src/lib/supabase.types.ts` after future schema changes and run a signed-in replay test.
8. Use `DOCS/SUPABASE-PRODUCTION-RUNBOOK.md` for exact SQL/RPC checks.

## Local Deploy Gate

Run this before creating or promoting the deployment:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd audit --omit=dev --audit-level=high
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
8. Create a new account and verify its wallet/player state bootstraps without direct browser database writes.
9. Verify the account hydrates wallet, unlocks, achievements, challenges, and profile data.
10. Use the game-team-approved smoke titles for the release candidate.
11. Confirm game end records trusted progression:
    - wallet changes reconcile
    - leaderboard row updates
    - achievements reconcile
    - challenge progress updates
    - account-scoped analytics stay attached to the signed-in user
12. Smoke test audio:
    - first user interaction unlocks hub music
    - Hub/Menu track browser lists `SB32 Power-On` first
    - mute, music volume, and SFX volume remain independent
13. Simulate a failed network write if possible, then reconnect and confirm queued sync drains once.
14. Sign out and sign in as a different account; confirm no cross-account local state or queued-operation bleed.

## Production Promotion Checklist

1. Confirm the preview passed local gate and signed-in browser QA.
2. Confirm Supabase Auth production callback URL is configured.
3. Confirm production Vercel environment variables point to the intended Supabase project.
4. Confirm `003_lock_down_progression.sql` was applied and direct authenticated writes to wallets/progression fail.
5. Confirm no populated `.env` files or secrets are committed.
6. Confirm placeholder leaderboard rows are either accepted for launch or removed by product decision.
7. Confirm monitoring/error tracking decision:
   - if required for launch, verify it is configured before promotion
   - if deferred, record the decision in the launch notes
8. Promote the tested preview to production.
9. Smoke test production with a real account:
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
