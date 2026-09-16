# Arcade Shell — Design System & UI Handoff

Last updated: September 8, 2026
Supersedes the original "UI/UX Review & Design Suggestions" draft, whose
retro-CRT direction (scanlines, chromatic aberration, pixel display fonts) was
reviewed and **not adopted**. The shell now commits to a clean modern dark
direction: a console-storefront look where colour carries information, type and
spacing carry hierarchy, and motion is short and purposeful.

This document covers the **harness** — everything outside an individual game.
Each game still owns its own internal art direction.

---

## 1. Where the theme actually lives

Tailwind v4 is configured through `@theme` in `src/app/globals.css`. There is no
`@config` directive, so **`tailwind.config.mjs` was never being read** — its
`arcade.*` colours, `shadow-neon`, the `xs` breakpoint and the `primary-*` /
`secondary-*` ramps used by `Button` were all silently dead classes. That file
has been deleted; add new design tokens to the `@theme` block instead.

Every token there becomes a real utility: `--color-surface-2` gives
`bg-surface-2` / `border-surface-2`, `--radius-panel` gives `rounded-panel`,
`--shadow-pop` gives `shadow-pop`, `--font-display` gives `font-display`.

## 2. The palette

One neutral ramp plus one brand accent. Colour is information, never decoration.

| Role | Tokens | Meaning |
| --- | --- | --- |
| Ground | `canvas`, `canvas-deep` | The page and anything behind a modal |
| Surfaces | `surface`, `surface-2`, `surface-3` | Panels, inset tiles, hover/raised |
| Structure | `line`, `line-strong` | Hairline borders. Borders never glow |
| Text | `ink`, `ink-muted`, `ink-faint` | Primary, secondary, tertiary |
| Action | `brand`, `brand-bright`, `brand-dim` | The primary action, and only that |
| Currency | `coin`, `coin-dim` | **Always** coins — never used decoratively |
| Earned | `good`, `good-dim` | Completed, unlocked, synced |
| Problem | `bad`, `bad-dim`, `warn` | Errors, failed sync, destructive actions |

Depth comes from surface value, not from drop shadow. Shadows are soft and
low-contrast (`shadow-panel`, `shadow-raised`, `shadow-pop`).

## 3. Type

- `font-sans` (Inter) runs the UI.
- `font-display` (Orbitron) is display-only: the wordmark, section headings,
  and large numerals.
- `font-mono` (JetBrains Mono) is for values.
- **Any number a player reads gets the `.tabular` class** so live scores and
  balances stop jittering as they tick.

Emoji are no longer used for navigation or controls — `src/components/ui/Icon.tsx`
is a stroke-based set on a 24×24 grid. Emoji remain only where they are content
(player avatars, achievement icons).

## 4. Primitives

Build new surfaces from these rather than hand-rolling Tailwind strings:

| Component | Use |
| --- | --- |
| `ui/Panel` | `Panel`, `PanelHeader` (eyebrow/title/description/actions), `EmptyState` |
| `ui/Button` | `primary` \| `secondary` \| `ghost` \| `outline` \| `coin` \| `danger`, sizes `sm/md/lg`, `block` |
| `ui/Chip` | `Chip` (toggleable filter, optional count) and `Tag` (static status label) |
| `ui/ProgressBar` | Any progress readout; handles clamping and ARIA |
| `ui/StatTile` | Labelled headline number with optional footer slot |
| `ui/Icon` | The icon set |
| `ui/Menu` | `Menu`, `MenuItem`, `MenuLabel`, `MenuSeparator` — click-away popover |
| `ui/AccessibleDialog` | Focus-trapped modal shell (unchanged) |

One primary action per view. If two things are violet, one of them is wrong.

## 5. The game selection screen

`GameCarousel` (one horizontally scrolling row per tier, with arrow buttons) has
been replaced by `GameLibrary`. Structure, top to bottom:

1. **Featured card** — "Jump back in" (most recently played), else "Start here"
   (an unlocked game not yet tried), else "Next unlock" (cheapest affordable).
2. **Toolbar** — search across title/id/category/tagline, plus a category select.
3. **Status chips** — All / Ready to play / Locked / In development, each with a
   live count.
4. **Tier shelves** — one section per tier with a header carrying the tier name,
   open/locked state, unlock progress and the tier-unlock or next-game price.
   Locked tiers still show their games (dimmed, with the price) so players can
   see what they are working toward, instead of the old opaque overlay.
5. **Responsive card grid** — 1/2/3/4 columns.

Browsing rules live in **`src/lib/gameLibrary.ts`**, not in the component:
`buildGameEntries` derives a status per game (`playable` / `affordable` /
`short` / `tier-locked` / `coming-soon`), and `filterEntries`, `sortEntries`,
`groupByTier`, `pickFeatured` and `countByStatus` build the view model. Change
browsing behaviour there and the tests in
`src/lib/__tests__/gameLibrary.test.ts` will tell you what you broke.

Catalog entries in `src/data/Games.ts` now carry `category` (the filter and card
label) and `tagline` (the one-line pitch used on dense cards). **Fill both in for
every new game.** Tier display names live in `TIER_LABELS` in
`src/lib/constants.ts`.

### Stable test ids

`game-library`, `library-featured`, `library-search`, `game-card-<id>` (which
also exposes `data-status`), `game-play-<id>`, `game-unlock-<id>`,
`tier-unlock-<tier>`.

## 6. The hub shell

`ArcadeHub` no longer renders its own chrome. It is composed from:

- **`HubHeader`** — wordmark, section nav (in-header on `lg+`, a scrolling row
  below on smaller screens), and the right cluster: sync status, coin balance,
  player badge, overflow menu. Help, audio settings, full instructions, sign out
  and the development actions all moved into that overflow menu, which replaced
  five competing header buttons. `ArcadeTab` and `ARCADE_TABS` are exported here.
- **`SyncStatus`** — the queued-sync wall of text is now one chip that states
  severity, with the detail and the retry action behind a popover.
- **`HubNotifications`** — toasts, now dismissible.
- **`HubGate`** — `AccountLoading`, `AuthUnavailable`, `SignInGate`.

## 7. The run shell

`ThemedGameCanvas` keeps the game-over race fix and the `touchAction: 'none'`
canvas guard, and gains a real run lifecycle:

- A run bar with the title, live score/coins (tabular) and one control.
- Ready / paused / ended overlays on a blurred backdrop.
- **An end-of-run summary** (score, coins earned, run time) with *Play again*
  and *Back to hub*. Previously a finished run showed a dead-end panel with no
  way forward — that was the biggest flow gap in the harness.

Per-game themes (`src/lib/gameThemes.ts`) still exist but now have exactly one
job in the harness: tinting the canvas frame via the `--game-accent` custom
property. The per-theme gradient chrome, scanline overlay and injected
`styled-jsx` block are gone.

## 8. Reviewing the UI without Supabase

The hub sits behind auth, so the menus cannot be inspected locally without a
live Supabase project. `npm run dev` now also generates **`/dev/hub-preview`**
(from `src/dev/hub-preview/HubPreview.tsx` via `scripts/sync-dev-routes.js`),
which mounts the real components against fixed mock state:

- New player / mid progression / deep progression
- Sign-in gate
- Run shell (a stub `GameModule`, so the ready/paused/ended states are reachable)
- Notification toasts

Like the other dev routes it is removed before `type-check`, `lint` and `build`,
so it never ships. Use it for screenshots and layout review in future UI passes.

## 9. Known follow-ups

- ~~`WelcomeBanner`, `LeaderboardPanel` and `GameThemePreview` are unused.~~
  Deleted in the September 16, 2026 repo cleanup; recover from git history if
  any of them is ever wanted back.
- The `coming-soon` thumbnail asset is a plain grey "COMING SOON" box, so cards
  for unbuilt games render an icon placeholder instead of the image. Real
  roadmap art would be better.
- `AudioSettings` (1,809 lines) still carries its own bespoke styling and was
  out of scope here; it is the last major surface not on the design system.
