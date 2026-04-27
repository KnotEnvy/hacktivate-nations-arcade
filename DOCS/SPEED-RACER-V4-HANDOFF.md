# Speed Racer — v4 → v5 Handoff

v4 shipped April 25 2026. Supersedes `SPEED-RACER-V3-HANDOFF.md` (kept for history). This doc tells the next team what landed in v4, what's still in force, and what's left for v5. **v5 focus areas: aquatic enemy AI and per-section music — the two items deferred from v4's plan.**

---

## 1. What v4 added (since v3)

All v3 invariants preserved (chassis HP funnel, world-frame motion, scroll direction, validation gates, lives system, recap flow, mobile touch fixes). v4 worked through the three priority areas the v3 handoff named — enemy AI, difficulty curve, car/vehicle design — plus a follow-on deep pass on the player vehicle that the user requested mid-cycle.

### 1.1 Enemy AI pass (handoff §5.1)

Enemy behavior moved from "linear tracker" to "telegraphed setpiece." Bulk of the work lives in `entities/EnemyCar.ts` and `systems/EnemySpawner.ts`.

- **Ram telegraph + commit** — three-state machine `cruise → lock → charge` on `EnemyCar`. Lock fires for `RAM_LOCK_DURATION = 0.4s` and pins the target X at entry; charge then commits to that lane at `RAM_CHARGE_LATERAL = 320 px/s` with no further tracking. Body flashes bright yellow during lock, plus a dashed red→yellow tracer line from the ram's bumper to the target lane. A quick swerve cleanly beats a charging ram. State exposed publicly (`ramState`, `ramLockTimer`, `ramTargetX`) so the renderer can read it without coupling.
- **Shooter aim-lead + burst** — `Projectile` now carries `vx` (default 0) and integrates X each tick, with off-road despawn at `x < 80 || x > 720`. `EnemySpawner.updateShooter` computes `lead = playerVx * (distY / bulletSpeed)`, capped at `MAX_AIM_LEAD_VX = ±200 px/s`, and fires the projectile with that velocity. Firing window widened from `|dx|<80` to `|dx|<160` so leads can land. Per-instance `burstCount` (default 1) on `EnemyCar`; when set to 3 the shooter chains shots at `BURST_INTRA_COOLDOWN = 0.18s` then resets to a long cooldown. Bursts commit once started so the player can punish the whole sequence by dodging on the tell.
- **Armored blocker** — `matchSpeedDelta` tightened 90→60 (closer hover). `updateArmoredAI` replaced raw-X tracking with a lane-center lock: snap to the nearest lane center, drift at 110 px/s with a 4px deadband, only engage when `distY < 420`. Forces missile use or a deliberate dodge past instead of letting the player just outsteer them.
- **`bulletSpeed` moved into `ENEMY_CONFIGS`** — small refactor enabling per-shooter-variant projectile speeds. Shooter set to 520; falls back to 520 if undefined.
- **Formation spawning** — `SpawnerOptions.formationChance` (0..1) rolls each spawn tick. Two patterns currently:
  - **Flanked ram** — shooters in lanes 0 and 3 (offset Y back), ram in inner lane at SPAWN_Y so it reaches the player first
  - **Armored corridor** — armored center, two rams trailing on flanking lanes
  Both check `enemyTypes` whitelist + non-zero weights for required types, and bail to a single spawn if any lane is blocked. Section 1's `[1,0,0]` weights mean any formation gracefully falls back.

Per-section tuning lives in `data/sections.ts`. Sections 3-7 set `shooterBurstChance` (0.20–0.35) and `formationChance` (0.12–0.20). Sections 1-2 stay defaulted to 0 to preserve the tutorial ramp.

### 1.2 Difficulty curve (handoff §5.2)

- **Section 2 smoothing** — `NEON_CITY` weights retuned `[5,4,1]` → `[5,2,0]`. Half the shooter density and **armored deferred to section 3**. This kills the "just learned the game, now I'm dying" cliff that section 2 created in v3.
- **Lap scaling** — `SpeedRacerGame.wraparounds` increments when `sectionIndex` rolls from `SECTIONS.length - 1` back to 0 inside `advanceSection()`. New `applyLapScaling(base)` helper applies multipliers at section-change time:
  - `spawnInterval *= 0.9^wraparounds` (floored at 0.6s)
  - `shooterBurstChance += 0.08 * wraparounds` (capped at 0.6)
  - `formationChance += 0.05 * wraparounds` (capped at 0.35)

  Reset to 0 in both init paths. Other config (weights, civilianChance, vans) is intentionally untouched — the loop gets *busier and twitchier*, not a different game.
- **Loop subtitle** — when `wraparounds > 0`, the section banner subtitle renders `"{base} · LOOP {N+1}"`. Diegetic difficulty signal, no new UI.
- **Per-section boss weights** — `BossSpawner` now takes `sectionId` in `update()`. `BOSS_WEIGHTS_BY_SECTION` map overrides the default `[0.45, 0.30, 0.25]` for three sections:
  - `harbor-run` → `[0.60, 0.30, 0.10]` chopper-heavy (air-over-water reads well)
  - `alpine-pass` → `[0.25, 0.20, 0.55]` tank-heavy (mountain corridors favor tanks)
  - `steel-span` → `[0.45, 0.30, 0.25]` baseline (explicit for clarity)

  Picker rewritten as cumulative subtraction for consistency with `EnemySpawner.pickType`. First boss still always chopper.
- **Deferred from §5.2:** per-section HP cap and section-clear reward cap. Both should only land if playtest shows the issue. Watch `base + combo × lives × 250` at high lives counts.

### 1.3 Car / vehicle design pass (handoff §5.3)

A big art pass. All canvas-drawn — no new sprite assets, asset budget unchanged. `getBounds()` unchanged on every entity.

- **Player damage states** — `PlayerCar.damageLevel: 0|1|2` set every frame from `MAX_HP - hp`. Tier 1: scorch blotch on hood, jagged door crack, headlight flicker. Tier 2: torn fender with embers + dark right headlight + spiderweb windshield + smoke trail. Boat variant mirrors with a glowing motor crack and a broken spray rail. `setDamageLevel()` setter; `damageT` accumulates only while damaged.
- **Enemy car silhouettes (car variant)** — `renderCar` dispatches to `drawRamCar` / `drawShooterCar` / `drawArmoredCar`:
  - **Ram** muscle-car wedge: hood scoop, protruding bull bar, side spikes, angular slanted headlights, twin exposed exhausts, lock-flash yellow body
  - **Shooter** utility SUV: armored grille with horizontal bars, hazard chevron stripes on lower flanks, roof turret with barrel, side-mounted radar antenna
  - **Armored** SWAT truck: 3-bar brush guard protruding past bow, rivet studs down the sides, angled hood armor plates, tiny slit windshield, segmented red+blue roof strobe bar
- **Enemy jetboat silhouettes** — symmetric pass: `drawRamBoat` (PWC with bow prongs + handlebars + jet nozzle), `drawShooterBoat` (patrol boat with pilothouse + radar mast + stern swivel gun), `drawArmoredBoat` (gunship with foredeck turret dome + cleat bollards), `drawPatrolBoat` (twin-hull hydrofoil with connecting foil bar — patrol type still uses sine-weave AI). Ram lock telegraph mirrored on the boat variant.
- **Tank recoil + muzzle puff** — `recoilT` set to `TANK_RECOIL_DURATION = 0.2` on each shell fire. Hull + turret + barrel offset by `-3 * sin(recoilNorm * π)` (treads stay grounded). Two-tone muzzle puff (yellow core + smoke ring) at the barrel tip, fades with recoilT.
- **Drone leader variant** — one drone per swarm flagged as leader at spawn (random index). Larger by 1.15×, 6 rotor blades instead of 4, gold accent palette, three gold spike crest antennas around the dome, faint gold body ring. Gameplay identical.
- **Civilian refresh** — `CIVILIAN_PALETTES` provides 6 two-tone combos (sky/mint/mustard/lavender/cherry/silver). Family-car silhouette: front windshield + rear window + side window bands with chrome trim, driver silhouette through the glass, amber turn signals that blink with per-instance phase, chrome bumpers, door seam, optional roof rack (25% chance per spawn).
- **Weapon van refresh** — cab + cargo box silhouette with hazard chevron stripe band between them, rivet columns down the sides, "WEAPONS" stencil text on the cargo, cyan payload diamond, split rear doors with chrome handles, rotating red/amber roof beacon (driven by `pulseT`), cab antenna, driver in cab.

### 1.4 Player vehicle deep pass (mid-cycle addition)

After the v4 art pass landed, the user asked for a dedicated polish pass on the player vehicle since it's the centerpiece. Scope expanded `PlayerCar.ts` significantly. All driven off existing or newly-plumbed state — no new accumulators beyond what's needed.

- **Foundation polish** — pulsing hot-pink underglow ellipse (`renderUnderglow`) that intensifies + widens with speed; four corner wheels (`renderWheels`) with chrome rims, rotating spokes, and pink hub caps (rear pair beefier 8×18 vs front 6×14); helmeted driver silhouette (`renderDriver`) with charcoal helmet, hot-pink stripe, cyan visor strip — visible through the windshield.
- **Hood scoop + exhaust + animated guns** — `renderHoodScoop` draws a raised charcoal scoop with hot-pink trim and a dark intake slot, with a tiny y-jitter vibration when `speed > BASE + 40`. `renderExhaustFlames` produces twin orange/yellow flame tongues at the rear exhausts, length and brightness scaling with speed; cyan afterburner blip overlays the tip when `speedT > 0.6`. `renderGunBarrels` swaps the plain rectangles for chrome-housed barrels with a mounting collar and a recoil offset of `gunRecoilT * 25` px backward. `gunRecoilT` is pulsed by `SpeedRacerGame` via the new `pulseGunRecoil()` setter at the same call site that fires `particles.burstMuzzle()`.
- **Side livery + "01" decal** — `renderLivery` adds chrome flank trim with a hot-pink under-trim accent, plus an "01" race number on the trunk over a pink halo. Skipped at critical damage so the torn-fender overlay reads cleanly.
- **Visible secondary weapon mounts** — `SecondaryHint` snapshot ({type, ammo, maxAmmo, cooldownPct}) piped from `SecondaryWeaponSystem` into `PlayerCar.setSecondary()` each frame. `renderSecondaryMount` draws:
  - **Missile**: launcher pad with 3 missile tubes; tips render red+lit when loaded, dark hole when spent. Dims to a dark-red tint while cooldown is fresh.
  - **Oil**: purple-banded drum with a top valve, ammo dot pips along the side, faint drip below when armed.
  - **Smoke**: wide vented nozzle assembly with side intake bands, ammo dot pips above, smoke wisp below when armed.

  All three use `armed = cooldownPct < 0.3` to dim the accent color for ~0.3s after each use, giving visible shot-consumed feedback. Mount renders nothing when `secondary.active === null`.
- **Boat parity** — cyan waterline halo (`renderWaterlineGlow`) replaces the underglow, helmet driver visible through windshield, chrome bow guns share `renderGunBarrels` (with the same recoil), rear-deck secondary mount shares `renderSecondaryMount`, "01" decal hidden when secondary equipped to avoid clutter, wake count and length scale with speed, additional cyan jet plume puffs at `speedT > 0.4`.

State plumbing summary — all set once per frame from `SpeedRacerGame.update()` right after `player.update()`:
- `setDamageLevel(MAX_HP - hp)` clamped to 0..2
- `setSecondary(hint)` with full ammo + cooldown snapshot
- `pulseGunRecoil()` called inside the existing muzzle-flash branch
- Hitbox stays `PLAYER.WIDTH × PLAYER.HEIGHT` (44×76) — none of the cosmetics touch `getBounds()`.

---

## 2. Updated file map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # +wraparounds, applyLapScaling, loop subtitle, setSecondary/setDamageLevel/pulseGunRecoil wiring
├── index.ts
├── data/
│   ├── constants.ts
│   ├── secondaryWeapons.ts
│   └── sections.ts                # Section 2 smoothing + per-section burst/formation chances
├── entities/
│   ├── PlayerCar.ts               # damage states + full vehicle deep pass (~700 lines, ~9 helpers)
│   ├── EnemyCar.ts                # ram state machine + per-type silhouette dispatchers (car + jetboat)
│   ├── Civilian.ts                # palette system + refresh
│   ├── WeaponVan.ts               # refresh + rotating beacon
│   ├── Projectile.ts              # +vx for shooter aim-lead
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts             # tank recoil + muzzle puff, drone leader variant
└── systems/
    ├── RoadRenderer.ts
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # playerVx param, shooterBurstChance, formationChance, trySpawnFormation
    ├── BossSpawner.ts             # sectionId param, BOSS_WEIGHTS_BY_SECTION, cumulative-subtraction picker
    ├── TerrainHazards.ts
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

No new files in v4 — every change extended an existing file. Outside the game folder: nothing touched in v4 (no achievements, no hub changes, no service edits).

---

## 3. Conventions still in force (don't regress)

All v3 invariants carry forward, plus a few added in v4:

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** Road `X_MIN=160` / `X_MAX=640`. Player Y `480`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`).
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycleHeight`, not `y = -offset`.
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)` — don't call `triggerDeath` directly from collision code. `civilian_spree` and `self_end` are the only direct callers.
- **Recap invariant.** New death causes require extending the `DeathCause` union, the `causeLabel` map, and the `improvementHint` switch.
- **Edge detection** for single-shot actions: track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Touch coordinates.** `InputManager.updateTouchState` returns canvas-internal coords. Don't re-introduce raw client coords anywhere.
- **Lint does NOT honor `_`-prefixed unused params.** Remove the param entirely.
- **`gameThemes.test.ts`** enforces unique theme primary colors. Don't reuse `#FF0080`.
- **(v4) Hitboxes are sacred.** Every visual added in the car/vehicle pass leaves `getBounds()` untouched. If you redesign a silhouette, keep the bounding box at the configured `width × height`.
- **(v4) Ram AI is a state machine, not a tracker.** Don't restore continuous-tracking lateral motion to rams — the lock-then-commit telegraph is the gameplay contract that lets players read and dodge.
- **(v4) Damage funnel includes `takeDamage` + ram self-kill rule.** Non-lethal ram hits still kill the ramming enemy (`enemy.alive = false`) so it can't re-hit through i-frames.
- **(v4) Section 1 `enemyTypeWeights: [1, 0, 0]` is load-bearing.** Tutorial section is ram-only by design. `EnemySpawner.pickType` uses cumulative subtraction so weight 0 = hard exclusion. Formations also bail when a required type's weight is 0.
- **(v4) Player visual state is set once per frame.** `setDamageLevel`, `setSecondary`, and `pulseGunRecoil` are all called from one block in `SpeedRacerGame.update()` right after `player.update()`. Don't scatter them across collision/fire callbacks.
- **(v4) Lap scaling is monotonic and clamped.** `applyLapScaling` floors `spawnInterval` at 0.6s and caps `shooterBurstChance`/`formationChance`. Don't remove the clamps when adding new lap-scaled fields — uncapped scaling at loop 5+ is unplayable.

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
  Ram AI state machine:
    RAM_LOCK_TRIGGER   = 300px (distY at which cruise → lock)
    RAM_LOCK_DURATION  = 0.4s  (telegraph window)
    RAM_CHARGE_LATERAL = 320 px/s (commit lateral speed)
  Forward-speed approach:
    APPROACH_RANGE       = 280px
    FORWARD_SPEED_ACCEL  = 280 px/s²
  Per-type:
    ram      forwardSpeed 260, matchSpeedDelta 20
    shooter  forwardSpeed 300, matchSpeedDelta 60, bulletSpeed 520
    armored  forwardSpeed 220, matchSpeedDelta 60 (was 90 in v3)
    patrol   forwardSpeed 300, matchSpeedDelta 30
```

```
EnemySpawner.ts:
  BURST_INTRA_COOLDOWN = 0.18s
  MAX_AIM_LEAD_VX      = ±200 px/s
  Inter-burst cooldown = 1.4 + Math.random() * 0.8 (single-shot path too)
  Spawner config defaults (overridden per-section in sections.ts):
    spawnInterval, enemyTypes, enemyTypeWeights,
    civilianChance, civilianSpawnInterval,
    vanIntervalMin, vanIntervalMax,
    enemyVisual          ('car' | 'jetboat'; resets to 'car' on configure())
    shooterBurstChance   (resets to 0 on configure())
    formationChance      (resets to 0 on configure())
```

```
BossSpawner.ts:
  FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
  COOLDOWN          = 38..58s between bosses
  DEFAULT_BOSS_WEIGHTS = [chopper 0.45, drones 0.30, tank 0.25]
  BOSS_WEIGHTS_BY_SECTION (sectionId → weights):
    'harbor-run'  [0.60, 0.30, 0.10]
    'alpine-pass' [0.25, 0.20, 0.55]
    'steel-span'  [0.45, 0.30, 0.25]
    (others fall back to default)
```

```
BossEnemies.ts (Tank):
  TANK_HP                   = 3
  TANK_CRUISE_SPEED         = 240
  TANK_MATCH_DELTA          = 70
  TANK_FIRE_INTERVAL        = 2.6..4.0s
  TANK_RECOIL_DURATION      = 0.2s   (NEW v4 — drives hull lurch + muzzle puff)
  SHELL_SPEED               = 560
  TANK_SCORE_REWARD = 2500, TANK_COIN_REWARD = 55

BossEnemies.ts (Drone):
  DRONE_HP                = 1
  DRONE_SIZE              = 22 (leader renders ×1.15)
  DRONE_HOVER_Y           = 90..170
  DRONE_SWOOP_SPEED       = 520
  Swarm count             = 4, one randomly flagged as leader
```

Per-section spawner config (`spawnInterval`, `enemyTypeWeights`, `civilianChance`, `vanIntervalMin/Max`, `shooterBurstChance`, `formationChance`) lives in each `SectionDef` in `data/sections.ts`.

Terrain handling unchanged from v3:
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
```

---

## 5. v5 focus areas — start here

The v4 plan deferred two items: aquatic enemy AI (§5.1) and per-section music (§5.4). These are v5's primary scope.

### 5.1 Aquatic enemy AI

`HARBOR_RUN` already includes a `'patrol'` enemy type with sine-weave AI in place (`updatePatrolAI`), but it's the only aquatic-distinct behavior. The handoff §5.1 also calls for a depth-charge dropper. Concrete next steps:

- **Depth-charge dropper** — new `EnemyType` (or reuse `patrol` with a sub-variant flag). Periodically drops a delayed-detonation hazard behind itself. Could plumb through a new entity in `entities/` (e.g., `DepthCharge.ts`) that lives in the world frame, sinks a moment, then explodes in a radius. Hazard collision should funnel through `takeDamage` like other lethal hits, with a new `DeathCause` (e.g., `'depth_charge'`).
- **Strafing jet-boat** — a fast aquatic shooter that strafes laterally while firing tight bursts. Reuses the new `Projectile.vx` from v4 — point the bursts in a fan pattern.
- **Patrol AI tuning** — `updatePatrolAI` weaves around a center that drifts toward the player at `0.9 * dt`. Feels OK but could be more aggressive at the swoop apex; consider speeding up the X drift when player vy is small (i.e., when the player is near-stationary in the world frame).
- **Boss variety on water** — harbor-run boss weights are already chopper-heavy. Consider a water-specific boss (gunboat? jet-ski formation?) instead of the tank, which feels out of place on water.

Most plumbing exists: `EnemyType` union in `EnemyCar.ts`, `enemyTypes` whitelist in `SpawnerOptions`, jetboat render dispatch in `renderJetboat`. New types just need a new entry in `ENEMY_CONFIGS` and a render branch.

### 5.2 Per-section music

`ProceduralMusicEngine` is mapped once at game start. Adding `musicTrack?: string` to `SectionDef` and swapping in `advanceSection()` would unlock per-section tracks. Small perceptual lift, well-scoped. The audio service's API for swapping mid-game tracks is the unknown — coordinate with the audio team / `audio-agent` subagent before plumbing.

### 5.3 Carryover items worth watching in v5 playtest

These were called out in v3/v4 but not actioned because they need playtest evidence first:

- **HP cap per section.** `MAX_HP = 3` is forgiving. If late sections feel trivial, gate via per-section HP cap on `SectionDef`.
- **Section-clear reward inflation.** `base + combo × lives × 250` scales fast at high lives counts. If late-game scores balloon, cap at `max(lives, 3)`.
- **Drone hover targeting.** Currently locks to player's position at swoop start. Could lead the player's velocity for a smarter prediction. Small change, big "drones got smart" feel.

### 5.4 Other ideas not on the v5 critical path

- **Replays / ghosts.** `dt`-keyed input serialization. Big lift; wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile. Nothing enforces it.
- **Pixel sprites.** `assetBudgetKB = 130` on the manifest is the current limit. v3 + v4 both stayed all-canvas. If a v5 art lead wants to migrate, raise the budget first.

---

## 6. Known small things still around

Carried over from v3 unless noted:

- `PlayerCar.pushOffRoad()` still unused (carried from v1).
- Armored enemies still skip oil-slick hits — flip if "bulletproof but oil-vulnerable" is desired.
- `BossSpawner` doesn't cull off-screen choppers — tail boom pops in before the body is fully on canvas. Cosmetic only.
- Section banner can briefly overlap with `EXTRA LIFE` or `LIFE LOST` overlays at threshold/section boundaries. All fade independently; visually fine in practice.
- Chopper is always the first boss spawned (intentional — preserves v2 feel). Flip the `bossesSpawned > 0` guard in `BossSpawner.spawnBoss` to mix earlier.
- **(v4)** Player vehicle `renderCar` is now ~250 lines with ~9 helpers. Considered extracting into a separate renderer module but kept inline since all helpers are tightly coupled to instance state. If it grows further, extract.
- **(v4)** Hood scoop's boost vibration uses `Math.sin(wakeT * 50)` — visible at boost but not at base/brake. Threshold `speed > BASE + 40` is conservative; tune if it feels too subtle.
- **(v4)** Loop subtitle reads `LOOP {wraparounds + 1}` so first loop has no subtitle suffix (correct), second loop reads "LOOP 2", third "LOOP 3", etc. Don't change the +1 — it's the natural reading.
- **(v4)** Civilian `roofRack` chance is hardcoded at 25% in the constructor. If tuning needs vary per section, plumb it via `SpawnerOptions` like `shooterBurstChance` is.

---

## 7. Validation gates (unchanged)

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # all tests pass (143 as of v4 ship)
npm run build          # production build succeeds
```

Manual signed-in QA checklist (carried from v3):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Manual QA additions for v4:
- **Ram telegraph + commit** — confirm rams flash yellow + render a dashed tracer line during lock, then charge straight at the locked X. A quick mid-lock swerve should beat them cleanly.
- **Shooter aim-lead + bursts** — strafe sideways at speed in section 3+ and confirm bullets angle to intercept (not straight down). On burst variants, the 3-shot sequence should commit even if you've already dodged out of arc.
- **Armored blocker** — armored should park in your lane center and match speed, not just nudge toward your X.
- **Formations** — section 3+ should occasionally spawn the flanked-ram (2 shooters + ram) or armored-corridor (armored + 2 trailing rams) setpieces.
- **Loop scaling** — clear all 7 sections, confirm "· LOOP 2" subtitle and noticeably faster spawns starting at section 1 of loop 2.
- **Per-section boss weights** — harbor run should bias toward choppers, alpine pass toward tanks. Sample a few bosses per section to feel the bias.
- **Player damage states** — take 1 hit, confirm scorch + crack appear; take 2nd hit, confirm torn fender + smoke trail + dark right headlight.
- **Player vehicle pass** — wheels should rotate, underglow should pulse and brighten with speed, exhaust flames should grow with throttle, hood scoop should vibrate at boost. Pick up a missile van and confirm the launcher pod appears on the trunk with 3 lit missile tips; fire one and confirm a tip goes dark + a brief dim. Same for oil drum and smoke nozzle.
- **Boat parity** — on harbor run, confirm cyan waterline halo, helmet visible in cockpit, secondary mount appears on the deck, wake brightens at boost with cyan jet plume.
- **Tank recoil** — confirm tank hull lurches up briefly on each shell fire with a yellow muzzle puff at the barrel tip.
- **Drone leader** — at least one drone per swarm should have gold accents + 3 crest spikes.
- **Civilian variety** — at least 4 of the 6 palettes should appear across a few minutes of play; some should have roof racks.

---

## 8. Suggested v5 sequencing

1. **Aquatic enemy AI (§5.1)** — biggest gameplay opportunity left. Start with depth-charge dropper since it's a new entity (good scope for one focused PR), then the strafing jet-boat (reuses `Projectile.vx`), then patrol AI tuning.
2. **Per-section music (§5.2)** — small, high-perception lift. Coordinate with audio team on the swap API first.
3. **Playtest-driven polish (§5.3)** — only act on HP cap / reward inflation / drone leading if QA shows the issue. Don't add speculatively.

Game's in a great place visually and mechanically. Keep the damage funnel green, keep the ram state machine intact, keep `getBounds()` honest, keep the validation gates passing, and v5 should be smooth.
