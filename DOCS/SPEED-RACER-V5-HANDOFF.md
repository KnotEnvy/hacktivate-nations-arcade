# Speed Racer — v5 → v6 Handoff

v5 shipped April 27 2026. Supersedes `SPEED-RACER-V4-HANDOFF.md` (kept for history). This doc tells the next team what landed in v5, what's still in force, and what's left for v6. **v6 focus areas: dynamic road geometry — splits/forks, width changes, bridge transitions, and the rest of the Spy-Hunter driving identity Speed Racer is missing.**

---

## 1. What v5 added (since v4)

All v4 invariants preserved (chassis HP funnel, world-frame motion, ram state machine, validation gates, `getBounds()` honesty, single-block player visual state). v5 cut against three priorities — full difficulty curve smoothing across all sections, the Spy-Hunter "Enforcer" sedan as a second armored class, and a complete bump-mechanic rewrite into a knockoff loop. Aquatic enemy AI and per-section music carry over to v6 unchanged. **Note: the user redirected v6 priorities mid-handoff toward road/driving identity; aquatic AI + music are still on the long list but not the next team's lead.**

### 1.1 Full difficulty curve (carryover from v4 §5.2)

v4 only smoothed §1–§2 and added lap scaling. The rest of the sections still had peak intensity in §5 with §6/§7 backing off — broken curve. v5 retuned every section so all three pressure axes (spawn cadence, ranged share, formation share) ramp monotonically §1 → §7. Final stretch is now genuinely the hardest. Lap scaling clamps unchanged.

| § | Section | spawn | weights `[ram,sho,enf,arm(,pat)]` | civChance | burst | form |
|---|---------|-------|-----------------------------------|-----------|-------|------|
| 1 | NEON HIGHWAY | 2.4 | `[1,0,0,0]` | 0.35 | 0 | 0 |
| 2 | NEON CITY | 1.7 | `[5,2,0,0]` | 0.55 | 0 | 0 |
| 3 | STEEL SPAN | 1.45 | `[5,2,2,0]` | 0.5 | 0.12 | 0.08 |
| 4 | ALPINE PASS | 1.3 | `[5,3,2,0]` | 0.75 | 0.20 | 0.13 |
| 5 | SUNSET COAST | 1.15 | `[4,4,3,1]` | 0.6 | 0.28 | 0.18 |
| 6 | HARBOR RUN | 1.05 | `[4,3,2,1,5]` | 0.55 | 0.32 | 0.22 |
| 7 | FROST PASS | 0.95 | `[4,4,3,1]` | 0.65 | 0.40 | 0.28 |

Subtitles updated where they had become wrong:
- **§3 STEEL_SPAN** "Bring missiles" → "Armor incoming" (no longer the armored gauntlet — enforcer is the debut threat, SWAT deferred to §5)
- **§5 SUNSET_COAST** "Final stretch · No mercy" → "Coastal blitz · Threats stack" (it's no longer the final section)
- **§7 FROST_PASS** "Brake gently" → "Black ice · Final stretch" (the actual finale)

Lap scaling sanity check (loop 2 §7): spawn 0.86, burst 0.48, formation 0.33 — meaningfully harder. Loop 4+ engages all three clamps (spawn floor 0.6s, burst cap 0.6, formation cap 0.35).

### 1.2 Enforcer enemy class — Spy-Hunter "Enforcer" sedan

New `EnemyType: 'enforcer'` — gloss-black Mercedes-style armored sedan. Smaller than SWAT (46×80 vs 58×100), faster cruise (forwardSpeed 250 vs 180), bulletproof to small arms but bumpable with momentum. Uses the existing armored lane-blocker AI (`updateArmoredAI`).

- New `ENEMY_CONFIGS.enforcer` entry: forwardSpeed 250, matchSpeedDelta 50, hp Infinity, scoreValue 350, coinDrop 3, bulletproof true, bumpResistance 2.5.
- New `drawEnforcerCar` — sedan silhouette: long hood, raked tinted windshield, chrome grille + emblem dot, LED headlight slits, chrome side rub-rail, sleek tail strips. Black/chrome palette (`#1a1a1a` body, `#c0c0c0` trim).
- New `drawEnforcerBoat` — matching dark cruiser variant for harbor section: pointed bow, chrome rub-rail along gunwales, low pilothouse with raked tinted windshield, red stern light strip.
- Render dispatch wired in both `renderCar` and `renderJetboat`.

**SWAT (`armored`) was slowed and made rarer** to make room for enforcer as the primary close-up armored threat:
- `forwardSpeed: 220 → 180`, `matchSpeedDelta: 60 → 80` (sits further back when adjacent)
- `bumpResistance: 6.0` (effectively missile-only — see §1.3)
- Spawn weights pushed enforcer-heavy in every armored-bearing section (see §1.1 table)

### 1.3 Bump mechanic rewrite — Spy-Hunter knockoff loop

Two passes happened in v5. The first pass (intermediate, since superseded) gated enforcer kills on a `BUMP_SPEED_MIN` threshold; below the threshold a side-swipe behaved like a chassis hit. The user asked for something more interesting: side-swipes shouldn't directly kill or damage, they should *push*, and enemies should die only when they're actually shoved off the road. The final design:

- **Side-swipe (penX < penY):** no immediate damage, no immediate kill. Inject a lateral impulse into the enemy's `bumpVx`. Enemy dies later if its slide carries it off the road.
- **Head-on / rear-end (penY < penX):** chassis hit — chips player HP (`takeDamage('enemy_ram')`) and removes the enemy so it can't re-hit through i-frames. Damage funnel preserved.
- **Off-road kill:** scanned in `SpeedRacerGame.update` immediately after `spawner.update`. Any alive enemy whose center is past `ROAD.X_MIN - BUMP_OFF_ROAD_MARGIN` or `ROAD.X_MAX + BUMP_OFF_ROAD_MARGIN` is credited as a kill — full `scoreValue * combo` + coins + combo bump + explosion.

**Per-vehicle bumpResistance** replaces the old binary `bumpable: boolean`:

| Type | bumpResistance | Feel |
|------|---------------|------|
| ram / shooter / patrol | 1.0 | 1-2 bumps off-road, ~1 from edge lane |
| enforcer | 2.5 | 3-5 bumps with throttle to drive them off |
| armored (SWAT) | 6.0 | Still missile-only in practice (~15-20 bumps even at boost) |

**Force scaling** is linear from brake → boost. `BUMP_FORCE_MIN = 80` at `PLAYER.BRAKE_SPEED`, `BUMP_FORCE_MAX = 520` at `PLAYER.BOOST_SPEED`. Force is divided by the receiving enemy's `bumpResistance` inside `EnemyCar.applyBump()`. Decay: `BUMP_FRICTION = 240 px/s²` linear deceleration on the enemy's `bumpVx`.

**AI suppression during bumps.** While `|bumpVx| > BUMP_AI_SUPPRESS = 30`, the enemy's lateral AI (ram charge, armored lane-lock, patrol weave) suspends. Without this, armored types fight back against every shove via their lane-lock and the bump-off-road loop becomes impossibly slow. The road clamp is gated on the same threshold so an active shove can carry the enemy fully off-road. Once the shove decays below the threshold, AI and clamp re-engage.

**Per-bump cooldown** (`BUMP_COOLDOWN = 0.12s` on `EnemyCar.applyBump`) prevents stacking from successive overlap frames before the slide separates the bodies.

**Player recoil** scales with the receiving enemy's resistance: `player.vx += sign(dx) * (50 + bumpResistance * 30)`. Heavier vehicles shove the player back harder even when the player can't really move them — gives SWAT-level bumps real weight.

**Particles, shake, audio** all scale with `bumpResistance` so the bigger the target, the meatier the impact reads. Burst position is the midpoint between player and enemy (not at the enemy origin) so the spark visually comes from the contact line.

---

## 2. Updated file map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # v5: BUMP_FORCE_MIN/MAX, BUMP_OFF_ROAD_MARGIN constants;
│                                  #   side-swipe collision rewritten to inject impulse;
│                                  #   off-road kill scan after spawner.update;
│                                  #   ROAD imported alongside PLAYER
├── index.ts
├── data/
│   ├── constants.ts               # unchanged in v5 — ROAD geometry still hardcoded
│   ├── secondaryWeapons.ts
│   └── sections.ts                # v5: full curve retune, subtitles, enforcer added to all sections
├── entities/
│   ├── PlayerCar.ts
│   ├── EnemyCar.ts                # v5: 'enforcer' EnemyType; bumpResistance replaces bumpable;
│   │                              #   bumpVx + bumpCooldown state; applyBump() method;
│   │                              #   AI/clamp suppression while shoved;
│   │                              #   drawEnforcerCar + drawEnforcerBoat
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts
└── systems/
    ├── RoadRenderer.ts            # straight-rectangle road. v6 will need this rewritten.
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # 'enforcer' threaded through enemyTypes whitelist /
    │                              #   formation gates (no code change — works via existing union)
    ├── BossSpawner.ts
    ├── TerrainHazards.ts          # current terrain handling = whole-section flag (road/water/ice).
    │                              #   v6 will need this generalized to per-region patches.
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

No new files in v5 — every change extended an existing file. Nothing touched outside the game folder (no achievements, hub, services).

---

## 3. Conventions still in force (don't regress)

All v3/v4 invariants carry forward, plus a few added in v5:

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** Road `X_MIN=160` / `X_MAX=640`. Player Y `480`. **(v6 will need to break the assumption that these are constants — see §5.1.)**
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`).
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycleHeight`, not `y = -offset`.
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)` — don't call `triggerDeath` directly from collision code. `civilian_spree` and `self_end` are the only direct callers.
- **Recap invariant.** New death causes require extending the `DeathCause` union, the `causeLabel` map, and the `improvementHint` switch.
- **Edge detection** for single-shot actions: track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Touch coordinates.** `InputManager.updateTouchState` returns canvas-internal coords. Don't re-introduce raw client coords anywhere.
- **Lint does NOT honor `_`-prefixed unused params.** Remove the param entirely.
- **`gameThemes.test.ts`** enforces unique theme primary colors. Don't reuse `#FF0080`.
- **Hitboxes are sacred.** Every visual added in the car/vehicle pass leaves `getBounds()` untouched. If you redesign a silhouette, keep the bounding box at the configured `width × height`.
- **Ram AI is a state machine, not a tracker.** Don't restore continuous-tracking lateral motion to rams — the lock-then-commit telegraph is the gameplay contract that lets players read and dodge.
- **Damage funnel includes `takeDamage` + ram self-kill rule.** Non-lethal ram hits still kill the ramming enemy (`enemy.alive = false`) so it can't re-hit through i-frames.
- **Section 1 `enemyTypeWeights: [1, 0, 0, 0]` is load-bearing.** Tutorial section is ram-only by design. `EnemySpawner.pickType` uses cumulative subtraction so weight 0 = hard exclusion. Formations also bail when a required type's weight is 0. **(v5: weight array length = 4 since enforcer was added to the type whitelist; section 1 is `[1,0,0,0]` not `[1,0,0]`.)**
- **Player visual state is set once per frame.** `setDamageLevel`, `setSecondary`, and `pulseGunRecoil` are all called from one block in `SpeedRacerGame.update()` right after `player.update()`. Don't scatter them across collision/fire callbacks.
- **Lap scaling is monotonic and clamped.** `applyLapScaling` floors `spawnInterval` at 0.6s and caps `shooterBurstChance`/`formationChance`. Don't remove the clamps when adding new lap-scaled fields.
- **(v5) Difficulty pressure axes ramp monotonically §1 → §7.** Don't introduce a new section that bucks the curve unless you also rebalance the rest. The v4 mistake was making §5 the "finale" stretch; sections after it then felt softer than the middle. If you add a new section between two existing ones, slot it on the curve at its natural intensity, not at a flat midpoint.
- **(v5) Side-swipes never deal direct damage and never directly kill.** They inject impulse; enemies die only when carried off-road. If you find yourself adding a "but for THIS enemy type, side-swipe should kill" branch, push back — it breaks the bump loop. New unbumpable threats should set `bumpResistance` very high (≥6) and stay missile-targeted, not be hardcoded exceptions.
- **(v5) `bumpResistance` is the only knob for bump difficulty.** Don't add per-type force multipliers in `SpeedRacerGame` — the divider lives in `EnemyCar.applyBump`. Single source of truth.
- **(v5) Off-road kill credit goes through the post-update scan in `SpeedRacerGame`, not `EnemyCar`.** EnemyCar deliberately does NOT set `alive = false` from off-road geometry on its own; SpeedRacerGame owns the credit (score, coins, combo, particles). Keep that separation — if EnemyCar self-kills off-road, the enemy disappears as scenery instead of scoring.
- **(v5) AI lateral motion suspends while `|bumpVx| > BUMP_AI_SUPPRESS`.** The road clamp is gated on the same threshold. Don't reintroduce unconditional lane-lock or unconditional clamping in any AI branch — both will fight the bump loop and make the knockoff feel impossibly heavy.

---

## 4. Tuning knobs

```
SpeedRacerGame.ts (top):
  COMBO_DECAY_TIME          = 4.0s
  MAX_COMBO_MULTIPLIER      = 5
  CIVILIANS_LOST_GAME_OVER  = 3

  Banners:
    BANNER_FADE_IN   = 0.45s
    BANNER_HOLD      = 1.6s
    BANNER_FADE_OUT  = 0.55s

  Lives:
    STARTING_LIVES             = 1
    MAX_LIVES                  = 5
    LIFE_BONUS_SCORES          = [2500, 10000, 25000, 50000, 100000]
    RESPAWN_INVULN_DURATION    = 2.0s
    LIFE_LOST_FLASH_DURATION   = 1.2s
    LIFE_BONUS_FLASH_DURATION  = 1.6s

  Chassis HP:
    MAX_HP               = 3
    HIT_INVULN_DURATION  = 1.1s
    HIT_FLASH_DURATION   = 0.5s

  Bump mechanic (NEW v5):
    BUMP_FORCE_MIN       = 80    px/sec impulse at PLAYER.BRAKE_SPEED
    BUMP_FORCE_MAX       = 520   px/sec impulse at PLAYER.BOOST_SPEED
    BUMP_OFF_ROAD_MARGIN = 30    px past road edge before kill credit
    Player recoil        = 50 + bumpResistance * 30

  Section clear reward:
    SECTION_CLEAR_BONUS_BASE             = 500
    SECTION_CLEAR_BONUS_PER_COMBO_LIFE   = 250
    SECTION_CLEAR_FLASH_DURATION         = 1.8s
    SECTION_CLEAR_VAN_DELAY              = 2.2s

  Lap scaling (private, in applyLapScaling()):
    spawnInterval multiplier = 0.9^wraparounds, floor 0.6s
    shooterBurstChance bump  = +0.08 * wraparounds, cap 0.6
    formationChance bump     = +0.05 * wraparounds, cap 0.35
```

```
EnemyCar.ts:
  Bump physics (NEW v5):
    BUMP_FRICTION      = 240 px/sec² lateral deceleration on bumpVx
    BUMP_AI_SUPPRESS   = 30  |bumpVx| threshold above which AI lateral + clamp suspend
    BUMP_COOLDOWN      = 0.12s between successive bumps to the same enemy

  Ram AI state machine:
    RAM_LOCK_TRIGGER   = 300px (distY at which cruise → lock)
    RAM_LOCK_DURATION  = 0.4s  (telegraph window)
    RAM_CHARGE_LATERAL = 320 px/s (commit lateral speed)

  Forward-speed approach:
    APPROACH_RANGE       = 280px
    FORWARD_SPEED_ACCEL  = 280 px/s²

  Per-type (v5 changes shown — bumpResistance is NEW; armored slowed):
    ram      forwardSpeed 260, matchSpeedDelta 20, bumpResistance 1.0
    shooter  forwardSpeed 300, matchSpeedDelta 60, bumpResistance 1.0, bulletSpeed 520
    enforcer forwardSpeed 250, matchSpeedDelta 50, bumpResistance 2.5  [NEW v5]
    armored  forwardSpeed 180, matchSpeedDelta 80, bumpResistance 6.0  [SLOWED v5]
    patrol   forwardSpeed 300, matchSpeedDelta 30, bumpResistance 1.0
```

```
EnemySpawner.ts (unchanged in v5):
  BURST_INTRA_COOLDOWN = 0.18s
  MAX_AIM_LEAD_VX      = ±200 px/s
  Inter-burst cooldown = 1.4 + Math.random() * 0.8
  enemyTypes whitelist now includes 'enforcer' in every section that uses armored
```

```
BossSpawner.ts (unchanged in v5):
  FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
  COOLDOWN          = 38..58s between bosses
  DEFAULT_BOSS_WEIGHTS = [chopper 0.45, drones 0.30, tank 0.25]
  BOSS_WEIGHTS_BY_SECTION:
    'harbor-run'  [0.60, 0.30, 0.10]
    'alpine-pass' [0.25, 0.20, 0.55]
    'steel-span'  [0.45, 0.30, 0.25]
```

Per-section spawner config lives in each `SectionDef` in `data/sections.ts`. Terrain handling unchanged from v3:
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
```

---

## 5. v6 focus areas — start here

The driving identity Spy Hunter has and Speed Racer doesn't yet: **the road itself is gameplay**. Right now the road is a static rectangle from `X_MIN=160` to `X_MAX=640`. Sections vary palette, scenery style, terrain handling flag, and enemy/civilian mix — but the geometry is identical wall-to-wall, every section, every loop. v6's job is to break that.

### 5.1 Dynamic road geometry — splits, forks, width changes

`ROAD.X_MIN` / `ROAD.X_MAX` are imported as constants in eight call sites today (player clamp, enemy clamp, lane math in spawner, render of edges + lane markings, off-road kill check, post placement, hazard placement). Step one is converting them from constants to **per-Y-row queries**: `roadX(yWorld) → { xMin, xMax }`. Once that exists, every clamp/render path takes a varying road profile and splits/forks become possible.

Scope to consider (rough order of difficulty):

- **Width changes** — narrowing chokepoints (3 lanes → 2 lanes for a stretch) and widening (4 → 5 lanes). Smooth interpolation between section boundaries is the easy entry point. Mostly affects rendering + clamps; spawner lane math needs to read live width.
- **Forks / splits** — road branches into two parallel roads with a barrier between, then merges. Player picks a side; enemies spawn on both sides. Mid-fork transition (visible "Y" graphic) is the hard rendering bit; collision against the central divider is new.
- **Bridges / transitions** — the iconic Spy-Hunter moment where the road lifts onto a bridge (geometry, palette, scenery all shift smoothly). `STEEL_SPAN` is a *visual* bridge today but the road is the same rectangle. A real bridge transition would crossfade scenery + terrain + edges.
- **Tunnels** — palette goes dark, scenery clips to entrance/exit, light sweep effect inside. Mostly a render layer over the existing road, but a good showcase of the new geometry pipeline working with environmental effects.
- **Off-road shoulders** — drivable grass/sand strips beside the road that apply a handling penalty (different from terrain water/ice — those replace road entirely). Lets the player intentionally leave the road for shortcuts or to dodge a wall of enemies. Probably needs `TerrainHazards` generalized so terrain is per-region not per-section.

### 5.2 Suggested architecture sketch

A `RoadProfile` system that owns the geometry as a function of distance:

```ts
// distance is the cumulative `worldScroll` value the rest of the game already uses
interface RoadShape {
  xMin: number; xMax: number;      // single-road profile
  // OR for forks:
  segments: Array<{ xMin: number; xMax: number }>; // list of drivable strips at this Y
}

interface RoadProfile {
  shapeAt(distance: number): RoadShape;
  laneCenterAt(distance: number, lane: number): number;  // for spawner
  isOnRoad(distance: number, x: number): boolean;        // for off-road check + clamp
}
```

`SectionDef` would gain a `RoadProfile` (or a list of "events" — split begins at +200, merges at +400, narrows from +600 to +800). The current straight-rectangle behavior becomes the trivial profile that always returns `{ xMin: 160, xMax: 640 }`.

What this changes downstream:
- **`PlayerCar.update`** — clamp uses `roadProfile.shapeAt(playerYWorld)`. Off-road sets a flag the handling system already understands.
- **`EnemyCar.update`** — soft clamp uses the per-Y profile. AI lane math (`ROAD.WIDTH / ROAD.LANE_COUNT`) becomes a per-distance query. Bumps off the road still trigger the off-road kill in `SpeedRacerGame`, but the test is now `!roadProfile.isOnRoad(...)` not a fixed X compare.
- **`EnemySpawner`** — lane spawn X positions vary by current spawn-Y. `isLaneBlocked` math stays similar but the lane width may shift.
- **`RoadRenderer`** — biggest rewrite. Draws the road as a per-row strip rather than a single fillRect. Lane markings and edges follow the curves. This is also where the visual fork/merge graphics live.
- **`SpeedRacerGame` off-road kill scan** — the fixed `ROAD.X_MIN` / `ROAD.X_MAX` compare becomes a profile query. Margin still applies but in profile-relative space.

### 5.3 Carryover from v4/v5 (still on the long list)

These were already on the roadmap before v6 redirected toward driving:

- **Aquatic enemy AI** (carry from v4 §5.1) — depth-charge dropper, strafing jet-boat, patrol AI tuning. The slate is clean: `EnemyType` union extends easily, `Projectile.vx` already exists for fan-pattern bursts, `enemyVisual: 'jetboat'` is plumbed. Once road geometry settles, this is a natural follow-on.
- **Per-section music** (carry from v4 §5.2) — `ProceduralMusicEngine` mapped once at game start. Add `musicTrack?: string` to `SectionDef` and swap in `advanceSection()`. Coordinate with audio team on swap API.
- **HP cap per section** — only act if late sections feel trivial. Gate via per-section HP cap on `SectionDef`.
- **Section-clear reward inflation** — `base + combo × lives × 250` scales fast at high lives counts. If late-game scores balloon, cap at `max(lives, 3)`.
- **Drone hover targeting** — currently locks to player's position at swoop start. Could lead the player's velocity for smarter prediction.

### 5.4 Bump-mechanic playtest tuning (v5 just shipped, watch for these)

The knockoff loop is fresh — flag any of these in early v6 playtest:

- **Soft cars too easy to bump off?** Raise their `bumpResistance` (1.0 → 1.3-1.5).
- **Enforcers feel either trivial or impossible?** `bumpResistance: 2.5` is the dial — go 2.0 if too tanky, 3.0 if too easy.
- **SWAT getting bumped occasionally at boost?** Raise to 8 or 10. Intent is missile-only.
- **Bumps feel weak overall?** `BUMP_FORCE_MAX` (520) up to 600.
- **Slide too sticky / too fast?** `BUMP_FRICTION` (240) — lower for longer slides, higher for snappier.
- **Players spamming side-swipes risk-free?** Consider a small player speed bleed on each bump (analogous to the failed-momentum cost in the intermediate v5 design).

### 5.5 Other ideas not on the v6 critical path

- **Replays / ghosts.** `dt`-keyed input serialization. Big lift; wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile. Nothing enforces it.
- **Pixel sprites.** `assetBudgetKB = 130` on the manifest is the current limit. v3/v4/v5 all stayed all-canvas. If a v6 art lead wants to migrate, raise the budget first.

---

## 6. Known small things still around

Carried over from v4 unless noted:

- `PlayerCar.pushOffRoad()` still unused (carried from v1). With v6's road profile work, it may finally have a home.
- Armored enemies (both enforcer and SWAT) skip oil-slick hits — flip if "bulletproof but oil-vulnerable" is desired.
- `BossSpawner` doesn't cull off-screen choppers — tail boom pops in before the body is fully on canvas. Cosmetic only.
- Section banner can briefly overlap with `EXTRA LIFE` or `LIFE LOST` overlays at threshold/section boundaries. Visually fine in practice.
- Chopper is always the first boss spawned (intentional — preserves v2 feel). Flip the `bossesSpawned > 0` guard in `BossSpawner.spawnBoss` to mix earlier.
- Player vehicle `renderCar` is now ~250 lines with ~9 helpers. Considered extracting into a separate renderer module but kept inline since all helpers are tightly coupled to instance state. If it grows further, extract.
- Hood scoop's boost vibration uses `Math.sin(wakeT * 50)` — visible at boost but not at base/brake. Threshold `speed > BASE + 40` is conservative; tune if it feels too subtle.
- Loop subtitle reads `LOOP {wraparounds + 1}` so first loop has no subtitle suffix (correct), second loop reads "LOOP 2", etc. Don't change the +1.
- Civilian `roofRack` chance is hardcoded at 25% in the constructor. If tuning needs vary per section, plumb it via `SpawnerOptions` like `shooterBurstChance` is.
- **(v5)** `ENEMY_CONFIGS.armored.bumpResistance: 6.0` is a soft "missile-only" — at sustained boost the player can technically push a SWAT off the road over ~15-20 bumps. If a player exploits this (probably not — too slow under enemy fire), bump to 10+ or add a hard `bumpable: false` short-circuit in `applyBump`.
- **(v5)** Bump cooldown is per-enemy (`bumpCooldown` field on `EnemyCar`), not global on the player. Two adjacent enforcers can each be bumped on the same frame — that's intentional and matches Spy-Hunter feel.
- **(v5)** Off-road kill margin `BUMP_OFF_ROAD_MARGIN = 30` is generous. If enemies feel like they "should have died" at the edge but linger, lower it. If they wink out too fast for the explosion to read, raise it.
- **(v6 incoming)** `ROAD.X_MIN` / `ROAD.X_MAX` are referenced as constants in ~8 places. Document those call sites (player clamp, enemy clamp, off-road kill, spawner lane math, road body fill, road edge stroke, lane markings, post placement) before the profile rewrite — they're the migration checklist.

---

## 7. Validation gates (unchanged)

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # all tests pass (145 as of v5 ship)
npm run build          # production build succeeds
```

Manual signed-in QA checklist (carried from v3):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Manual QA additions for v5:
- **Difficulty curve** — clear all 7 sections without dying. Each section should feel measurably harder than the last. Don't need to time it; just check that §7 spawns feel hectic vs §1 quiet.
- **Loop 2 sanity** — start of loop 2 (§1 with `· LOOP 2` subtitle) should feel slightly tougher than first run §1. By loop 2 §7, spawn cadence + burst pressure should be noticeably tighter than loop 1 §7.
- **Enforcer visual** — look for sleek black sedan with chrome trim, raked tinted windshield, LED headlight slits, sleek tail strips. Boat variant on harbor: matching dark cruiser with chrome rub-rail + low pilothouse.
- **Bump knockoff loop** — drive into a ram side-on at various speeds. At brake: minimal push, ram stays on road. At base: solid push, ram slides off in 1-2 hits. At boost: ram catapults clean off. Confirm explosion + score credit when ram crosses edge.
- **Enforcer bumping** — at base speed, enforcer barely moves per hit. Hold throttle and ride alongside one for ~3-5 contacts; should slide off-road and credit kill at full scoreValue.
- **SWAT bumping** — try bumping a SWAT at boost. Should feel like hitting a wall — strong recoil to the player, almost no movement on the SWAT. Confirm missile-only is still the practical answer.
- **Head-on collisions** — drive head-on into a ram. Should chip player HP (one of three plates), not bump-push the ram. Same for enforcer/SWAT — head-on is still a chassis hit.
- **AI fight-back** — bump an enforcer mid-throw. While its `bumpVx` is high, it should NOT lane-snap back toward you. Once it slows, the lane-lock re-engages.
- **Combo feedback** — successful off-road kills bump combo. Failed bumps (just shoves, no kill) do NOT bump combo. Both feel right.

---

## 8. Suggested v6 sequencing

1. **Audit `ROAD.X_MIN` / `ROAD.X_MAX` callers (§5.1)** — list every reference. Most are 1-2 lines; the migration is mostly mechanical.
2. **Introduce `RoadProfile` type with the trivial straight-rectangle implementation.** Pipe it through every caller as a parameter. No behavioral change yet — gates green.
3. **First geometry feature: width change.** Add a section that narrows mid-stretch and widens again. Validates the whole pipeline (player clamp, enemy clamp, render, lane math) end-to-end with the simplest non-trivial case.
4. **Forks / splits** — bigger lift; the rendering is the long pole. Get a barrier-between-two-roads working before attempting visible Y-graphic merges.
5. **Bridges and tunnels** — environmental polish on top of the geometry pipeline. Mostly art + crossfade work once profiles are first-class.
6. **Carryovers when convenient** — aquatic AI, per-section music, playtest tuning. Don't let them block the driving identity work.

Bump-mechanic, enforcer, and difficulty curve all just shipped — game's in a great place to take the road geometry leap. Keep the damage funnel green, keep the bump invariants intact (no side-swipe damage, no side-swipe direct kills, off-road credit owned by SpeedRacerGame), keep `getBounds()` honest, keep the validation gates passing, and v6 should be smooth.
