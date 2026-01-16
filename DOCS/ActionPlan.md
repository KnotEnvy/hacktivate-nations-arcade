# HacktivateNations Arcade - Deployment Readiness Action Plan

Last updated: 2026-01-10

## Scope
Prepare the current arcade build for a public deploy with secure persistence, offline support, and measurable performance.

## Immediate blockers (must fix before public beta)
- [ ] Rotate Supabase keys, remove committed `.env`, and store secrets in deployment env vars only.
- [ ] Prevent players from spending coins on unregistered or "coming soon" games (hide or disable purchase/play).
- [ ] Add server-side validation for economy, leaderboards, and achievements (Edge Function or Supabase RPCs).
- [ ] Implement offline PWA shell caching and add required PWA assets (icons + screenshots).

## Core parity with PRD
- [ ] Move daily/weekly challenge generation to server-seeded assignments with consistent schedules.
- [ ] Add PostHog analytics integration and wire feature flag gating.
- [ ] Implement InputManager gamepad support and validate input schemas per game.
- [ ] Add i18n scaffolding under `/public/i18n` and replace hard-coded UI strings.

## Quality gates and CI/CD
- [ ] Add GitHub Actions: lint, type-check, unit tests, Playwright, and coverage threshold enforcement.
- [ ] Add Lighthouse CI with PWA + performance thresholds and OWASP dependency scan.
- [ ] Create a release checklist for Vercel preview and production deploys.

## Performance and stability
- [ ] Enforce per-game asset budgets with a build-time size check.
- [ ] Add offline fallback UI and retry queue for Supabase writes.
- [ ] Add error tracking (Sentry or equivalent) and alerting.

## Launch checklist
- [ ] Provision production Supabase project and apply `supabase/001_init.sql`.
- [ ] Configure Vercel env vars and verify no secrets are exposed to the client bundle.
- [ ] Run full regression: `npm run lint`, `npm run type-check`, `npm test`, `npm run e2e`.
- [ ] Validate PWA install, offline mode, and leaderboard persistence on a clean device.
- [ ] Publish privacy policy and terms (if public analytics/auth is enabled).

## Post-launch follow-ups
- [ ] Expand challenges/achievements to cover non-runner games evenly.
- [ ] Add real-time events or multiplayer path decision (Supabase Realtime vs custom).
- [ ] Revisit economy tuning with live analytics.
