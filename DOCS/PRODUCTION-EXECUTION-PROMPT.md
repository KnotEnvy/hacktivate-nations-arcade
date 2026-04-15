# HacktivateNations Arcade Production Execution Prompt

Copy the prompt below into a new coding session when you want another model to continue the work from the current repo state.

---

You are taking over the `HacktivateNations Arcade` repository. Your job is to execute the next production-readiness work in code, not just describe it.

## Repo

- Project root: `D:\JavaScript Games\HacktivateArcade\hacktivate-nations-arcade`

## Read First

Read these before making assumptions:

1. `AGENTS.md`
2. `README.md`
3. `DOCS/START-HERE.md`
4. `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md`
5. `DOCS/ActionPlan.md`
6. `DOCS/UserSystemsHandoff.md` if the task touches auth, persistence, Supabase, or progression sync
7. `DOCS/AUDIO-SYSTEM-HANDOFF.md` only if the task touches the audio/music system
8. `package.json`
9. `tsconfig.json`

Then inspect the code directly. Treat the code as the source of truth when docs conflict.

## Current Verified State

As of April 14, 2026:

- `npm run lint` passes
- `npm run type-check` passes
- `npm run build` passes
- unregistered catalog games are gated as coming soon and cannot be purchased or launched
- incomplete PWA/install metadata has been removed
- unlock persistence lives in `src/hooks/useArcadeUnlockState.ts`
- unused Zustand stores were removed
- `next.config.ts` no longer bypasses lint during build

## Do Not Re-Solve These

These have already been addressed:

- TypeScript build blockers from the earlier Phase 1 pass
- case-sensitive import mismatch around `achievements.ts`
- missing `SoundName` aliases / missing `InputManager` compatibility methods
- Supabase resend-email typing issues
- Jest setup typing cleanup
- catalog purchase/play safety for unregistered games
- misleading PWA manifest/install claims
- repo-wide ESLint backlog that was blocking `next build`

Do not spend the session re-auditing those unless you find a real regression in code.

## Mission

Continue moving the project toward production readiness by executing the highest-value remaining work from `DOCS/ActionPlan.md`.

Do the work in the repo. Do not stop at analysis unless you hit a real blocker.

## Highest-Priority Remaining Work

1. Add server-trust boundaries for economy, achievements, challenges, and leaderboard-sensitive writes.
2. Improve offline retry/outbox behavior for Supabase sync.
3. Continue reducing `ArcadeHub.tsx` complexity and tighten progression/reward ownership.
4. Replace string-matching challenge logic with typed requirement logic.
5. Expand tests and CI coverage around auth, persistence, unlocks, progression, and sync.

## Important Context

- The arcade already exists and is feature-rich.
- The project has 27 catalog entries and 17 currently registered playable games.
- The next team should assume the main work is hardening and consolidation, not greenfield feature invention.
- If docs conflict with the code, trust the code and then update the docs.

## Execution Rules

- Be autonomous and keep moving until the current phase is materially advanced.
- Make code changes directly when the path is clear.
- Run verification after changes.
- Keep changes focused and production-oriented.
- Preserve existing functionality unless you are explicitly fixing it.
- If you touch auth, persistence, sync, or progression ownership, update `DOCS/UserSystemsHandoff.md`.
- If you materially change overall repo state or priorities, update `DOCS/PROJECT-RELEARN-HANDOFF-2026-04-13.md` and `DOCS/ActionPlan.md`.
- If you hit an external blocker, document it clearly and continue with non-blocked work.

## Deliverable Style

When you finish a work session:

1. summarize what changed
2. list what you verified
3. list what remains
4. update the relevant handoff doc if the repo state materially changed

## Definition Of Success

This handoff is successful only if you materially reduce production risk in code, not just in prose.

Start by reading the listed files, inspecting the repo, running verification, and then executing the highest-priority remaining work.

---
