# Mini Breakout — Development Recap

Last updated: September 27, 2026

Mini Breakout is one of the arcade's five free tier-0 games. Before this pass
it was a 634-line single file with flat bricks, an Arial HUD drawn on top of
the brick field, a ball that served itself in a random direction, and no
feel. This file records what it is now and where the edges still are.

---

## The studio: Floodlight

I imagined Mini Breakout as the work of **Floodlight**, a small studio that
makes night-time sports cabinets: the court under stadium lights, a TV
broadcast graphics package over it, and a stadium announcer's copy. You can
see it in five places on screen. **The court** is a navy floor that is bright
at the far rail and dark at the near end, with a perspective grid, faint
court markings (a dashed service line and a half-circle), and three
**LED perimeter rails** that flash where the ball hits them. **The HUD** is
a broadcast scorebug: every panel is a `/`-leaning parallelogram, there is a
mint "house flag" at the left edge, and the numerals are stadium-board
Orbitron with dimmed leading zeros. **The beats** are lower-thirds that
slide in from the left and out to the right with a light sweep, not
centred cards. **The words** are sports words: SERVE, SET, STREAK, BALL
OUT, MATCH OVER, SERVES LEFT. **The palette** is floodlight mint for the
house, plus a cool-to-hot ramp for the glass (cobalt → violet → magenta).
Amber appears only on the coin, and red only when something goes wrong. It
shares nothing with the runner's rounded panels, chevron lives or chip
stack.

---

## Bugs this pass fixed

From the brief:

| Bug | Effect on the player |
| --- | --- |
| The base HUD and the game HUD (y 20–180) were drawn over the bricks (from y=60) | Score, lives, level and best covered the top three rows of the wall |
| `bannerTimer -= 1/60` ran inside render | Banner timing depended on frame rate, and drawing changed game state |
| The ball moved in one step per frame, up to 26px at the 0.05s dt clamp | On a slow frame the ball could pass through the 14px paddle |
| The serve launched itself after 1.2s at a random angle | The player could not aim the first shot of a life |
| A brick's colour was set once from its starting hp and never changed | A 3hp brick hit twice looked the same as a fresh one |
| No mouse control; the keyboard paddle snapped to 420px/s | Desktop players could not play with the mouse, and the keys felt digital |
| Escape / P opened the game's own pause overlay | It stacked a second pause screen on top of the run shell's |
| A lost ball played `game_over` and an extra life played `success` | A lost ball sounded like the end of the run, which then played `game_over` a second time |

Found during the pass (each has a test):

| Bug | Effect on the player |
| --- | --- |
| A serve from a still paddle went straight up, came straight back to the same spot and went straight up again | A player who never touched anything never lost the ball. Now nothing leaves the paddle closer than ~4.6° to vertical (`MIN_OFF_VERTICAL`), and the aim guide shows which way it leans |
| The shuttle row moved after the ball had moved | A sliding brick could end a frame on top of the ball. Shuttles now move first, and the collision pass resolves it |
| A 360px/s serve (the old game served at ~284) | In the bot runs a slightly slow reaction lost all three serves in about 35s. It now serves at 300px/s |

---

## The game now

### States

```
READY  (ball rides the paddle, aim guide, serve ring; auto-serve at 3s)
  → PLAYING
      → LOST beat 1.2s      → READY
      → CLEAR: 0.4s slow-mo + 1.6s beat (banner, confetti, next set drops in) → READY
      → GAMEOVER beat 1.6s  → endGame() → ended frame
```

The first READY of a run also shows the **serve card** (the controls, drawn
as keycaps). It closes on the first input, or after 2s. Later serves show
a single line under the paddle instead: `SERVE · SPACE, CLICK OR TAP`, or
`RELEASE · …` when CATCH is holding the ball. `restart()` goes back to that
first READY with every timer, system and entity reset.

`onRenderEnded` draws the court as it stood at the final whistle, dimmed to
55%, with the final scorebug, so the shell's summary sits on the board
rather than on black.

### Controls

| Input | Action |
| --- | --- |
| ← → / A D | Move. The paddle accelerates (4200px/s²) to 660px/s and slows at 5200px/s². Reversing turns it round harder |
| Mouse | Once the mouse moves over the canvas, the paddle follows its x (an exponential chase, about 95% of the way in 0.1s). Keys take over again as soon as one is pressed |
| Finger | Dragging moves the paddle the same way |
| Space / Enter / ↑ / W, a click, or a tap | Serve, or release a caught ball. A tap is a short press that does not travel, so dragging never launches |

The launch angle comes from **where the ball sits on the paddle** (−1 at
the left end, +1 at the right, up to 60°) plus the **paddle's velocity**
(up to 0.55 rad at full speed on a serve, 0.2 rad on a return). The
chevron aim guide shows the exact angle before you let go, and a ring
round the ball counts down to the automatic serve.

### Feel

- **Paddle return:** the paddle squashes (scaleY 0.7 for 90ms), the ball
  flashes white, `bounce`, and a screen shake of 1–3.5 that grows with ball
  speed. Each return adds 1.5% speed, up to 25% over the set's serve speed.
- **Rail hit:** the LED rail flares at the impact point for 120ms, with
  sparks, and `bounce` (rate-limited).
- **Crack:** the tile shakes 2px and flashes, one crack appears, one hp
  cell empties, the tint steps darker, and it plays `hit`. +10.
- **Break:** 4–6 glass shards in the tile's colour fall under gravity, a
  score popup appears in the streak colour, `success`, shake 3. Every
  second break sends an amber coin arcing up into the scorebug.
- **Streak:** each brick the ball touches between paddle returns adds one.
  From the 3rd hit it pays x2, from the 6th x3. A paddle contact or a lost
  ball resets it. The ball's comet shows the tier (mint, then violet, then
  magenta, and longer at each tier). The scorebug shows the multiplier and
  a six-segment rail that fills toward the next tier.
- **Match point:** when three or fewer required tiles are left, they
  pulse, so you can see where to aim.
- **Last tile:** 0.4s of slow motion (0.35x), an additive mint-white
  flash, and a white shock ring.
- **Set clear:** "SET n CLEAR · +bonus BONUS · score · BEST STREAK n"
  lower-third, confetti in the brick ramp, `win`. Any steel left standing
  shatters, and the next set drops in row by row with overshoot, behind
  the far rail.
- **Ball out:** shake 8, a red edge vignette, red sparks and a ring where
  it went out, `explosion`, and a "BALL OUT · 2 SERVES LEFT" lower-third
  (or LAST SERVE). Timed power-ups and falling capsules are cleared.
- **Match over:** the same hit, then a 1.6s dim with "MATCH OVER · FINAL
  score · SET n", then `endGame()` (which plays `game_over` once).

### Power-ups

A capsule drops on about 15% of breaks, and never the same type twice in a
row (weighted pick, excluding the last drop). At most three fall at once.
Capsules are dark glass pills with a coloured cap and a drawn icon. They
wobble and sway as they fall.

| Capsule | Icon | Effect | Scorebug tag |
| --- | --- | --- | --- |
| WIDE | bar with outward arrows | paddle 104 → 156px for 10s | drain rail, blinks in the last 2s |
| MULTI | three balls | two more balls fan out ±0.4 rad from the first (cap 6) | the BALLS dots |
| SLOW | hourglass | balls at 0.65x for 7s | drain rail |
| CATCH | a cup holding a ball | 8s: the ball sticks where it lands; release with the launch input, or it goes by itself after 3s | drain rail. A lime strip runs along the paddle |
| BLAST | eight-point burst | the next brick contact breaks the 3x3 block around it (steel included) | "ARMED", and a dashed magenta ring round the ball |
| +SERVE | spare paddle with a plus | +1 life (cap 5) | the SERVES pips |

### Sets

Five layouts rotate. Hit points rise one step every five sets (+1 from set
6, +2 from set 11, cap 4). The serve speed rises 4% a set, capped at +40%
(420px/s from set 11). The ball's hard ceiling is 560px/s.

| Set | Layout | Notes |
| --- | --- | --- |
| 1, 6, 11 … | Full wall | 5 rows; the top row is 2hp |
| 2, 7 … | Checker | 6 rows |
| 3, 8 … | Pyramid | 7 rows; a 3hp crown |
| 4, 9 … | Columns | 7 rows of column pairs, each with one window |
| 5, 10 … | Fortress | curtain wall, towers, a 4hp core behind a steel shield, and a gate. Side passages reach the core, so it never needs BLAST |
| 6+ | + shuttle row | four tiles under the layout, sliding a full column each way |

**Steel** (grey, riveted, 4hp) only takes damage from a x3 streak or a
BLAST. Anything less clangs off it (`collision` and sparks). Steel does not
count toward clearing a set.

### Scoring and economy

- 50 × streak per break, 10 per crack, and 200 + 50 × set for a clear.
- `pickups += 1` for **every second** brick broken, so coins paid =
  `floor(score / 100) + pickups × 10`. Paying for every brick would have
  made set 1 worth about 530 coins. The brief caps a set at about 250.
- **Payout estimate.** Clearing set 1 pays about 280 coins (25 pickups =
  250, plus about 28 from score). With the reflex bot on the keys for
  three minutes (8 seeds): a quick player (0.10s reaction) averages
  **~315 coins** (range 265–395) and clears set 1 in 63% of runs. A slower
  player (0.14s) averages **~200** and usually loses the last serve at
  around 105s. **An average three-minute run pays about 250 coins.** That
  is well under the arcade's `CURRENCY_RATE` of 250 per active minute.
- Saved keys are unchanged: `breakout_high_score`, the
  `extendedGameData` keys (`bricks_broken`, `levels_cleared`,
  `powerups_collected`, `total_bricks_broken`, `max_level`,
  `final_lives`) and the `trackGameSpecificStat` keys.

### The HUD: a 52px scorebug

Nothing is drawn over the court but beats, and the top rail sits under the
band, so the ball never enters it either. Left to right:

| Cell | Shows |
| --- | --- |
| flag | Floodlight mint, the house mark |
| SCORE | 6-digit board numeral (dimmed leading zeros), BEST, and the amber coin count the flying coins land on |
| SET | 2-digit set number, and BALLS in play as six dots |
| POWER | up to four slanted tags (icon, label, seconds, drain rail); with none live, a POWER label and a quiet "Catch a falling capsule" so the bug never reads as a missing panel |
| SERVES | spare paddles, mint. The last one turns red and pulses |
| STREAK | x1/x2/x3 in the tier colour (it pops on a tier-up), the six-segment tier rail, and the raw count |

The band's static chrome (ground, flag, cells) and the court
(floor, grid, markings, floodlight washes, rails) are each painted once
into offscreen canvases. Every tile look is a cached sprite keyed by
colour, size, hp and max hp, and each glow halo is cached too. The only
`shadowBlur` calls are in those one-time paints.

---

## Code map

| File | What |
| --- | --- |
| `BreakoutGame.ts` (~920 lines) | lifecycle, the state machine, input wiring, the scoring, streak, power-up and beat rules |
| `constants.ts` | geometry, tuning, beat lengths, the Floodlight palette |
| `entities/types.ts` | Ball, Brick, Capsule, Paddle |
| `systems/physics.ts` | substepped `moveBall`, `resolveBrick`, `launchAngle`, `ensureMinAngle` |
| `systems/levels.ts` | layouts, hp and speed scaling, shuttle row, pre-rolled cracks |
| `systems/streak.ts`, `systems/powerups.ts` | combo tiers, drop table |
| `systems/PaddleController.ts` | keys with acceleration, mouse and finger follow |
| `systems/ArenaRenderer.ts`, `BrickRenderer.ts`, `EntityRenderer.ts`, `HudRenderer.ts`, `icons.ts` | the art |
| `systems/ParticleSystem.ts`, `ScreenShake.ts`, `Sfx.ts`, `color.ts` | effects, the rate-limited sound cues, colour helpers |
| `testing/rig.ts`, `testing/bot.ts` | test plumbing (outside `__tests__` because jest runs every file in there as a suite) |

---

## Verifying it

`npx jest --config jest.dev.config.js --runInBand src/games/breakout` runs
46 tests in two suites. They pin rules, not tuning numbers.

`__tests__/breakout.rules.test.ts` (43):

- no tunnelling at dt=0.05 and top speed: a ball always hits a brick it is
  flying at and always returns off the paddle, whatever the phase of the
  frame. In a live level-11 game (three seeds, shuttle row sliding), no
  ball ends a frame inside a brick or in the band, and a tracked ball is
  never lost
- the serve waits for input or the 3s timeout, not 1.2s. Space, a click
  and a tap each serve, and a drag does not. The launch follows the
  paddle's velocity and the ball's offset, and never goes dead vertical
- every launch and return stays between the minimum lean and 60°, the tip
  of a moving paddle included. `ensureMinAngle` keeps speed, and no wall
  or brick contact leaves the ball flatter than 24°
- the streak pays x2 from the 3rd hit and x3 from the 6th, and resets on
  paddle contact
- the clear beat runs before the next layout, the next serve waits for a
  fully built set, and the last tile slows time. The ball-lost beat runs
  before READY, and the game-over beat runs before `endGame` (no coins and
  no `game_over` until it has finished)
- no brick of sets 1–16 (shuttles at full swing included) enters the band
  or leaves the rails, the brick layer is clipped to the court, the base
  HUD is off, and no font string contains Arial or a bare monospace
- rendering 120 frames changes no timer and no state
- the tint gets darker with each hit, a crack shows and plays `hit`, and a
  fresh tile has no crack strokes
- the mouse and a finger move the paddle, and the keys accelerate and
  decelerate rather than snap
- Escape and P do not pause
- the sound cues: bounce, hit, success, powerup (not success) for +SERVE,
  explosion (not game_over) for a lost ball, win for a clear
- power-ups never repeat twice in a row (pure, and in play with every
  roll forced the same way). CATCH holds and releases. BLAST breaks 3x3.
  MULTI, WIDE and SLOW work
- one pickup per two bricks. The serve card closes on first input or
  after 2s. `restart()` resets everything. The ended frame draws without
  touching state. The achievement keys are kept

Six of the brief's bugs were put back one at a time, and each time its
test failed: single-step physics, a timer ticked in render, a 1.2s
auto-serve, a constant-speed keyboard, `game_over` on a lost ball, and the
base HUD turned on.

`__tests__/breakout.playability.test.ts` (3): an idle run ends by itself,
but only after three auto-serves and their beats. A reflex bot that tracks
the ball keeps it in play for most of three minutes and gets through at
least 35 bricks. Three minutes never pays twice a cleared wall.

### Looking at it

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium \
PLAYWRIGHT_PORT=3103 CAPTURE_GAMES=breakout \
npx playwright test tier0-capture --project=chromium --reporter=list \
  --output test-results/breakout
```

This writes 22 frames to `.captures/tier0/breakout/`: the serve card, the
aim guide while moving, a rally with a lit rail, the damage ramp plus a
loupe (`04b`), a x3 streak, capsules with three tags live, CATCH, MULTI,
BLAST, match point, last-tile slow-mo, the clear banner, the set dropping
in, the next serve, ball out, the match-over beat, the ended frame, and
sets 3, 4, 5 (fortress with steel) and 6 (shuttle).

---

## Still open

- **The last-brick hunt.** A top-corner tile can take a while to reach.
  The bot, which hits with the middle 60% of the paddle, sometimes spends
  30s or more on the last one. The match-point pulse shows where to aim,
  and the paddle ends reach 60°, but there is no mechanical assist. If
  playtests say it drags, a gentle pull toward the last tile is the next
  thing to try.
- Past set 10 nothing new appears. The layouts repeat with more hp, and
  speed stops rising at set 11.
- Touch launch: a tap also pulls the paddle toward the finger for a few
  frames, so a tap far from the paddle serves with some english. The aim
  guide shows it, but a touch-only "serve straight" gesture might be
  kinder.

## Requested shared changes

Resolved in lead review (September 27, 2026):

- The capture page now hides the Next.js dev badge for everyone, so the
  breakout loupe scene no longer adds its own style tag. The breakout block
  still casts to reach `loupe()` until the shared `GC` interface with it
  lands in this tree; drop the cast then.
- `InputType` stays without `'mouse'` (desktop mouse is implied by
  keyboard in the catalog), so the manifest keeps
  `['keyboard', 'touch']` even though the paddle follows the mouse.

Nothing further requested. `BaseGame`'s new `endGameSound` /
`endGameOutcome` fields keep their defaults (`game_over` / `died`), which
is right for an endless game; revisit only if a win state is ever added.
