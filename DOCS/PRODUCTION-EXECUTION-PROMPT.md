# HacktivateNations Arcade Production Execution Prompt

Copy the prompt below into a new coding session when you want another model to continue the production-readiness work.

---

You are taking over the `HacktivateNations Arcade` repository and your job is to execute the production-readiness plan, not just describe it.

## Repo

- Project root: `D:\JavaScript Games\HacktivateArcade\hacktivate-nations-arcade`

## First Read These Files

Read these before making assumptions:

1. `AGENTS.md`
2. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
3. `DOCS/ActionPlan.md`
4. `DOCS/UserSystemsHandoff.md`
5. `package.json`
6. `tsconfig.json`

Then inspect the current codebase directly. Treat the code as the source of truth when docs conflict.

## Mission

Take this project from its current state toward production readiness by executing the phases described in `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`.

Do the work in the repo. Do not stop at analysis unless you hit a real blocker.

## Key Context

The arcade already exists and is feature-rich:

- Next.js arcade hub is working
- progression loop is implemented
- Supabase auth/sync/leaderboards are wired
- 16 games are registered and playable
- catalog contains more games than are currently registered
- procedural audio system is extensive

The main problems are hardening, cleanup, and production safety.

## Current Priority Order

Work in this order unless you find a stronger dependency:

### Phase 1: Stabilize Build And Security

1. Make the TypeScript build pass.
2. Fix case-sensitive import issues and other Windows-only assumptions.
3. Audit the catalog vs active registry mismatch and prevent users from purchasing or launching non-implemented games.
4. Audit the PWA manifest and either complete the missing asset surface or remove misleading incomplete claims.
5. Handle committed secrets correctly:
   - If you can safely remove tracked secrets and replace them with template/env guidance, do that.
   - If actual key rotation or external service updates are required, isolate that as a human action item and continue with the rest of the phase.

### Phase 2: Consolidate Platform Logic

1. Reduce `ArcadeHub.tsx` complexity where practical.
2. Decide and implement a clearer source of truth for user progression state.
3. Remove or retire duplicate/stale UI paths.
4. Replace brittle string-matching challenge logic with typed requirement logic.
5. Tighten reward-flow ownership so critical progression logic is not awkwardly split.

### Phase 3: Hardening

1. Add or improve server-trust boundaries for score/economy-sensitive flows.
2. Improve offline/retry behavior for Supabase sync.
3. Strengthen tests around auth, persistence, unlocks, and progression.
4. Add or improve project verification gates where possible.

### Phase 4: Product Polish

1. Accessibility pass for carousel, tabs, modal flows, and keyboard behavior.
2. Resolve stale user-facing copy that conflicts with actual logic.
3. Revisit placeholder leaderboard behavior.
4. Update project docs so they match the live implementation.

## Execution Rules

- Be autonomous and keep moving until the current phase is meaningfully advanced.
- Do not just write a plan and stop.
- Make code changes directly when the path is clear.
- Run verification after changes.
- Keep changes focused and production-oriented.
- Preserve existing functionality unless you are explicitly fixing it.
- If you discover stale docs, update them.
- If you hit an external blocker, document it clearly and continue with non-blocked work.

## Important Known Issues To Verify Early

At minimum, verify and address these:

- `npm run type-check` is known to fail
- case-sensitive import mismatch around `achievements.ts`
- some games reference missing `SoundName` values
- some games reference missing `InputManager` methods
- Supabase auth resend typing needs review
- Jest setup typing needs cleanup
- committed `.env` secrets are a production blocker
- `public/manifest.json` references assets that may not exist
- catalog count and registered game count do not match

## Deliverable Style

As you work:

- explain what you are fixing and why
- keep a running focus on production readiness
- surface risks and tradeoffs plainly

When you finish a work session:

1. summarize what changed
2. list what you verified
3. list what remains
4. update the relevant handoff doc if the repo state materially changed

## Definition Of Success

This handoff is successful only if you materially reduce production risk in code, not just in prose.

Start with Phase 1 immediately. Read the required files first, inspect the repo, run verification, and begin fixing the highest-priority blockers.

---
