# Snake — Development Recap

Last updated: September 27, 2026

Snake is one of the arcade's free tier-0 games. Before this pass it played
like a decent 2015 web snake, with square segments hopping a cell at a time
and an Arial HUD painted over the board. Several of its rules were also
quietly broken. This file records what the game is now, why each change was
made, and what is still open.

---

## What it is now

The game is a 31x19 terrarium board with 24px cells, sitting in its own band
between a 64px HUD strip and a 44px power-up strip. The snake is drawn as one
continuous animal that glides between cells. Its head turns smoothly, the
tongue flicks, and a swallow bulge travels down the body after each apple.
The body sheds a skin when a life is lost.

A run goes through these states:

1. **READY.** A specimen card names the controls. The run starts on the
   first turn, a tap, or after 2s. The first apple sits straight ahead, so
   even doing nothing eats one.
2. **PLAYING.**
3. **HIT.** The game freezes for half a second: the board shakes, a red
   vignette appears, and the cell that was hit flashes.
4. **RESPAWN.** The snake hatches again at the centre and waits for a turn.
5. **DYING.** The body pops from head to tail and the bed goes red.
6. **ENDED.** The shed skin lies on a dimmed board under the shell's
   summary.

**Pace** is a ladder of five named tiers. Each one is announced with a
banner, a board flash and a HUD scale:

| Tier | Name | Apples eaten | Steps / s |
| --- | --- | --- | --- |
| 1 | GARTER | 0 | 7 |
| 2 | RACER | 5 | 8.5 |
| 3 | WHIPSNAKE | 12 | 10 |
| 4 | KRAIT | 20 | 11.5 |
| 5 | MAMBA | 30 | 13 (hard cap) |

**Scoring:**
- An apple is worth 10 points and a coin 25, both multiplied by the feast
  combo.
- The feast combo is a chain of bites less than 3s apart: x1.5 at 2 bites,
  x2 at 4, x3 at 7 and x5 at 11.
- A power-up is worth 30 points.
- Pace pays (tier + 1) points per second while the snake is moving.

**Five power-ups,** each shown as a drawn icon in its own coloured ring and
each with a visible effect on the board:

| Power-up | What it does | How it shows |
| --- | --- | --- |
| WRAP | The walls open for 8s | Glass edges glow violet |
| SLOW | Pace x0.6 for 6s | The bed frosts |
| DOUBLE | +2 length per apple for 7s | Orchid dorsal stripe |
| MAGNET | Coins within 4 cells slide in, one cell per step, for 8s | Field rings around the head |
| GHOST | Pass through yourself for 5s | Pale, spectral body |

Endless play remains the only mode. Milestone banners at LENGTH 20 / 40 /
60... give a run a shape.

## Bugs this pass fixed

The first eight are the brief's must-fixes. The rest were found while
fixing those and are pinned too.

| Bug | Effect on the player |
| --- | --- |
| Survival score was `Math.floor(dt * 2)`, always 0 | Dead code. Now **pace pays**: (tier + 1) points per second while moving, accrued as a float so 30fps and 144fps pay the same, and nothing is paid on READY, during a hit or while waiting to respawn |
| No turn queue; turns were checked against the last *moved* direction | "Up then left" inside one step dropped the left, and most deaths of a good player came from it. There is now a 2-deep queue, each turn is validated against the previous *queued* direction, a 180 is never accepted, and keys and swipes both feed it. Two keys on one frame are ordered so neither is lost |
| Losing a life froze the snake nose-first into the wall | An idle player lost all three lives in ~4s. Now there is a 0.5s hit-stop, then a hatch at the centre at `max(3, floor(len/2))`, laid out behind the head and facing the most open room (ties face away from the hit). It waits for a turn (or 1.5s), then gets 1.5s of invulnerability during which walls steer it and its own body is passable. Score, coins and the board persist; the combo breaks |
| Speed uncapped (+0.05/apple, +0.002/step) | Long runs outran any human. Five named tiers now, hard-capped at 13 steps/s, each announced |
| `Date.now()` drove the head, blink and rainbow | Animation ignored pause and was not reproducible. Everything now runs on `gameTime` |
| Magnet could drag a coin onto the snake, food or a power-up | Coins were hidden under the neck. A pull never lands on an occupied cell: it tries the other axis, else waits. A coin pulled into the head is eaten and slides into the mouth |
| Base HUD overlapped the board | Score sat on the top-left cells. Now in bands: 64px HUD, framed board, 44px pods. Nothing but in-board effects is drawn over the bed |
| WRAP expiring next to a wall was an instant hit | The pod now blinks and ticks (`click` at 2.0 / 1.5 / 1.0 / 0.5s), and WRAP leaves 0.5s of wall grace. GHOST gets the same 0.5s grace for the same reason |
| Spawns tried 100 random cells, then returned an occupied one | On a crowded board, apples and coins spawned *inside* the snake. Spawns now choose from the actual free cells, prefer cells not touching the head, and place nothing when the board is full |
| An apple grew the snake by 2, DOUBLE by 3 | "Double" was really x1.5. Now +1 per apple, +2 under DOUBLE |
| Moving into the cell the tail was leaving was a death | Tail-chasing, a classic legal move, killed you. The vacating tail is free unless the snake is growing this step |
| Pickups vanished a step early | The picture trails the rules by up to one step, so the apple disappeared a cell before the mouth reached it. Taken pickups stay drawn until the head arrives, and their burst, popup and sound fire then |
| Combo text and DOUBLE were amber | Amber means currency in this arcade. Only coins are amber now |
| Coin `$` and HUD in Arial; power-ups were emoji | All type is the platform's (Orbitron, Inter, JetBrains Mono). Every icon is a vector |
| Invulnerability was 50% alpha | Hard to read on the dark bed. It now flashes at 8Hz between the body and a pale flash colour |

## Art direction, and the studio behind it

I imagined Snake as the work of **Mosslight**, a two-person studio that makes
small terrarium games: botanical-illustration palettes, field-notebook copy,
and motion that breathes rather than bounces. On screen that means:

- **Board and palette.** The board is a glass case. The moss bed has a
  two-tone checker, the frame is bevelled and lit from above with a faint
  green inner glow, there are corner brackets, and ~20 spores drift over it.
  The palette is Mosslight's own: deep teal glass, moss, bone-white ink,
  sprout lime for feasts and tide cyan for pace.
- **Lives are eggs.** A lost life splits an egg in the HUD, the new snake
  hatches in a burst of eggshell, and the last egg wobbles.
- **Pace** is a ladder of keeled scales named after real snakes.
- **The feast** is a draining ring.
- **Power-ups** sit in seed-pod capsules.
- **Announcements** are swallowtail ribbons that unfurl from their middle.
- **Copy voice:** "A NEW HATCHLING", "HATCHED — 2 LIVES LEFT",
  "Turn to slither out", "Shed at length 30".
- **Sound vocabulary:** soft plops and chimes. `hole` for a hatch, `unlock`
  for a feast milestone, `whoosh` for pace, `win` for a length milestone,
  and a rate-limited `bounce` for each popped segment.

Nothing here is shared with the runner beyond the platform's type and its
two semantic colours: no chevron lives, no chip stack, no stage banner, no
corner score cluster.

The snake is the whole game, so it is drawn as one animal. The logic still
moves a cell per step. The picture is a rope through the cell centres whose
head end advances and whose tail end retracts by the step's progress, so the
body glides at constant length and corners stay on the cell centres (a
per-segment lerp would cut them). The draw passes, in order:

1. A dark outline.
2. The body, with a taper over the last 40%.
3. A travelling bulge per apple.
4. A dorsal stripe that carries a hue sweep after a coin.
5. A spade-shaped head. Its angle is read off the rope behind it, so it
   turns smoothly without any stored state.

Under WRAP the rope is unwrapped into one line and drawn again one board
over, so it slides out of one edge and in at the other.

**Performance:**
- The bed, checker, frame and bands are painted once into offscreen canvases.
- Particles are capped at 220, rings at 12 and popups at 10.
- There is no `shadowBlur` anywhere.
- The ended frame is static.

## Controls

- **Keyboard:** arrows or WASD. Turns queue up to two deep.
- **Touch:** swipe anywhere. The swipe re-arms, so one continuous drag can
  turn twice. A mouse drag works the same way.
- **Starting:** a tap, a click or any direction starts the READY card and
  releases the respawn wait.
- **Pause** belongs to the run shell; the game has no key for it.

## HUD layout

**Top band (64px):**
- **Left:** SCORE, a large Orbitron numeral in fixed digit cells so it never
  jitters. Beside it, BEST and the coins taken this run (amber coin glyph).
- **Centre:** LENGTH, then PACE: five scales, the tier name, and a rail
  showing progress to the next tier.
- **Right:** FEAST, a draining ring with the chain count inside and the
  multiplier beside it; it is faint when no chain is live. Then LIVES as
  three eggs.

**Bottom band (44px):**
- **During READY:** drawn keycaps (arrows, WASD, swipe) and a 2s rail.
- **During play:** power-up pods (icon, name, a one-line hint, seconds
  left, drain rail; they blink in the last 2s) on the left. One line of
  guidance on the right: "3 apples to RACER", "Turn to slither out",
  "No eggs left" (red) or "Shed at length N".

## Verifying it

```bash
npx jest --config jest.dev.config.js --runInBand src/games/snake
```

`__tests__/snake.rules.test.ts` has 33 tests, one or more per bug above,
pinning rules rather than tuning:

- **Turn queue:** two quick turns are kept; a 180 is never accepted, from
  the heading or from a queued turn; same-frame keys are ordered.
- **In play:** up-then-left inside one step both happen; a reverse key is
  ignored; a continuous drag turns twice.
- **Respawn:** inside the board, off the body, at half length, facing open
  room. It waits for a turn, and costs no second life while the player is
  idle (at the slowest *and* the fastest pace). Score, coins and board
  persist; the combo breaks. Any respawn length lays out as a connected
  body behind the head.
- **Pace:** never above the cap at any tier, slowed or not. 300 apples
  still move no faster than the cap. Crossing a tier announces it.
- **Pace pays:** the same at 30fps and 144fps, and nothing on READY or
  while waiting to respawn.
- **Timing:** no `Date.now` / `performance.now` while updating or drawing.
- **Spawns:** apple, coin and power-up never land on an occupied cell (a
  nearly full board, 300 rounds). A full board leaves no apple.
- **Magnet:** never pulls onto an occupied cell (400 seeded shapes). A coin
  pulled into the head is eaten.
- **Layout:** the board sits in its band with its frame. HUD text is never
  drawn over the board and uses no Arial.
- **WRAP:** a committed head wraps once more after it ends; after the grace
  it is a wall again; the last 2s tick four times.
- **Growth:** +1 per apple, +2 under DOUBLE. Tail-chasing is legal.
  `pickups` counts coins only.
- **Lifecycle:** READY starts on a turn, a tap or at 2s. `endGame` is not
  called until the death beat has run, and the achievement keys,
  `trackGameSpecificStat` keys and `snake_best` are still written. Restart
  returns to READY with three lives and a fresh board.

`__tests__/playability.test.ts` puts a bot on the controls. The bot does a
breadth-first search to the nearest apple or coin and never moves into a
pocket smaller than itself.
- It must climb the whole pace ladder on three seeds without the run ending.
- Doing nothing must end the run, but with every life lasting longer than
  the protected window (3.5s).
- Every frame of every run also asserts that no apple, coin or power-up is
  ever under the snake.

### Looking at it

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PLAYWRIGHT_PORT=3101 \
CAPTURE_GAMES=snake npx playwright test tier0-capture --project=chromium
```

This writes `.captures/tier0/snake/` in 12 steps (15 PNGs):

1. `01-ready`
2. `02-play-turn`: a long body mid-turn, plus `02b-head-loupe`
3. `03-eating`: two bites, bulges travelling
4. `04-feast-powerups`: GHOST, MAGNET and an expiring WRAP
5. `05-tokens`: all five tokens and a coin, plus `05b-tokens-loupe`
6. `06-speed-banner`
7. `07-wrap`: the body split across both edges
8. `08-hit`
9. `09-respawn`, plus `09b-invulnerable`
10. `10-dying`
11. `11-ended`
12. `12-restart`: back on READY

## Payout estimate

Coins paid = `floor(score / 100) + pickups * 10`, and pickups dominate.

**Average player, estimated at ~140 coins per three-minute run** (range
100–200), assuming:
- ~40 apples at an average feast of ~x1.3: ~520 points.
- ~12 of the ~45 coins that spawn in 3 minutes: ~390 points and 120
  currency.
- ~7 power-ups: ~210 points.
- ~170s moving at an average pace tier of ~2: ~500 points.
- 1–2 lives lost.
- Score ≈ 1,600, so 16 + 120 ≈ 136 coins.

**Measured with the bot** (`update` only, seeded, 3 minutes):

| Bot | Apples | Coins picked | Score | Coins paid |
| --- | --- | --- | --- | --- |
| Perfect breadth-first, chases every coin | 83–97 | 34–42 | 6.3k–9.1k | 420–500 |
| Same, but 3–8% random wrong turns and coins only within 4–5 cells | 81–101 | 19–32 | 4.3k–7.7k | 240–390 |

Both are superhuman at turning (zero reaction time), so they bound the
estimate from above.

The coin cadence is unchanged from before this pass: every 4s, at most 2 on
the board, 6s lifetime. If the tier needs to pay less, `COIN_INTERVAL` and
`COIN_LIFETIME` in `constants.ts` are the knobs.

## Still open

- **Golden apple (nice-to-have) not built.** The brief's version is +50 and
  spawns 3 coins around it. Two reasons: a golden apple would be amber,
  which in this arcade means currency; and 3 coins every 10 apples would add
  roughly 30–40% to the payout above. It needs a lead decision on colour and
  economy first.
- **No win state.** A snake that fills all 589 cells simply runs out of
  apples. This is practically unreachable.
- **Respawn length cap.** The respawn layout fits at most 159 cells, so a
  snake longer than 318 hatches at 159.
- **Orbitron's slashed zero.** The platform display face renders 0 as a
  slashed zero; that is the font, not a bug.

## Requested shared changes

1. **Capture spec `GC` interface.** `tests/e2e/tier0-capture.spec.ts`
   declares a `GC` interface without `loupe()`, although
   `GameCaptureControl` has it. The snake block casts to reach it; adding
   `loupe(x, y, w, h)` to the shared interface would let every block call it
   cleanly.
2. **A tabular-digits helper.** Orbitron's figures are proportional, so a
   ticking score jitters. A shared tabular-digits helper in `canvasUi.ts`
   would save each game solving it; Snake draws fixed digit cells locally.
3. **Softer sounds.** `AudioManager` has no soft tick or pop. Snake uses
   `click` at volume 0.35 for the expiry tick and `bounce` for death pops;
   dedicated softer sounds would fit better.
4. **Stale catalog description.** `src/data/Games.ts` still describes Snake
   as "Classic snake action. Coming soon!"
