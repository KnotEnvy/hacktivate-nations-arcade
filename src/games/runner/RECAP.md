# Endless Runner — Development Recap

Last updated: September 19, 2026

The runner is the arcade's free, tier-0 headliner, so it is the game most
players judge the whole arcade by. This file is the working record of what it
is now and where the edges still are.

---

## The polish pass (September 19, 2026)

A full round over the world, the cast, the chrome and the feel. What follows is
the shape of the game after it, not a diff — but the "why" notes matter, because
several of the changes fixed rules that were quietly broken.

### Bugs this pass fixed

These were live in the shipped build:

| Bug | Effect on the player |
| --- | --- |
| The base HUD was left on (`renderBaseHud` defaulted true) | `Score:` / `Coins:` were drawn straight over the runner's own `Lives:` row |
| The slide barrier hung to the floor (`groundY - 64`, height 64) | The move the tutorial teaches did not clear it. Barriers were pure walls |
| The pit's hazard band started exactly on the ground line | `Rectangle.intersects` is strict, so **pits did nothing at all** |
| Spawn gaps *shrank* with speed (`base - (gameSpeed - 1) * 10`) | Late runs threw hazards closer together than a jump arc could clear |
| `gameSpeed = 1 + floor(distance / 1000) * 0.2`, uncapped | A long run eventually outran its own jump |
| Knockback set `velocity.x = -200` (px per **frame**) | A hit teleported the runner ~200px left in one step |
| Parallax elements were seeded from **screen** position | Every tree and bush changed shape as it scrolled — constant shimmer |
| Victory screen promised `+10` coins; the game awarded 15 | The number shown was not the number paid |
| The tutorial never spawned a barrier | "Slide under the barriers" with no barrier on screen |
| Boss intro ran 5.4s (a 3.1s approach at 80px/s) | Five long waits per lap before a fight could start |

A second round, found by putting a bot on the controls rather than by reading
the code (`__tests__/playability.test.ts`):

| Bug | Effect on the player |
| --- | --- |
| Boss contact ignored the post-hit invulnerability window | One bad approach drained all three lives in about a fifth of a second |
| The boss's body dipped to the floor at the bottom of its hover | There was nowhere to stand near it; proximity alone was a hit |
| Stomping required *falling*, and the body hung low | A jump that rose into the boss always cost a life, so the fight's own mechanic was a trap |
| No cooldown between stomps | The bounce re-entered the hitbox and drained the health bar in a few frames |
| Slides stopped dead at 0.55s and needed a fresh press to restart | Holding DOWN through consecutive barriers stood the runner up into the second one |
| Hover drones sat at `groundY - 84` | Their box cleared a standing runner entirely; they only ever threatened someone mid-jump |
| Paired spike beds left a 32px gap | Narrower than the runner, so not a landing spot, but wide enough to drop a short jump onto the second bed |
| Flyers cruise at jump-apex height and ignored ground spacing | An enemy could sit exactly where a forced jump had to go |
| `distance` accrued at full rate during a boss fight | A player could camp in a fight they had no intention of winning and farm score by dodging |

### The world

`ParallaxSystem` was rebuilt around **seamless cached strips**. Each depth band
is generated once into an offscreen canvas whose left and right edges line up,
then blitted twice per frame. That buys three things at once: no shimmer (a
strip's content is fixed for its lifetime), far more detail per band (a strip is
drawn on theme change, not 60 times a second), and cheaper frames. Ridges tile
because their height functions are built from **integer harmonics** of the strip
width, so `h(0) === h(1)`. If an offscreen canvas is unavailable the bands fall
back to drawing straight into the frame.

Six bands, back to front: sky features (celestial body + stars), clouds (0.08),
far silhouettes (0.14), mid hills and structures (0.30), near props (0.55),
ground detail (1.00, drawn by `RunnerGame` off the world odometer).

`EnvironmentSystem` now carries a full `ThemePalette` per stage — multi-stop sky,
a **horizon haze colour** that distant geometry fades into (the single strongest
depth cue), three graded silhouette bands, foliage, ground, cloud, an ambient
mote kind, an ambient light wash, and the accent the HUD tints itself with.

| Stage | Name | Sky | Skyline | Air |
| --- | --- | --- | --- | --- |
| 1 | Meadow Run | Clear blue | Snow-capped peaks | Pollen |
| 2 | Ember Coast | Purple → ember | Jagged crags, low sun | Embers |
| 3 | Neon Skyline | Deep indigo | Lit city, moon, stars | Fireflies |
| 4 | Dune Sea | Hot pale | Rolling dunes, heat shimmer | Blowing sand |
| 5 | Deep Canopy | Misted green | Forest walls, god rays | Falling leaves |

### The cast

- **The runner** is a drawn character: helmet, visor, chest panel, swinging
  arms with fists, a running leg cycle, a trailing scarf with lag physics, a
  contact shadow that tightens as they near the ground, a tucked rising pose, a
  reaching falling pose, a low slide pose, and a full flip on the double jump.
  The suit is **dark slate with cyan trim** on purpose — the first pass was
  green and vanished against the meadow and the forest floor.
- **Obstacles** are re-skinned per stage but never change silhouette, so the
  rule learned in stage 1 holds in stage 5: a blocker is always a waist-high
  solid, a barrier always hangs with hazard stripes and a lit underside, a spike
  bed is always a metal comb, a pit is always a hole cut through the floor.
- **Flying enemies** are winged darts with a flight path through the jump arc.
  They cannot be stomped.
- **Hover drones** are sentry craft with a thruster glow, a sweeping scanner eye
  and a flat top plate — because they **can** be stomped. That is new: landing
  on one pops it for coins, feeds the combo, and bounces the player.
- **Bosses** are five real creatures instead of five coloured circles: a solar
  disc behind a glaring gold mask, a phoenix with layered feather ranks and a
  flame tail, a wobbling void with three slit eyes and a jagged maw, a segmented
  worm rising from a sand mound with two counter-rotating rings of teeth, and a
  walking trunk with a carved face, branch arms and a mossy crown.
- **Coins** turn edge-on and back by scaling their width with `cos(spin)`, and
  keep a bright rim at the edge-on point so they flash rather than vanish.

### The chrome

All of it moved to `systems/HudRenderer.ts`, built on the arcade design system
(`DOCS/UI-DESIGN-SYSTEM-HANDOFF.md`): Orbitron for numerals, Inter for prose,
JetBrains Mono for values, amber only ever meaning currency. Panels sit in the
two top corners and the far bottom-right; **nothing is drawn in the bottom-left,
because that is where the runner stands.**

Screens: title, tutorial card with step dots and progress pips, in-run HUD,
boss bar (name, segmented health, phase, and the one instruction a new player
needs), stage-clear, and a recap with a letter grade and an eight-tile stat grid.

### The feel

- **Coyote time** (0.11s) and **jump buffering** (0.13s).
- Gravity and the jump hold are dt-scaled, so the arc is identical at 30fps and
  144fps. There is a test for it.
- Heavier gravity on the way down than on the way up.
- Spawning is **scheduled in seconds and converted to distance**, so intervals
  stay honest as the run speeds up. Hazards come as deliberate patterns with a
  known answer, not as independent die rolls.
- Speed ramps smoothly to a ceiling of ~3.1x.
- Speed Zone is 1.45x, not 2x — at 2x the screen moved further in a jump arc
  than the player could see coming.
- A hit now costs the combo, freezes the sim for 90ms, flashes a red edge
  vignette, and knocks back gently. The last life carries a standing vignette.
- Music: one procedural track per stage plus a boss theme, switched only when
  the wanted track changes.

---

---

## The depth round (September 20, 2026)

The polish round made the runner look and feel right. This one gives it
something to be good AT.

### Every stage now has a verb of its own

The five stages were art variations on one loop: jump, slide, collect. Each
one past the first now carries a signature interactable (`entities/StageFeature.ts`),
and each leans on a different verb:

| Stage | Feature | Asks for |
| --- | --- | --- |
| 1 Meadow Run | — | nothing. It is the stage that teaches the basics |
| 2 Ember Coast | Ember geyser | **timing** — read the sleep/warn/erupt cycle and cross while it sleeps |
| 3 Neon Skyline | Updraft vent | **routing** — ride the column to a high coin line, with the air jump refunded |
| 4 Dune Sea | Sand gust | **steering** — hold ground against it with the movement keys |
| 5 Deep Canopy | Bounce pad | **chaining** — a launch stronger than any jump, into the canopy |

The gust is the interesting one: left/right had almost no purpose before it.
Every feature spawns with the reward for engaging with it attached — a coin
line up the updraft, a stack over the pad — so its purpose is legible the
first time a player meets one. A geyser always warns before it fires, and
only the erupting column is dangerous.

### Near misses

Before this, the optimal play was to jump as early as possible: there was no
upside to cutting it fine, so the safest run was also the highest-scoring one.
`systems/GrazeSystem.ts` pays out for passing inside a 16px band around a
hazard **without** touching it. The value climbs with the chain and caps, the
chain lapses after 2.2s, each hazard pays once, touching one burns the chance,
and nothing pays while the player is invulnerable — a near miss has to be near
something that could actually hit you.

Grazing also charges the special-event meter, so precision is a second route
to an event alongside long coin chains. The live chain shares the event panel
in the HUD.

### Score means something now

`score` was `distance / 10` and nothing else, recomputed every frame. It is now
distance plus a `bonusScore` the player earns: near misses, drone stomps (+50),
boss hits (+100) and boss kills (+1000). A skilful run outscores a long one.

`systems/ScorePopups.ts` floats the number off whatever earned it — the first
score popups the game has had, and the thing that makes grazing legible.

### Giving a run shape

- **A stage track**: a hairline across the very top of the frame showing how
  far through the stage the run is, and therefore how close the boss is. It
  burns red for the whole fight. An endless runner with no visible structure
  feels like it is going nowhere.
- **First-encounter hints**: the first time a run meets each stage feature, a
  card says what it is for ("RIDE THE COLUMN", "Hold RIGHT to keep your
  ground"). Once per run; after that the shape of the thing is the
  instruction.
- **Clean running pays**: every 750m without taking a hit awards a bonus, and
  a hit resets the counter. The metres-since-hit readout only appears once it
  is worth protecting, so it arrives as a reward rather than as another
  number to ignore.

### The score's balance

A first pass paid 1000 for a boss and 100 per hit on it, which at a dozen
hits a boss made one fight worth roughly ten times the distance run to reach
it — an endless runner whose score was really a boss-kill counter. Awards are
now modest (boss 250, hit 25, stomp 25, graze 8-40) and distance stays the
spine: a bot run of ~9,500m scores ~2,100, of which distance is about 45%. A
skilled player's near misses are what should close the gap.

The recap's letter grade weights near misses and stomps heavily, so a short
sharp run can outgrade a long careful one.

### Graphics

- **A foreground occlusion band** (`ParallaxSystem.renderForeground`) drawn
  AFTER the entities, so near-black silhouettes streak past in front of the
  runner. It is kept deliberately low: the first pass ran 96px tall and its
  grass swallowed the player.
- **A camera that reacts** (`systems/GameCamera.ts`): pulls back up to 9% as
  the run speeds up (which is also the fair thing to do, since hazards arrive
  sooner at speed), and drifts down when the player goes high so a bounce-pad
  launch does not pin them to the top edge. Anchored on the bottom centre so
  the ground line stays put.
- **Speed lines** at high speed, kept to the upper sky and the strip just
  above the floor so they never sit on the hazard being read.
- Because the camera pulls back, everything that fills the frame is now drawn
  **overscanned** (`WORLD_OVERSCAN`), and the full-frame effects moved OUT of
  the camera transform into screen space where they belong.

### Two extractions

`RunnerGame` crossed the repo's 1500-line guardrail twice during this round,
and the policy is to refactor a monolith when it is next actively extended:

- `systems/Director.ts` — the difficulty curve, the spawn clock and the
  pattern table, with no knowledge of entities, rendering or collision. It
  asks for spawns through a `SpawnApi` the game implements. The fairness
  tests now drive it directly, which covers the whole range of a run far more
  thoroughly than stepping a live game could.
- `systems/WorldRenderer.ts` — the floor, the ground dressing, the speed lines
  and the vignettes.

## Verifying it

`npm run test:dev -- --runInBand src/games/runner` runs the 37 tests. They pin
the *rules*, not the tuning numbers:

- no two hazards are ever scheduled less than 0.9s apart, at any distance
- intervals hold in seconds rather than in distance units
- game speed is capped
- a sliding player clears a barrier and a standing one does not
- a pit hurts a grounded runner and spares a jumping one
- sliding is not a universal dodge — a blocker still stops it
- coyote time and jump buffering both fire
- the jump arc matches at 30fps and 144fps
- every boss dips inside the measured jump arc at the bottom of its hover wave,
  keeps its underside clear of a standing runner's head, and rises out of reach
  at the top

`playability.test.ts` adds three more that check the rules add up rather than
each holding alone. A reflex bot — see a hazard, react to it, no foresight —
drives a full run and has to clear at least one boss and reach stage 2 every
time. Doing nothing has to end the run, but not immediately. The bot is
deliberately dumb, so what it reaches is close to a floor on what a person can
reach: if a tuning change drops it, the run got unfair rather than harder.

The boss fight's intended answer, which the bot executes and the HUD states:
the damage box is the bottom 45% inset 28% from each side, so **jump at the
boss's flank and come down on its wide top**. Standing under a monster is
still a hit.

`features.test.ts` covers the depth round: that four of the five stages have a
feature and stage 1 has none, that all four are different, that only the
current stage's feature spawns, that the pad fires on a descent and ignores a
rise, that a geyser never erupts without warning first, that the updraft is
capped and the gust cannot push anyone off the world, and that a graze pays
for closeness but never for contact.

### Looking at it

There is a dev-only capture harness, mirroring the Dungeon Crawl one:

```bash
npx playwright test runner-capture --project=chromium
```

It drives `src/dev/runner-capture` through every scene — menu, tutorial, all
five stages, all five bosses including rage, power-ups, both special events,
mid-air, slide, death and recap — and writes PNGs to `.captures/runner/`. It
also has a **loupe**: `zoomPlayer()` blits a magnified crop centred on the
runner, because sprite work that is 32px on screen cannot be judged at 1x.

The harness is reachable only through `src/app/dev/runner/page.tsx`, which
`scripts/sync-dev-routes.js` deletes before type-check, lint and build. It can
never reach production. It is NOT in the CI gate — see `DOCS/START-HERE.md` on
why the gate stays lean.

---

## Still open

- Stage 1 has no feature of its own by design, but by the time a player loops
  back to it they may want one.
- Endless mode past stage 5 re-uses the same five stages with a boss HP bump
  (+50% every five bosses). It works, but nothing new is introduced.
- The charge attack returns the boss to `baseX` at a fixed rate and can look
  stiff next to the other attacks.
- Power-up drop weighting is flat across the four types; a player who wants a
  particular one cannot influence it.

## One balance call worth a second opinion

`ComboSystem` gained a **4x coin tier at a chain of twenty**, on top of the
existing 1x / 2x / 3x. `pickups` converts straight into arcade currency through
`CurrencyService.calculateGameReward`, so this is an economy knob and not only a
score one. The reasoning: the table used to stop at 3x for a chain of ten, which
left nothing to play for past ten coins in the arcade's headline game, and a
single hit resets the chain. If the arcade's payout needs to come down, the
whole table is four lines in `ComboSystem.addCoin`.
