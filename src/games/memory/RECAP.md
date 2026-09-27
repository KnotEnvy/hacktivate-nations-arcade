# Memory Match — Development Recap

Last updated: September 27, 2026

Memory Match is one of the five free tier-0 games. Before this pass it was the
barest game in the tier: one 4x4 board of flat rectangles with Unicode glyphs,
and the run ended when that board did. This file records what it is now, why,
and where the edges still are.

---

## What the game is now

A run is a **ladder of five tables**, each one bigger than the last. Clearing
the fifth ends the run. The player can also stop at any time through the shell.

| Table | Name | Grid | Pairs | Par (moves) | Clock / par time |
| --- | --- | --- | --- | --- | --- |
| 1 | The Parlour | 3x4 | 6 | 9 | 45s |
| 2 | The Salon | 4x4 | 8 | 11 | 60s |
| 3 | The Library | 4x5 | 10 | 15 | 80s |
| 4 | The Conservatory | 5x6 | 15 | 20 | 110s |
| 5 | The Grand Room | 6x6 | 18 | 23 | 140s |

Par is pairs + 3 on the first two tables and pairs + 5 after that. The clock
column is the TIMED countdown, and in both modes it is also the par time for
the time bonus.

**Two modes**, chosen on the opening card:

- **CLASSIC**: no clock; bests are kept by fewest moves.
- **TIMED**: each table has its own countdown. When the sand runs out, the run
  ends and the score is kept.

**Scoring.** A match pays `100 + 20 × (matches already in the streak)`, so a
run of matches pays +100, +120, +140 and so on (the slip reads "+140 · STREAK
3"). A miss resets the streak. The streak carries from one table to the next.
Each table clear pays a par bonus of `150 × table` if moves ≤ par, and a time
bonus of `max(0, clock − seconds) × 2` in both modes. PEEK costs 30 and HINT
costs 15. The score never goes below zero. `pickups` = matches made.

**Power-ups (two).**

- **PEEK** turns every hidden card face up for 1.0s, then face down again.
  Once per table.
- **HINT** shows one pair for 0.6s and then has an 8s cooldown. If one card is
  already turned up, HINT shows *its partner* instead, because that is the
  question the player is actually asking.

SHUFFLE is gone because it punished memory, which is the whole game. Both
power-ups are closed while a pair is being judged, while a reveal is showing,
and during every beat.

### The run, phase by phase

`mode` → `deal` → `ready` → `play` → (`clear` → `deal` → …) → `finale` → `endGame()`

- **mode**: the opening card. It names the controls and offers the two modes.
  It waits for a choice (see "Deviations" below).
- **deal**: the next table's deck sits on the baize to the left of the grid.
  Cards fly to their slots in a short arc, with one `click` each, rate-limited
  to one every 0.07s. A placard reads "NOW DEALING · TABLE 2 · THE SALON · 8
  pairs · par 11 moves".
- **ready**: "YOUR TURN". It ends on the first input (which is also acted on)
  or after 1.0s. The clock does not run until it ends.
- **play**: the table.
- **clear**: a 1.6s beat. The last pair pops, `win` plays, and a placard shows
  the table, moves vs par, time and both bonuses, plus NEW BEST when earned.
  After 0.5s the cards sweep away to the right, staggered, and fade. Then the
  next table deals.
- **finale**: a 1.6s beat, then `endGame()`. A five-table win sets
  `endGameSound = 'win'` and `endGameOutcome = 'completed'` first. A time-out
  keeps the defaults (`game_over`, `died`), and `restart()` puts them back.
  - After table 5 it reads "ALL FIVE TABLES" with three bursts of confetti.
    The title is "PERFECT RUN" only if every table was at par, otherwise
    "EVERY PAIR FOUND".
  - When the clock runs out it reads "OUT OF TIME". Every card still on the
    table turns face up in a wave, so the player sees what was left.
- **ended**: `onRenderEnded` draws the table as it was left, with the final HUD
  and the finale placard, dimmed 55%. It is static.

`restart()` returns to the mode card with the last mode pre-selected and
every timer, system and entity reset.

---

## Bugs this pass fixed

| Bug | Effect on the player |
| --- | --- |
| Input was level-triggered (`isMousePressed` / touches polled every frame) | Holding the button turned every card the cursor crossed; a drag turned two cards at once |
| Digit keys 1/2/3 and M were polled every frame | Holding "2" rebuilt the board sixty times a second; holding M toggled the mode on and off. Neither was shown anywhere |
| The base HUD was left on | `Score:` / `Coins:` were drawn over the top-left card, and the game's own stats list ran down over the first column |
| The flip advanced inside `onRender` at a fixed 1/60 | Cards turned at a speed tied to the display (faster at 144Hz, slower when frames dropped) |
| Hint and Reveal-3 used `setTimeout` | A hint turning its cards back 0.6s later could turn down a card the player had just turned. The timers also ran through pause and after the run ended |
| Level time came from `Date.now()` | Time paused or in a hidden tab counted toward completion time and Speed Demon |
| The run ended after one board | Nothing to climb, and "Complete 10 levels" could not be reached |
| `perfect_levels` / `fast_completion` were computed for the whole run as one level | "Perfect" meant moves = pairs over the whole run, and a perfect board was counted twice (once on clear, once in `onGameEnd`) |
| `levels_completed` was reported as `completed + 1` to analytics | Every run claimed one more level than it had cleared |
| Card faces were Unicode glyphs in Arial | They looked different on every OS, and several were missing on Android |
| The timed mode's clock was never reset between boards and had no visible switch | The mode could not be found, and once found it was unfair |

---

## The studio: Lamplit Parlour

I imagined Memory Match as the work of a two-person studio that makes quiet
tabletop games, the kind you play at a card table late at night under one
lamp. Their taste is tactile and unhurried: materials rather than screens,
one light source, ink on paper. On screen that shows as:

- plum baize lit from above, with a padded leather rail with stitching
  instead of HUD panels;
- ivory card stock, with jewel-tone backs that change colour and pattern at
  every table;
- icons that look hand-inked: a flat fill, a dark outline, one highlight;
- cards that move like paper. They are dealt in an arc from a stack, they turn
  with a glint as they pass edge-on, and they are swept off the table at the
  end.

The chrome is **engraved into the rails**, not floated over the game. There are
no chips and no panels. Announcements are ivory placards set down on the baize
and printed in ink, the way a dealer lays down a card. The studio's one
ornament is a small rose rhombus. It is the mark on every card back, the bullet
on every label, and the corner studs of the table inlay. The streak is a
candle flame. Timers are an hourglass whose sand really drains. The copy is a
soft-spoken dealer: "Your turn. Turn any two cards." "Not a pair. Remember
them." "The sand ran out." The sound vocabulary is paper and a bell:

| Moment | Sound |
| --- | --- |
| A card turns; each card dealt | `click` |
| A pair | `success` |
| A miss | `error` |
| A table clear | `win` |
| PEEK | `whoosh` |
| HINT | `powerup` |
| Each of the last five seconds | `click` |
| The end of the run | `win` after all five tables; the platform's `game_over` after a time-out |

## Art direction

| Element | Treatment | Why |
| --- | --- | --- |
| Palette | Plum baize `#2a1426` lit to `#4a2742`; leather rail `#1c0e19`; ivory `#f4ecdc`; ink `#2a1b26`; studio rose `#f2a6c2` | Warm and dark, so the ivory cards are the brightest thing on screen. Amber (currency) is never used; emerald means solved and red means a miss or low time |
| Table | Cached once per layout: radial lamp light, a warm pool from above, 2,600 fixed nap fibres from a seeded LCG (no shimmer), a vignette, an inlaid hairline with rhombus studs around the grid, and rail shadows | Depth from light, not from glow; static, so it is painted once |
| Backs | Oxblood, bottle teal, ink indigo, moss, midnight plum (one per table); lattice on odd tables, diagonal stripe on even; an ivory inner frame, the rhombus medallion, a light edge and a top sheen | The table change is visible before a card is turned |
| Faces | Cream stock with a hairline inner frame and the icon at ~74% of the width. Corner pips (one rotated 180°) when the card is at least 72px wide | Reads as a real card at 3x4 and stays clean at 6x6 |
| Icons | 19 vector icons: star, heart, moon, sun, bolt, leaf, drop, flame, note, clover, anchor, key, gem, bell, planet, fish, cherry, snowflake, crown. Each has its own colour and a distinct silhouette | Shape alone separates every pair, which matters for colour-blind players. Table 5 draws 18 of the 19 at random |
| Turn | 3D scale-x with a slight vertical swell, a 2px lift, a contact shadow that stays on the baize, and a highlight band that sweeps across as the card passes edge-on | Weight and a glint rather than a flat squash |
| Match | Both cards pop to 1.08, an emerald outline pulses once, rings burst and sparks fly, and a score slip rises. At a streak of 3 or more there is a short confetti spray | Then the card settles under a plum wash with an emerald check badge, so it still reads as solved |
| Miss | Both cards shake 4px for 0.25s with a red edge, which stays until they turn back 0.7s later | |
| Hover / cursor | Hover lifts 2px with a rose edge. The keyboard cursor adds rose corner brackets | |

Every face and back is painted once per size into an offscreen canvas
(`CardArt`), and the table is cached per layout (`TableRenderer`). No
`shadowBlur` is used anywhere. Effects are capped at 12 rings, 120 sparks, 90
pieces of confetti and 5 slips, and are clipped to the baize so nothing lands
on the rails.

---

## Controls

| Where | Touch / mouse | Keyboard |
| --- | --- | --- |
| Mode card | Tap / click CLASSIC or TIMED | ← → (or ↑ ↓, A D, W S) to choose, Space / Enter to deal |
| Table | Tap / click a card. It turns on **release**, and only if the press began on the same card | Arrows / WASD move the cursor (the first press shows it), Space / Enter turns the card |
| Power-ups | Tap / click the PEEK or HINT plate on the bottom rail | P peek, H hint |

All edges come from `PressTracker`, which is updated once per frame. There
is no pause handling in the game; the shell owns pause. The mode card only
accepts a *fresh* Space/Enter. The shell's Start button answers Enter on
key-down, and a key still held from that press must not pick a mode for the
player.

The manifest's `inputSchema` is now `['touch', 'keyboard']` (see "Requested
shared changes").

## HUD layout

- **Top rail (56px), left:** SCORE in Orbitron, then BEST MOVES or BEST TIME
  for this grid and mode, in mono. Before the first point, SCORE shows the
  rail's faint dash; so do MOVES before the first move, and BEST and STREAK
  when empty. The rail says "nothing yet" one way everywhere.
- **Top rail, centre:** three columns separated by hairlines. TABLE `n/5`;
  MOVES `n / par p` (the par figure fades when you are over it); TIME (CLASSIC,
  elapsed) or CLOCK (TIMED, remaining) with a drawn hourglass. In TIMED the
  sand drains, and under 10s the figure and hourglass turn red with a pulsing
  red edge.
- **Top rail, right:** STREAK. A rose candle flame and `×n` from 2 up; the
  flame grows with the streak. Below 2 it shows a faint dash.
- **Bottom rail (60px), left:** the dealer's line, which says what just
  happened or what to do.
- **Bottom rail, centre:** the PEEK plate (a drawn eye) and the HINT plate (a
  drawn oil lamp, the studio's mark). Each shows its cost and use, a keycap
  (hidden on touch), and a rose cooldown rail. A plate dims when it cannot be
  used.
- **Bottom rail, right:** PAIRS `n/N` and one tiny card per pair, filled ivory
  as it is won.
- **Placards (beats only):** NOW DEALING / YOUR TURN; TABLE n CLEARED; ALL
  FIVE TABLES / OUT OF TIME.

The grid always sits between the two rails; a test pins this for all five
tables.

---

## Deviations from the brief (and why)

- **The opening card waits for a choice.** The contract's READY beat ends
  after ≤2s. This card carries the CLASSIC / TIMED choice the brief puts
  there, and a choice on a timer punishes reading it. It remembers the last
  mode (`memory_last_mode`), so a returning player only presses Space or taps.
  Every *per-table* ready beat ends on first input or after 1.0s.
- **"LEVEL" is "TABLE",** and each table has a name. That is the studio's
  voice; the number and `/5` are always shown.
- **"PERFECT RUN" is kept for a run where every table was at par.** A
  finished run that was not perfect reads "EVERY PAIR FOUND". Calling every
  finished run perfect would cheapen the word.
- **HINT with one card turned up shows that card's partner** rather than a
  random pair.

## Verifying it

```bash
npx jest --config jest.dev.config.js --runInBand src/games/memory
```

`__tests__/memory.rules.test.ts` has 39 tests, which pin rules and not tuning
numbers.

**Input**
- a card turns once, on release, however long the button is held
- a press dragged across the table never turns a card
- a finger tap turns a card, and tapping the PEEK plate uses peek
- a key held from the shell's Start does not pick a mode; a fresh press does
- clicking a mode ticket starts the run and remembers the mode
- the old digit presets and M do nothing
- a held H fires once
- the arrows move a cursor and Space turns the card under it

**Chrome**
- the base HUD is off
- a headline figure is never drawn as a bare zero in the display face
- every table's cards sit between the rails, and the plates sit in the bottom
  band
- effects are capped

**Time**
- the turn advances in update and never in render
- no `setTimeout` or `Date.now` is touched while a table is played
- a table is timed in play seconds

**Pairs**
- a match stays and scores
- a mismatch turns back after the hold and not before
- scoring is 100 + 20 per match already in the streak
- a matched card never turns again (click, peek and hint)

**Locks**
- no card and no power-up during the deal
- no third card and no power-up while a pair is judged
- no card while a peek is showing

**PEEK / HINT**
- peek is once per table and costs 30
- hint waits out its cooldown
- the score never goes below zero
- peek and hint each restore *exactly* the face state they found, including a
  card the player is holding

**Ladder**
- 3x4 → 4x4 → 4x5 → 5x6 → 6x6, then a finale beat, then the run ends
- a won run ends on `win` / `completed`, a timed-out run on
  `game_over` / `died`, and restart restores the defaults
- the clear beat plays before the next deal
- the ready beat ends on first input or within 2s
- par and time bonuses are paid on a clear
- bests keep the legacy key

**TIMED**
- reaching zero ends the run and keeps the score
- the clock holds during the clear beat and the deal

**Stats**
- `perfect_levels` counts per table at par
- `fast_completion` is the fastest table under 30s, and 0 when none was

**Restart / ended**
- restart resets every timer, system and entity
- the ended frame draws without advancing anything

`__tests__/memory.playability.test.ts` has 4 tests. A seeded *average*
player drives the real game. It remembers a seen card 60% of the time,
forgets a little every move, and spends 1.1s on each card. It must:

- climb all five CLASSIC tables;
- clear at least two TIMED tables in three minutes;
- lose when it plays TIMED with no memory at 3s a card, so the sand is real;
- earn a bounded payout in a three-minute sitting.

The input tests were mutation-checked. Making card turns level-triggered
again fails both input tests. The bare-zero test was checked the same way:
drawing a score of 0 as a figure again fails it.

### Looking at it

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PLAYWRIGHT_PORT=3104 \
CAPTURE_GAMES=memory npx playwright test tier0-capture --project=chromium
```

This writes 21 scenes plus a loupe to `.captures/tier0/memory/`:

- mode card, dealing, your-turn, fresh table
- hover lift, mid-flip (the sweep), one flipped
- match pop, mismatch shake, streak 3 (slip and confetti)
- peek, hint, table clear, table 4 with cursor and solved cards
- table 5 peeked (every icon at its smallest size)
- timed under 10s, time-out wave, ended (time)
- perfect-run finale, ended (cleared)
- a 3-card loupe (two faces, one back): `20-loupe-zoom.png`

## Payout estimate

Coins = `floor(score / 100) + matches × 10`. From the playability bot (15
seeded runs of the average player, CLASSIC, three minutes):

| Player | Tables cleared | Matches | Score | Coins |
| --- | --- | --- | --- | --- |
| Average (60% recall, 1.1s a card) | 3 | 24–34 (≈27) | 2,700–5,900 (≈3,500) | **267–398, mean ≈ 308** |
| Weaker (40%, 1.5s) | 2–3 | ≈18 | ≈2,200 | ≈ 210 |
| Stronger (85%, 0.8s) | 4 | ≈40 | ≈5,200 | ≈ 447 |

TIMED pays the same in three minutes for the average player, whose clock
never ran out. A complete five-table run (57 matches) pays **about 640
coins** and takes the average player about 5.6–5.8 minutes.

Roughly 88% of the payout is `matches × 10`, because Memory's "pickups" are
matches by design. If the tier needs Memory lower, that is the lever, not the
score.

---

## Still open

- The recall ghost (a faint icon on the back of a card you have seen before)
  shows for 0.15s during the first half of the turn. It is subtle by design,
  but at a 0.2s turn it is close to invisible. It could be longer, or shown on
  hover instead, but that becomes a real memory aid and changes the game.
- The 6x6 cards are 54x68. Every icon reads at that size (scene 14), but the
  check badge on a solved card is small.
- The time-out finale does not distinguish "ran out mid-pair" from "ran out
  between moves". Both reveal the table.
- The loupe capture (`20-loupe-zoom.png`) picks up the Next.js dev badge in
  its bottom-left corner. That comes from the harness page, not the game.

## Requested shared changes

All handled by the lead on September 27, 2026:

1. `src/data/Games.ts` lists memory as `['touch', 'keyboard']`.
2. `memory_speed_demon` now checks `fast_tables >= 1`, and the hub passes
   `fast_tables` through. The old requirement, `fast_completion >= 30`, could
   never be met.
3. `memory_master` is now "clear all five tables in one run"
   (`levels_completed >= 5`).
4. `BaseGame` gained `endGameSound` / `endGameOutcome`. Memory sets `win` /
   `completed` on the five-table finale.

Still open, not mine: the Tap Dodge block in
`tests/e2e/tier0-capture.spec.ts` is not Prettier-clean (its `07b-loupe-ship`
screenshot call). The memory block is.
