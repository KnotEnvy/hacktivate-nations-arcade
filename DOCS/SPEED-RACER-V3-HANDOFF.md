# Speed Racer — v3 → v4 Handoff

v3 shipped April 20 2026. Supersedes the earlier v3 planning doc and `SPEED-RACER-V2-HANDOFF.md` (both kept for history). This doc tells the next team what landed in v3, what stayed the same, and where to plug in next. **v4 focus areas: enemy AI, level difficulty curve, and car/vehicle design.**

---

## 1. What v3 added (since v2)

All v2 invariants preserved (recap flow, world-frame motion, validation gates, lives system, touch controls, section banners). v3 is a consolidation pass that fleshed out the scope items the v2 handoff deferred, plus one new big system: **chassis HP**.

### 1.1 Chassis HP / damage system
Each life now takes **3 lethal hits** before dropping. This is the biggest behavior change in v3 — it sits above the existing lives system, not replacing it.

- `MAX_HP = 3` — per-life damage buffer
- `HIT_INVULN_DURATION = 1.1s` — post-hit i-frames, separate from (and shorter than) `RESPAWN_INVULN_DURATION = 2.0s`
- `HIT_FLASH_DURATION = 0.5s` — chassis meter red-flash after a hit
- New `takeDamage(cause: DeathCause): boolean` funnel — returns `true` if HP ran out (life lost). All lethal collisions route through this instead of calling `triggerDeath` directly. **Exceptions**: `civilian_spree` and `self_end` still go straight to `triggerDeath` — they're not chassis damage.
- `respawn()` restores `hp = MAX_HP`, clears `hitFlash`.
- Non-lethal ram hits now also kill the ramming enemy (`enemy.alive = false` after `takeDamage`) so the ramming car can't instantly re-hit the player through i-frames.

**Chassis meter UI** (`renderChassisMeter` in `SpeedRacerGame.ts`, ~line 1200): 3 angled parallelogram armor plates labeled "CHASSIS" in the top-left HUD. Gradient green→amber→red based on `hp / MAX_HP`. Destroyed plates get crack lines. A red sweep overlay fades in on recent hits. Design intent: diegetic damage feedback, not just a number.

### 1.2 Boss variety (Tank + Drone Swarm)
`BossSpawner` now picks between three boss kinds on its 38–58s schedule. First boss after `sectionsCleared >= 1` is always a chopper (preserves v2 feel); after that, weighted picker:

| kind     | weight | reward (score/coin) | kill condition        |
|----------|--------|---------------------|-----------------------|
| chopper  | 0.45   | 1500 / 35           | missile only          |
| drones   | 0.30   | 200 / 4 per drone   | bullets or missiles   |
| tank     | 0.25   | 2500 / 55           | missile only (3 HP)   |

New entities live in `entities/BossEnemies.ts` (`Tank`, `TankShell`, `Drone`, `spawnTank`, `spawnDroneSwarm`). All share the implicit interface: `alive / update / render / getBounds / takeHit(missile) / isBulletproof()`. `BossSpawner` owns the pools (`tanks`, `shells`, `drones`) and exposes `getTanks()`, `getShells()`, `getDrones()` so `SpeedRacerGame` can run collisions in one place.

**Tank** — armored blocker, 3 HP, matches player speed minus a small delta, drifts laterally to block lanes, fires yellow-tracer shells every 2.6–4.0s. New death cause: `'tank_shell'` ("SHELLED BY TANK").

**Drone swarm** — 4 small fast units spawn across lanes with staggered timers. Each hovers, telegraphs with a red ring, then swoops to the player's *locked* position (not tracking). 1 HP each. Bullets work. New death cause: `'drone_swoop'` ("DRONE KAMIKAZE").

### 1.3 Terrain hazards (water + ice)
`systems/TerrainHazards.ts` spawns terrain-dependent hazards while on non-road sections. Cleared on every `setTerrain()` call so hazards don't leak across section boundaries.

- **`ice_patch`** (frost pass) — elliptical cracked-ice decal. While overlapping, player's decel is forced to zero (slip). Cosmetic crack lines on top.
- **`wake`** (harbor run) — horizontal foam streak. On first contact, one-shot lateral nudge of `±180 px/s` (direction randomized per hazard). Won't repeat until the player leaves and re-enters.

Spawn cadence: 2.0–4.6s. Road sections spawn none.

### 1.4 Weather system
`systems/Weather.ts` — `WeatherSystem` supports `'none' | 'snow'`. Frost pass gets snow. 80-flake pool, per-flake sway, screen-wrap recycle, plus a soft radial vignette layered over gameplay (under HUD) for a visibility-nerf feel. Cheap per-frame cost.

### 1.5 Section-clear reward
Clearing a section now awards a score bonus and guarantees a weapon van in the next section.

- `SECTION_CLEAR_BONUS_BASE = 500` plus `combo * lives * 250` — rewards keeping both your streak and your lives.
- `SECTION_CLEAR_FLASH_DURATION = 1.8s` — gold overlay briefly flashes the bonus alongside the banner.
- `spawner.scheduleVanIn(2.2)` called on every section change — next van is guaranteed ~2.2s into the new section.

### 1.6 Section 1 tutorial easing
Section 1 (`NEON_HIGHWAY`) now eases new players in instead of assuming they know the control set. Changes to its `spawnerConfig`:

- `spawnInterval: 2.4` (up from v2)
- `enemyTypeWeights: [1, 0, 0]` — **ram only**, shooter and armored zeroed out. `EnemySpawner.pickType` uses cumulative subtraction so a weight of 0 is a hard exclusion.
- `civilianChance: 0.35`, `civilianSpawnInterval: 3.4`
- `vanIntervalMin: 12`, `vanIntervalMax: 18`
- Section-1 van is guaranteed via `this.spawner.scheduleVanIn(6)` in both `onInit()` and `onRestart()` — every run gets a weapon tutorial moment within the first section.

### 1.7 Extra-life threshold lowered
`LIFE_BONUS_SCORES = [2500, 10000, 25000, 50000, 100000]`. Previously `[10000, 25000, 50000, 100000]`. Giving a second life at 2500 keeps casual players in the run long enough to see sections 2–3. Cap still `MAX_LIVES = 5`.

### 1.8 Death-cause-specific recap hints
`improvementHint()` now branches on `stats.cause` and returns a targeted one-liner before falling back to the generic "least-developed stat" hint. Covers all 7 causes: `enemy_ram`, `enemy_bullet`, `civilian_spree`, `chopper_bomb`, `tank_shell`, `drone_swoop`, `self_end`.

### 1.9 Achievement pass v2
4 new speed-racer achievements added to `src/data/achievements.ts`, bringing the total to 17. These target craft rather than quantity:

| id                         | requirement              | reward |
|----------------------------|--------------------------|--------|
| speedracer_pacifist_mile   | pacifist_distance ≥ 1000 | 200    |
| speedracer_surgeon         | perfect_sections ≥ 3     | 300    |
| speedracer_boss_hunter     | choppers_killed ≥ 3      | 350    |
| speedracer_globetrotter    | unique_sections_visited ≥ 7 | 600 |

New trackers live on `SpeedRacerGame`: `shotsFired`, `pacifistDistance`, `pacifistCurrent`, `choppersKilled`, `civiliansLostThisSection`, `perfectSectionsCleared`, `visitedSections: Set<number>`. All flow through `extendedGameData` at end-of-run and in the update loop. `GameEndData` extended with `pacifist_distance`, `choppers_killed`, `perfect_sections`, `unique_sections_visited`, `shots_fired`. `ArcadeHub.tsx` checks these in its `selectedGameId === 'speed-racer'` block.

### 1.10 Mobile polish
Virtual controls work correctly on scaled canvases now. Three fixes:

- **`InputManager.updateTouchState`** — previously returned raw `clientX/Y - rect.left/top`, which doesn't match canvas-internal coordinates when CSS-scaled. Now multiplies by `canvas.width / rect.width` (and same for Y). Mouse coordinates got the same treatment. Without this, D-pad hit boxes drifted off the rendered buttons on phones.
- **`TouchControls` button sizes** — D-pad bumped to `PAD_BTN = 56` with `PAD_GAP = 10`, FIRE circle radius `58`, WEAPON pill `108×52`. Comfortable thumb targets on small phones.
- **`ThemedGameCanvas.tsx`** — canvas style now sets `touchAction: 'none'` to disable pinch-zoom / swipe-back / double-tap zoom gestures over the game surface.

### 1.11 Road direction fix
All scroll patterns in `RoadRenderer.ts` were drifting upward as `worldScroll` grew, making forward motion feel like reverse. Every `y = -offset` / `y = -blockOffset` pattern flipped to `y = offset - cycleHeight`, plus `((x % cycle) + cycle) % cycle` normalization where needed for negative-safe modulo. Fixed for: dashed lines, roadside posts, water (waves + buoys), ice (banks + pines), trees, buildings, bridge, water shimmer, mountain layers, coast, wave lines.

---

## 2. Updated file map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # orchestrator + HP system + section-clear reward
├── index.ts
├── data/
│   ├── constants.ts
│   ├── secondaryWeapons.ts
│   └── sections.ts                # Section 1 eased; rest unchanged from v2
├── entities/
│   ├── PlayerCar.ts
│   ├── EnemyCar.ts
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts             # NEW — Tank, TankShell, Drone + spawn helpers
└── systems/
    ├── RoadRenderer.ts            # all scroll directions corrected
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # scheduleVanIn() used by section-clear + section 1 opener
    ├── BossSpawner.ts             # now weighted picker across chopper/tank/drones
    ├── TerrainHazards.ts          # NEW — ice_patch + wake hazards
    ├── Weather.ts                 # NEW — snow particles + vignette
    ├── TouchControls.ts           # enlarged buttons
    ├── Particles.ts
    └── CameraShake.ts
```

Outside the game folder (touched in v3):
- `src/components/arcade/ArcadeHub.tsx` — `GameEndData` extended with v3 metric keys; 4 new achievement checks wired
- `src/components/arcade/ThemedGameCanvas.tsx` — `touchAction: 'none'` on the canvas
- `src/data/achievements.ts` — 4 new achievements
- `src/services/InputManager.ts` — touch + mouse coordinate scaling fix

---

## 3. Conventions still in force (don't regress)

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** Road `X_MIN=160` / `X_MAX=640`. Player Y `480`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards and terrain hazards stick to ground (`vy = playerSpeed`).
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycleHeight`, not `y = -offset`.
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)` — don't call `triggerDeath` directly from collision code. `civilian_spree` and `self_end` are the only direct callers.
- **Recap invariant.** New death causes require extending the `DeathCause` union, the `causeLabel` map, and the `improvementHint` switch.
- **Edge detection** for single-shot actions: track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Touch coordinates.** `InputManager.updateTouchState` now returns canvas-internal coords. Don't re-introduce raw client coords anywhere.
- **Lint does NOT honor `_`-prefixed unused params.** Remove the param entirely.
- **`gameThemes.test.ts`** enforces unique theme primary colors. Don't reuse `#FF0080`.

---

## 4. Tuning knobs (top of `SpeedRacerGame.ts`)

```
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
```

Boss schedule (`BossSpawner.ts`):
```
FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
COOLDOWN          = 38..58s between bosses
Weighted picker (after first chopper):
  chopper  0.45
  drones   0.30
  tank     0.25
```

Tank (`entities/BossEnemies.ts`):
```
TANK_HP                   = 3
TANK_CRUISE_SPEED         = 240
TANK_MATCH_DELTA          = 70
TANK_FIRE_INTERVAL        = 2.6..4.0s
TANK_APPROACH_RANGE       = 320
SHELL_SPEED               = 560 (fixed screen velocity)
TANK_SCORE_REWARD = 2500, TANK_COIN_REWARD = 55
```

Drone (`entities/BossEnemies.ts`):
```
DRONE_HP                = 1
DRONE_SIZE              = 22
DRONE_HOVER_Y           = 90..170
DRONE_SWOOP_SPEED       = 520
DRONE_RETREAT_SPEED     = 260
Swarm count             = 4, lane-spaced
DRONE_SCORE_REWARD = 200, DRONE_COIN_REWARD = 4
```

Per-section spawner config (`spawnInterval`, `enemyTypeWeights`, `civilianChance`, `vanIntervalMin/Max`) lives in each `SectionDef` in `data/sections.ts`. `EnemySpawner.pickType` does cumulative subtraction, so a weight of `0` is a hard exclusion.

Terrain handling (`TERRAIN_HANDLING` in `sections.ts`):
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
```

---

## 5. v4 focus areas — start here

The next team has three priorities: **enemy AI**, **level difficulty**, and **car design**. Everything else is secondary.

### 5.1 Enemy AI

Enemy behavior is still largely v1-era: ram cars track the player's X linearly, shooters fire on a fixed cadence, armored units just bulk up. Boss enemies added in v3 are more expressive, but the regular traffic is the bulk of the playtime and feels predictable. Ideas:

- **Ram AI** — currently just `dx = playerX - this.x` at max steer. Could add a telegraph + commit pattern: they choose a lane, lock in, then charge, so a quick swerve makes them miss. Feels more like Spy Hunter.
- **Shooter AI** — fires on interval regardless of player position. Could aim-lead based on player velocity, or fire bursts then strafe. `EnemySpawner.updateShooter` is the hook.
- **Armored AI** — currently passive. Could slow to match player speed and intentionally block the lane, forcing missile use. Creates a "push vs break through" decision.
- **Shooter bullet behavior** — hard-coded `ENEMY_BULLET_SPEED` in `EnemySpawner`. Move into `ENEMY_CONFIGS` so variants can differ.
- **Formation spawning** — `EnemySpawner` currently spawns one enemy per interval. A weighted chance to spawn a formation (two shooters flanking a ram) would create readable setpieces without authoring content.
- **Aquatic enemy AI** — harbor-run jet-boats currently share road-car AI behind a sprite swap. A sine-path weaver or depth-charge dropper would make water feel distinct. Plumb via a new `EnemyType` in `ENEMY_CONFIGS` gated through the existing `enemyTypes` whitelist on `SpawnerOptions`.
- **Drone hover targeting** — drone swarm swoop picks a locked target on state change. Could predict: lock a target *ahead* of the player's velocity instead of current position.

Most of this is local to `entities/EnemyCar.ts` + `systems/EnemySpawner.ts` + `entities/BossEnemies.ts`. No system rework needed.

### 5.2 Level difficulty

v3 eased section 1 but didn't touch the overall curve. Problems to solve:

- **Curve smoothness.** Section 1 is now gentle; section 2 jumps straight to shooters + 1 armored. A smoother ramp (ease shooters in via weight 0.3, then 0.7 across sections) would reduce the "I just learned the game and now I'm dying" cliff.
- **Difficulty per lap.** The game loops sections after section 7. Second loop should be harder — boost `spawnInterval`, re-weight enemy types toward armored/shooter, raise boss cadence. Track `wraparounds` in `SpeedRacerGame.advanceSection` and multiply spawner config values.
- **Boss frequency feels flat.** `FIRST_BOSS_DELAY = 14` and `COOLDOWN = 38..58` is a single schedule regardless of section. Could tie boss rate to section difficulty — harbor run gets more choppers, alpine pass gets more tanks, etc.
- **HP vs difficulty.** Chassis HP of 3 is forgiving. If it turns out too forgiving at higher sections, the knobs are `MAX_HP` (whole run) or a per-section HP cap via `SectionDef`.
- **Section-clear reward inflation.** `base + combo * lives * 250` scales fast with lives. Watch this; consider capping at `max(lives, 3)` if late-game scores balloon.
- **Difficulty surfacing.** Nothing tells the player they're in a harder loop. A section-banner subtitle like "LOOP 2" or a palette shift would help.

### 5.3 Car / vehicle design

Player and enemy silhouettes are functional but plain. Current state:

- **PlayerCar** has two visuals: `'car'` (default) and `'boat'` (water sections). Canvas-drawn, no sprite sheet. Damage state isn't reflected on the car itself — only in the chassis meter. Ideas: scorch marks after a hit, visible dent + steam at HP=1, broken headlight at HP=2.
- **EnemyCar** has two visuals: `'car'` and `'jetboat'`. Ram / shooter / armored all share the same base silhouette with type-specific accents. Opportunity: give each type a clearly distinct shape so players read threat at a glance without color coding.
- **BombChopper** is the most expressive boss — rotor, tail boom, under-belly bomb bay. Good reference for the visual bar to hit on other enemies.
- **Tank** is readable but static — treads animate but the hull doesn't. A slight hydraulic bob when firing would sell the weight.
- **Drones** are tiny (22px) and rely on the red swoop-ring for telegraph. Could use distinct swarm-leader vs swarm-follower looks.
- **Civilians and weapon vans** are the most dated visuals. Both would benefit from a pass.

All vehicle rendering is canvas-drawn (no sprite assets yet). If the team wants to move to pixel sprites, `assetBudgetKB = 130` on the manifest is the current budget — flag if that needs raising.

### 5.4 Deferred (not v4 priorities)

Kept here so the team knows these exist but aren't expected this round:

- **Per-section music.** `ProceduralMusicEngine` is mapped once at game start. `musicTrack` field on `SectionDef` + a swap in `advanceSection()` would unlock this. Small perceptual lift.
- **Replays / ghosts.** `dt`-keyed input serialization. Big lift; defer unless arcade-wide replay infra lands first.
- **Landscape orientation lock** on mobile. Nothing enforces it.

---

## 6. Known small things still around

- `PlayerCar.pushOffRoad()` still unused (carried from v1).
- Armored enemies still skip oil-slick hits — flip if "bulletproof but oil-vulnerable" is desired.
- `EnemySpawner.updateShooter` still hard-codes `ENEMY_BULLET_SPEED`. Move into `ENEMY_CONFIGS` if shooter variants are added (see §5.1).
- `BossSpawner` doesn't render off-screen culling for choppers — tail boom pops in before the body is fully on canvas. Cosmetic only.
- Section banner can briefly overlap with the `EXTRA LIFE` overlay if a threshold is crossed exactly at a section boundary. Both fade independently; visually fine.
- Section-clear overlay can also briefly overlap with `EXTRA LIFE` or `LIFE LOST` — all three fade on independent timers. Never seen it look broken in practice.
- Chopper is always the first boss spawned (intentional — preserves v2 feel). If a v4 tuner wants to mix earlier, flip the `bossesSpawned > 0` guard in `BossSpawner.spawnBoss`.

---

## 7. Validation gates (unchanged)

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # all tests pass
npm run build          # production build succeeds
```

Manual signed-in QA still TODO:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Added for v4:
- **Chassis HP** — take 2 hits, confirm meter drops from green → amber, red flash fires, player flickers for i-frames, 3rd hit loses a life. Confirm `hp` resets to 3 on respawn.
- **Boss variety** — clear section 1 to trigger first (always chopper), then play long enough to see tank + drone swarm. Confirm tank dies to missiles only and drone swarm dies to bullets.
- **Terrain hazards** — reach harbor run, confirm wake streaks nudge laterally once per contact. Reach frost pass, confirm ice patches zero decel.
- **Snow vignette** — frost pass shows snowflakes + soft radial dimming. Confirm flakes don't leak into other sections.
- **Section-clear reward** — clear a section, confirm gold `SECTION CLEAR +N` overlay and a guaranteed weapon van ~2s into the next section.
- **Road direction** — drive forward, confirm all scenery (dashes, posts, trees, buildings, mountains, coast, water waves, ice banks) drifts **downward** off the bottom of the screen.
- **Touch QA** — on a real phone, confirm D-pad hit boxes align with the rendered buttons and FIRE/WEAPON respond cleanly. Pinch-zoom and swipe-back should be disabled over the canvas.

---

## 8. Suggested v4 sequencing

1. **Enemy AI pass (§5.1)** — biggest gameplay upside. Start with ram telegraph + commit, then shooter aim-lead. Armored blocker after.
2. **Difficulty curve (§5.2)** — lap-scaling first (small, high-impact), then section 2 smoothing, then per-section boss rates.
3. **Car design pass (§5.3)** — damage states on player first (hooks into existing `hp`), then enemy silhouettes.
4. **Aquatic enemy AI (§5.1)** — natural follow-on to car design; needs new `EnemyType` plumbing.
5. **Per-section music** — only if there's time after the three focus areas.

Game is in a good place. Keep the damage funnel, world-frame motion, scroll direction, and validation gates green, and v4 should be smooth.
