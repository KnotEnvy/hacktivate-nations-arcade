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

## Verifying it

`npm run test:dev -- --runInBand src/games/runner` runs the 18 fairness tests.
They pin the *rules*, not the tuning numbers:

- no two hazards are ever scheduled less than 0.9s apart, at any distance
- intervals hold in seconds rather than in distance units
- game speed is capped
- a sliding player clears a barrier and a standing one does not
- a pit hurts a grounded runner and spares a jumping one
- sliding is not a universal dodge — a blocker still stops it
- coyote time and jump buffering both fire
- the jump arc matches at 30fps and 144fps
- every boss dips inside the measured jump arc at the bottom of its hover wave,
  never sinks into the floor, and rises out of reach at the top

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

- The forest stage is the least legible of the five: everything in it is green,
  and the treant has to fight its own background. More value separation between
  the canopy bands would help.
- `ComboFlash` milestones stop at 30. A player who chains past that gets no
  further acknowledgement.
- Endless mode past stage 5 re-uses the same five stages with a boss HP bump
  (+50% every five bosses). It works, but nothing new is introduced.
- The charge attack returns the boss to `baseX` at a fixed rate and can look
  stiff next to the other attacks.
- Power-up drop weighting is flat across the four types; a player who wants a
  particular one cannot influence it.
