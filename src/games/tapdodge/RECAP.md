# Tap Dodge — Development Recap

Last updated: September 27, 2026

Tap Dodge is a tier-0 reflex game: a five-lane highway seen from above,
descending, with hazards coming down it in rows. This file is the record of
what it is after the tier-0 polish pass and where the edges still are.

---

## The polish pass (September 27, 2026)

The brief called the old build "a pile-on": nebula, orbs, lightning,
chromatic flashes, energy wings, after-images, lane warnings, emoji
everywhere, the base Score/Coins overlay still on, and — worst — it was
unfair on touch, its primary input. The pass went for restraint,
readability and fairness. Nearly every file was rewritten; the manifest id,
every `extendedGameData` key, every `trackGameSpecificStat` key and the
`tapdodge_best` localStorage key are unchanged.

### The studio

I imagined Tap Dodge as the work of a small studio from the transit-signage
school, a shop that would rather draw a clear highway sign than add another
glow. It shows on screen in five ways:

- **Chrome as signage.** Every plate has two chamfered corners (top-left and
  bottom-right) and a reflective strip along the top.
- **One glyph.** The chevron is the only recurring symbol: HOP, JUMP, DUCK,
  the laser tells, RUSH road markings, the tip bullet.
- **Road paint.** Announcements (zone names, RUSH, CLEAR +300) are painted
  across the lanes and ride the road toward you *under* the hazards, so an
  announcement never hides one.
- **Voice and palette.** Copy is terse and road-sign flat: "Five lanes down.
  Read the gaps.", HOLD THE LINE, HULL, RUN REPORT. The palette is cool
  zones against one hot-pink signal colour that means heat: hazards, rushes,
  top fever.
- **Motion and sound.** Hops snap on an exponential approach, never bounce.
  The zone sign flips like a split-flap board, and nothing uses elastic
  easing. The sound vocabulary is small and literal: `click` for a hop,
  `whoosh` for a jump, `land` for a duck, `success` for a close pass,
  `unlock` for a cleared rush.

### Bugs this pass fixed

From the brief, each pinned by a test:

| Bug | Effect on the player |
| --- | --- |
| Jump/duck existed only on keys; a held Up re-fired every 0.5s | On touch, the primary input, lasers (zone 2 on) were undodgeable. On keys, holding Up made LOW lasers free |
| `moveToPosition` let the ship sit between lanes | A touch player could straddle two lanes and clip two hazards at once |
| Spawns were independent dice: random heights and speeds per obstacle, walls and lasers stacked, "moving" blocks drifting across two lanes | Some rows had no way through; obstacles overtook each other |
| Base HUD left on | Arial `Score:`/`Coins:` drawn over the game's own HUD |
| `bannerTimer -= 1/60` in render; survival from `Date.now()` | Banners ran shorter on fast displays; survival counted wall-clock time |
| `survival_time` counted pause, and the up-to-8s recap | The 30/60/120s achievements could be earned seconds early |
| Lane warnings appeared only at fever 1+ | The same danger read differently depending on your multiplier |
| "BOSS WAVE" with no boss | A promise the game never kept |
| Near miss at 35px from the ship's *centre* | Nearly every adjacent-lane pass paid, so it meant nothing |
| In-game Escape/P pause | Paused the game behind the shell's back; the shell still said "playing" |

Found along the way:

| Bug | Effect on the player |
| --- | --- |
| The recap tip line picked `Math.random()` inside render | The tip flickered to a new sentence every frame |
| Any held key or touch dismissed READY, including the Enter that pressed the shell's Start button | Keyboard players could lose the controls card on frame one |
| The recap read held input, not presses, and otherwise ran 8s | A finger still down from the last dodge dismissed it at 2s; left alone it overstayed |

### The rules now

**Rows, not dice** (`systems/PatternSpawner.ts`). Every spawn is one row
from a pattern table:

- single hazard (crate or spike)
- pair, often with a lane between (and a coin in it)
- wall with one gap (sometimes a gem in the gap)
- drifter drone that patrols inside its own lane
- full-width laser, HIGH or LOW
- a line of five coins

Three rules hold for every row:

1. At least one lane is safe.
2. From *any* safe lane of the previous row, a safe lane of this row is at
   most two hops away. Lasers and coin lines carry the previous safe lanes
   forward.
3. The clear road between the previous row's back edge and this row's front
   edge is never under **0.55s at the fastest the road can ever move**
   (`MIN_ROW_GAP` = 0.55 × `MAX_SPEED` = 279px), so the floor holds at every
   speed, rushes included.

Every row moves at the road's one speed. A laser gets at least 1.0s of road
on either side: a 0.45s dodge plus its 0.25s cooldown, with margin.

**Dodges.** Up/W or a swipe up jumps (clears LOW beams); Down/S or a swipe
down ducks (passes under HIGH beams). A dodge lasts 0.45s, then cools down
for 0.25s. Every trigger is an edge: a held key is one dodge. A press up to
0.15s early is buffered rather than dropped. Dodge timers run on world time,
so slow motion stretches them along with the beam.

**Lanes.** The ship is always on a lane centre or travelling to one.
Left/right (A/D) hop one lane per press, with a three-deep buffer so
presses during a hit-freeze still land. Tapping the left or right third
hops one lane. A sideways drag steers to the lane under the finger,
snapped. A press that became a drag or a swipe is never also a tap.

**Near miss.** A near miss pays when the hitbox gap was within 14px and
the hazard never touched the ship. It is paid once per obstacle, as the
hazard draws level with the ship, or on the full pass if you slipped in
behind it. It flashes the hazard's facing edge, pops "CLOSE +x" and runs
0.4s of 0.7x slow motion. In practice that means leaving a lane at the last
moment. Clean laser dodges ("UNDER"/"OVER") feed the same chain.

**Progression.** Four zones of 30s each, on world time:

| Zone | Name | Scenery |
| --- | --- | --- |
| 1 | Cloud Deck | cloud streaks |
| 2 | Tower Row | rooftops |
| 3 | Deep Canyon | canyon walls |
| 4 | Stormwall | storm and rain |

Speed ramps continuously: 1.0x → 1.2 → 1.4 → 1.6 → 1.75 at 120s, then
slowly to a **cap of 2.1x at 240s** (441px/s). There is no lurch at a zone
boundary, and 120s+ still gets faster.

**RUSH.** The old boss wave. A RUSH is announced 2s ahead with RUSH painted
on the road. It then runs 10s at 1.15x speed with 0.8x gaps, the rails
pulsing hot pink; its rows draw no lasers and no power-ups. Still flying at
the end pays **+300** with `unlock`. The first comes at 42s, and each next
one 55s after the last one ends.

**Hits.** A hit costs one of three hull plates:

- a 90ms freeze and shake 10
- a red edge vignette and the `collision` sound
- the ship blinks at 8Hz for 1s of invulnerability
- fever resets and the chain breaks

A shield soaks exactly one hit. The last plate pulses red, with a standing
red vignette.

**Power-ups** (ringed capsules with drawn icons):

| Power-up | Effect |
| --- | --- |
| Shield | Soaks the next hit (8s) |
| Magnet | Pulls in coins and gems (6s) |
| Slow | Hourglass: the world runs at 0.6x (4s) |
| Ghost | Pass through everything (3s, with 0.4s of grace on exit) |
| Drone | A sidekick that shoots crates, spikes and drones (8s) |

**The run.**

1. READY card naming every control; any key or tap after 0.25s, or 2s.
2. Play.
3. 1.4s death beat: hull shards, two rings, the road coasting to a stop.
4. RUN REPORT, auto-continuing after 4s (a press after 0.5s skips it).
5. `endGame()`.

`onRenderEnded` redraws the road, the gantry and the settled report, dimmed
55%, under the shell's summary. `restart()` returns to READY with every
system reset.

### Art direction, and why

The brief asked for one clear read, and every choice below is there to keep
it:

- **Three cheap background layers, then the road.**
  1. A deep gradient with the road surface on it, cached per zone.
  2. 40 drifting specks.
  3. One scenery band on the 100px shoulders — cloud streaks, rooftops,
     canyon walls, storm and rain — generated once per zone into a strip
     whose edges meet, so it tiles and scrolls with no shimmer.

  The road is five 120px lanes with faint scrolling dashed dividers and two
  lit rails with reflector studs in the zone accent. Zone changes crossfade
  over 1s.
- **Deleted:** nebula, orbs, lightning, chromatic aberration, per-obstacle
  warning glows, the grid, after-images, energy wings, speed lines, the lane
  warning system. There is no `shadowBlur` anywhere.
- **One silhouette per hazard, never re-skinned.**
  - crate: a square, X-braced box
  - spike: a triangle bolted to a plate, pointing at you
  - wall: a hazard-striped barrier with a lit top
  - drifter: a rounded drone with rotors and an eye that sweeps its slot
  - laser: a full-width beam with HIGH or LOW tags on both shoulders and a
    chevron pair in every lane pointing the way to go

  Hazards are dark bodies with one hot-pink signal colour.
- **HIGH beams draw over the ship.** A duck therefore reads as passing
  under. A HIGH beam also casts a shadow on the road; a LOW beam sits on
  squat posts.
- **The ship.** A pale wedge with an ice cockpit, one outline, one gradient
  and one glow:
  - engine flames that lengthen with speed
  - banking up to ±0.25 rad on hops
  - a short light-trail that scrolls away with the road
  - jump grows toward the camera, with the shadow dropping away, and
    squashes on landing
  - duck flattens with a tight dark shadow and skid marks
  - shield bubble; ghost is translucent with a dashed outline
- **Currency is amber and nothing else is.** Coins are amber discs with an
  edge-on spin. Gems are a violet cut diamond. Red appears only for damage
  and the last hull plate. The zones run cool so that the pink hazards
  pop:

  | Zone | Accent |
  | --- | --- |
  | 1 | cyan |
  | 2 | periwinkle |
  | 3 | mint |
  | 4 | ice |

- **Fever and slow motion stay subtle.** The fever tint is 1% a level, 4% at
  the top (under the brief's 6% cap), because more turned the whole road
  plum. Slow motion uses the accent `edgeVignette`.

### Controls

| | Keyboard | Touch / mouse |
| --- | --- | --- |
| Hop | ← → or A D, one lane per press | tap the left / right third; drag sideways to steer (lane-snapped) |
| Jump (LOW beams) | ↑ or W | swipe up |
| Duck (HIGH beams) | ↓ or S | swipe down |
| Start / continue | any of the above, Space, Enter | tap |

### HUD layout

Two solid bands frame the road, and the HUD lives only inside them:

- **Gantry (top, 0–58px), left:** SCORE as a 7-digit odometer (spent zeros
  dimmed) and BEST.
- **Gantry, centre:** the ZONE sign (ZONE n / 4, name, NEXT Ns, a rail to
  the next zone). It flips on a zone change, and during a RUSH it turns hot
  pink with HOLD THE LINE and the rush timer as its rail.
- **Gantry, right:** FEVER with the level name, the multiplier, a rail to
  the next level, and CHAIN xN / COMBO N on its top line.
- **Deck (bottom, 556–600px):** active power-up chips (icon, name, seconds,
  drain rail) at the left; HULL, three ship-wedge pips, at the right.

Popups ("CLOSE +50", "+50", "GEM +250", "HULL -1") are small, short-lived
and sit beside the ship.

### Tests

`npx jest --config jest.dev.config.js --runInBand src/games/tapdodge`
runs 63 tests in three files. They pin rules, not tuning.

`tapdodge.rules.test.ts` (41):

- base HUD off
- READY: ends on the first key without that key also hopping; ends itself
  at 2s; ignores a key held over from the shell's Start; a starting tap
  does not hop
- dodges: swipe up jumps and swipe down ducks; one hold can flick up, then
  down; a held key never chains; 0.45s dodge and 0.25s cooldown; an early
  press is buffered
- lasers: jump clears LOW, duck clears HIGH, the wrong move is a hit
- lanes: keyboard hops are edge-triggered; two quick presses hop twice;
  the three-deep buffer through a freeze; tap thirds; the lane-snapped drag;
  the ship always settles exactly on a lane centre under random input
- near miss: fires within 14px and not at 15px or 35px; once per obstacle;
  earned by a late lane change; not paid for an early dodge; 0.7x slow
  motion and 25 per chain link; a touch is a hit, never a near miss
- time: survival excludes a pause, READY and the death beat; a source scan
  for `Date.now`, `performance.now`, timers, `1/60`, Arial/monospace,
  emoji, Escape/P and BOSS strings
- the lane warning system is gone
- RUSH: warns, speeds up and pays; not cleared if you die mid-rush
- hits: freeze, fever reset, chain break; a shield soaks one
- end of run: the 1.2–2.0s death beat, then the recap, then `endGame` at
  4s; the 0.5s skip guard; every achievement key reported; the still ended
  frame; `restart()` resets everything
- render never mutates state
- economy values, and the grade

`patterns.test.ts` (9):

- every row has a safe lane
- consecutive safe lanes are at most two hops apart
- no laser shares a row
- the gap floor holds at every speed
- lasers get their clearance
- speed stays under the cap
- live-road check: all rows move by one speed, and the spacing between
  rows is measured on screen
- drifters never leave their lane

`playability.test.ts` (13): a reflex bot that reads only the nearest row,
reacts 0.22s after a row becomes nearest, and presses at most ~7 keys a
second.

- It flies **90s at the top speed with zero hits on each of ten seeds**, at
  dt 1/60 and at the 0.05 clamp.
- It flies a full 3-minute run from the start.
- Doing nothing dies, but not in the first 4s.

Checked by mutation: let a wall's gap ignore the two-hop rule and the bot
fails 10 of those 13 tests.

### Looking at it

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PLAYWRIGHT_PORT=3105 \
CAPTURE_GAMES=tapdodge npx playwright test tier0-capture --project=chromium
```

This writes 19 scenes, plus two loupes (ship and drifter), to
`.captures/tier0/tapdodge/`. The scenes are ready, zone-1 play, wall gap,
HIGH laser with duck, LOW laser with jump, near miss, fever, rush inbound,
rush, all four zones, shield plus magnet, hit freeze, death beat, recap and
the ended frame. An in-page autopilot (`tdPilot`) flies between scenes so
the ship is never parked in a hazard.

### Economy and payout

| Event | Points |
| --- | --- |
| Survival | 20 per world second × fever (1.0 / 1.5 / 2.0 / 2.5 / 3.0 at 0 / 10 / 20 / 30 / 40 clean seconds) |
| Coin | 50 |
| Gem | 250 |
| Near miss or clean laser | 25 × chain (to x5) |
| Cleared RUSH | 300 |
| Drone kill | 40 |

`pickups` = coins + gems.

**Three-minute payout** (coins = `floor(score/100) + pickups × 10`),
measured with the human-limited bot over six seeds:

| Run | Score | Pickups | Coins paid |
| --- | --- | --- | --- |
| Clean run, ignoring coins | ~14,000 | ~45 | **~590** |
| Clean run, taking coins | ~14,500 | ~53 | **~675** |
| Two hits, taking coins | ~12,500 | ~53 | **~655** |

An average player who flies the full three minutes should expect
**roughly 600 coins**. About 80% of that is pickups, because coins sit in
wall gaps and between pairs, on the line you have to fly anyway. If the
tier needs it lower, the knobs are the coin chances in
`PatternSpawner.build` (single 30%, pair 45%, wall gap 55%, coin-line
weight).

---

## Still open

- **Tap latency.** A tap hops on release (a short, still press), so a slow
  tap costs its own length. Drag and keyboard act at once. This keeps a
  swipe that starts in a side third from also hopping.
- **HIGH and LOW beams share one colour.** They differ by tag, chevron
  direction, post height and the HIGH beam's shadow. A second beam colour
  was considered, but every free hue collided with a zone accent or a
  power-up.
- **Power-up drop weights are flat**, one capsule at most every 14s.
- **Past 120s the Stormwall carries on alone.** Speed keeps rising to its
  cap, but no new scenery or hazard is introduced.
- **Grade thresholds are a judgement call:** S ≥ 9.5 points, from survival
  (up to 6), near misses (up to 3) and fever (up to 3).

## Requested shared changes

- `src/data/Games.ts`: the Tap Dodge entry still says
  `inputSchema: ['touch']` and "Tap to dodge obstacles." The game is now
  fully keyboard-playable, and the manifest says
  `['touch', 'keyboard']` with "Five lanes, a falling road. Hop, jump and
  duck through the gaps; late dodges score."
- `tests/e2e/tier0-capture.spec.ts` (shared part): add `loupe(x, y, w, h)`
  to the `GC` interface so scenes can call it without a cast, and consider
  a `captureLoupe(page, name)` helper next to `capture()`.
- `src/games/shared/hud/canvasUi.ts`: `edgeVignette` and `withAlpha` accept
  only `#rrggbb`. An `rgb()`-string variant would let a crossfading accent
  drive the slow-motion vignette mid-fade; today it uses the target zone's
  hex.
- `jest.setup.ts` / `gameTestHarness.ts`: every canvas shares one mock 2D
  context, so offscreen caches draw through the same mock as the frame. A
  per-canvas context would make draw-call assertions exact without a
  warm-up frame.
