# Speed Racer — v6 → v7 Handoff

v6 shipped 2026-04-29. This is the **only** Speed Racer handoff doc — supersedes all prior versions, which have been removed. The previous coder is on this team and can answer questions about anything below or anything in `git log`.

**v7 is open scope.** No mandatory headline feature; pick from the backlog in §4.

---

## 1. What v6 added

v6 was the "road as gameplay" pass — the Spy-Hunter driving identity Speed Racer was missing. Five steps shipped, all guarded by validation gates and ratified in playtest:

1. **RoadProfile pipeline** — every road-geometry call site (player clamp, enemy clamp, spawner lane math, off-road kill, renderer) now goes through `RoadProfile`. Default `StraightRoadGeometry` preserves v5 behavior; per-section geometries override it.
2. **Width changes** (§4 ALPINE PASS) — `WidthChangeGeometry` keyframes. Two narrow chokepoints (4 lanes → 3) with smooth tapers.
3. **Forks / splits** (§5 SUNSET COAST) — `ForkGeometry` keyframes. Road parts around a divider mid-section. Player commits to a side; crossing the divider chips HP via new `'barrier_collision'` `DeathCause`. Enemies clamp per-segment; bumping one across the divider scores like off-road. Concrete-divider visual with scrolling yellow/black hazard chevrons.
4. **Tunnels** (§2 NEON CITY) — `tunnelZones?: TunnelZone[]` on `SectionDef`. Pure visual overlay, no geometry change. Per-row darkness fade + periodic light bands strobing overhead.
5. **Drivable shoulders** (§1 NEON HIGHWAY) — `ShoulderedRoadGeometry` extends drivable area beyond pavement. Player only — enemies stay on pavement. Multiplicative handling penalty on shoulders.

All v5 invariants preserved (chassis HP funnel, world-frame motion, ram state machine, validation gates, `getBounds()` honesty, single-block player visual state, bump-knockoff loop).

---

## 2. Road geometry pipeline (the key concept)

Everything road-shaped goes through `RoadProfile`. Read this before touching anything in `entities/`, `systems/EnemySpawner.ts`, or `systems/RoadRenderer.ts`.

### Coordinate system

- `worldScroll` = total distance traveled (RoadRenderer accumulates each frame).
- `sectionStartScroll` = `worldScroll` value when the active section began. Captured in `SpeedRacerGame.applyRoadProfile()`.
- **Section-relative `worldY`** = `currentScroll - sectionStartScroll`. Geometry is keyed on this so profiles are reusable across loops.
- Player sits at fixed screen Y (`PLAYER.Y = 480`), so `playerWorldY === sectionRelativeScroll`.
- For an entity at screen Y `s`: `entityWorldY = playerWorldY + (PLAYER.Y - s)`.

### Module layout

```
systems/
├── RoadProfile.ts       # RoadShape / RoadSegment / RoadGeometry interfaces.
│                        # StraightRoadGeometry (default).
│                        # RoadProfile live wrapper — owns scroll/section
│                        # bookkeeping, exposes screen-Y aware queries.
├── RoadGeometries.ts    # WidthChangeGeometry, ForkGeometry,
│                        # ShoulderedRoadGeometry. New geometries land here.
└── RoadRenderer.ts      # Fast path (uniform geometry → single fillRect)
                         # + slow path (per-row strips with run accumulation
                         # per segment index).
```

### `RoadShape` anatomy

```ts
interface RoadShape {
  xMin: number;          // outer hull (pavement leftmost)
  xMax: number;          // outer hull (pavement rightmost)
  segments?: ReadonlyArray<RoadSegment>;       // forks
  shoulder?: { xMin: number; xMax: number };   // drivable shoulders
}
interface RoadSegment {
  xMin: number;
  xMax: number;
  laneCount: number;
}
```

- `xMin/xMax` always populated. Single-road geometries use only these.
- `segments` = forks. Two-segment shape with a divider gap in between.
- `shoulder` = drivable area outside pavement. Player-tactical only; enemies stay on `xMin/xMax`.
- Forks + shoulders don't currently combine in any one section; the API allows it but no geometry implements both yet.

### Adding a new geometry

1. Implement `RoadGeometry` in `RoadGeometries.ts`. Methods:
   - `shapeAt(worldY): RoadShape`
   - `laneCount(worldY): number`
   - `laneCenterAt(worldY, lane): number`
   - `isOnRoad(worldY, x): boolean`
   - `isUniform(): boolean` — `true` lets the renderer take its single-fillRect fast path.
2. Set `roadGeometry: new YourGeometry(...)` on a `SectionDef`.
3. If your geometry needs a slow-path render (varying shape per row), make sure `isUniform()` returns `false` so the renderer walks per-row.

The renderer already handles segments and shoulders generically — most new geometries shouldn't need renderer changes.

---

## 3. Conventions in force (don't regress)

These are the invariants. If you find yourself working around one, that's a smell — talk to me before bypassing.

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** `PLAYER.Y = 480` is load-bearing for the world-Y math.
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycle`, not `y = -offset`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`).
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)`. Don't call `triggerDeath` directly from collision code (`civilian_spree` and `self_end` are the only direct callers).
- **Recap invariant.** New `DeathCause` requires extending the union, the `causeLabel` map, AND the `improvementHint` switch. v6 added `'barrier_collision'`; follow that pattern.
- **`getBounds()` is sacred.** Visual changes leave the configured `width × height` hitbox alone.
- **Edge-detect single-shot inputs.** Track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Ram AI is a state machine** (`cruise → lock → charge`). Don't restore continuous tracking. v6 added a same-segment guard so rams won't lock through a divider — keep that.
- **Bump-knockoff loop is sacred.** Side-swipes inject `bumpVx`, never deal direct damage and never directly kill. Off-road kill credit is owned by `SpeedRacerGame`'s post-spawner scan, not `EnemyCar`. AI lateral motion + road clamp suspend while `|bumpVx| > BUMP_AI_SUPPRESS = 30`. `bumpResistance` is the only knob — no per-type force multipliers in `SpeedRacerGame`.
- **Section 1 enemy weights `[1, 0, 0]` are tutorial-load-bearing.** Ram-only by design. Cumulative-subtraction picker treats weight 0 as hard exclusion.
- **Player visual state is set once per frame.** `setDamageLevel`, `setSecondary`, `setOnShoulder`, `pulseGunRecoil` all called from one block in `SpeedRacerGame.update()` right after `player.update()`.
- **Lap scaling is monotonic and clamped.** `applyLapScaling` floors `spawnInterval` at 0.6s, caps `shooterBurstChance` at 0.6, caps `formationChance` at 0.35.
- **Difficulty pressure axes ramp monotonically §1 → §7.** New sections slot on the curve at their natural intensity, not flat.
- **(v6) RoadProfile is the ONLY way to query road shape.** Don't import `ROAD` constants for clamp/lane math anywhere. Use `roadProfile.shapeAt*` / `laneCenterAt*` / `isOnRoadAtScreen`. The `ROAD` constants in `data/constants.ts` are legacy fallbacks used only by `StraightRoadGeometry`.
- **(v6) Section-relative worldY for geometry queries.** Profiles are keyed on distance-into-section, not absolute scroll. `RoadProfile` handles the conversion; consumers just call screen-Y-aware helpers.
- **(v6) Forks: divider crossing routes through `takeDamage('barrier_collision')`.** `PlayerCar.pendingDividerHit` is read+cleared by `SpeedRacerGame` after `player.update`. Don't call `takeDamage` from inside `PlayerCar`.
- **(v6) Forks: same-segment guard for AI targeting.** Both `updateRamAI` and `updateArmoredAI` bail when player is on the opposite side. Add the guard to any new player-targeting AI.
- **(v6) Shoulders are player-tactical only.** Enemies clamp to pavement; off-road kill scan uses pavement bounds (so bumps onto shoulder still score). Don't extend shoulders to enemies without re-thinking the bump loop.
- **(v6) Lint does NOT honor `_`-prefixed unused params alone.** Use `void _name;` to satisfy the rule when interface contracts force the param to remain.

---

## 4. v7 backlog — pick anything

Roughly priority-ordered. Nothing is mandatory; nothing blocks anything else.

### 4.1 — Aquatic enemy AI (carryover from v4)
The slate is clean for water content:
- Depth-charge dropper enemy (water analog of chopper bombs)
- Strafing jet-boat enemy (lateral patrol with bursts)
- Patrol AI tuning — currently uses sine weave; could feel more boat-like
- `EnemyType` union extends easily, `Projectile.vx` already exists for fan patterns, `enemyVisual: 'jetboat'` is plumbed. §6 HARBOR_RUN is the natural target.

### 4.2 — Per-section music (carryover from v4)
- `ProceduralMusicEngine` is mapped once at game start. Add `musicTrack?: string` to `SectionDef` and swap in `advanceSection()`.
- Coordinate with audio team on swap API. May need fade-in/fade-out to avoid jarring transitions.

### 4.3 — Real bridge transition (deferred from v6 Step 4)
- §3 STEEL_SPAN already reads as a bridge via the existing `sceneryStyle: 'bridge'` (towers + cross-bracing). v6 deferred "promoting" it because tunnels were higher impact.
- Promote it: add palette crossfade across a worldY range so the road body shifts to concrete + edges become railing-style during the bridge stretch.
- Probably wants a new `paletteOverride?` mechanism on a worldY zone (similar shape to `tunnelZones`).

### 4.4 — Drone hover targeting prediction
- Currently locks to player's position at swoop start. Could lead the player's velocity for smarter prediction.
- Small change in `BossEnemies.ts` Drone state machine. Easy win.

### 4.5 — HP cap per section
- Currently MAX_HP = 3 globally. If late sections feel trivial with full HP, gate via per-section HP cap on `SectionDef`.
- Only act if playtest shows §6/§7 are too easy.

### 4.6 — Section-clear reward inflation cap
- `base + combo × lives × 250` scales fast at high lives counts. If late-game scores balloon, cap at `max(lives, 3)` or similar.
- Only act if leaderboards start looking absurd.

### 4.7 — Bump-mechanic playtest tuning
- v5 just shipped the knockoff loop; v6 didn't touch it. Knobs in `SpeedRacerGame.ts` (BUMP_FORCE_MIN/MAX, BUMP_OFF_ROAD_MARGIN) and `EnemyCar.ts` (BUMP_FRICTION, BUMP_AI_SUPPRESS, per-type bumpResistance).
- Watch for: soft cars too easy, enforcers trivial/impossible, SWAT bumpable at boost, slide too sticky/fast.

### 4.8 — Bigger-than-an-incremental ideas
- **Replays / ghosts.** `dt`-keyed input serialization. Wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile. Nothing currently enforces it.
- **Pixel-sprite migration.** `assetBudgetKB = 130` on the manifest is the current limit. v3/v4/v5/v6 stayed all-canvas. If a v7 art lead wants to migrate, raise the budget first.

---

## 5. Tuning knobs (the cheat sheet)

```
SpeedRacerGame.ts (top constants):
  COMBO_DECAY_TIME          = 4.0s        MAX_COMBO_MULTIPLIER  = 5
  CIVILIANS_LOST_GAME_OVER  = 3           STARTING_LIVES        = 1
  MAX_LIVES                 = 5           LIFE_BONUS_SCORES     = [2500, 10000, 25000, 50000, 100000]
  RESPAWN_INVULN_DURATION   = 2.0s        MAX_HP                = 3
  HIT_INVULN_DURATION       = 1.1s        HIT_FLASH_DURATION    = 0.5s

  Bump (v5):
    BUMP_FORCE_MIN          = 80          BUMP_FORCE_MAX        = 520
    BUMP_OFF_ROAD_MARGIN    = 30          Player recoil         = 50 + bumpResistance * 30

  Section-clear reward:
    SECTION_CLEAR_BONUS_BASE             = 500
    SECTION_CLEAR_BONUS_PER_COMBO_LIFE   = 250

  Lap scaling (private):
    spawn floor 0.6s        burst cap 0.6           formation cap 0.35
    spawn × 0.9^wraparounds           burst +0.08 per loop      formation +0.05 per loop

EnemyCar.ts:
  BUMP_FRICTION   = 240   BUMP_AI_SUPPRESS = 30   BUMP_COOLDOWN = 0.12
  RAM_LOCK_TRIGGER = 300  RAM_LOCK_DURATION = 0.4 RAM_CHARGE_LATERAL = 320
  APPROACH_RANGE   = 280  FORWARD_SPEED_ACCEL = 280

  Per type (forwardSpeed / matchSpeedDelta / bumpResistance / hp):
    ram      260 /  20 / 1.0 /  1     shooter  300 / 60 / 1.0 / 2 (bulletSpeed 520)
    enforcer 250 /  50 / 2.5 / Inf    armored  180 / 80 / 6.0 / Inf
    patrol   300 /  30 / 1.0 /  1

EnemySpawner.ts:
  BURST_INTRA_COOLDOWN = 0.18s          MAX_AIM_LEAD_VX = ±200 px/s
  Inter-burst cooldown = 1.4 + Math.random() * 0.8

BossSpawner.ts:
  FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
  COOLDOWN          = 38..58s between bosses
  Default weights   = [chopper 0.45, drones 0.30, tank 0.25]
  Per section:
    'harbor-run'  [0.60, 0.30, 0.10]
    'alpine-pass' [0.25, 0.20, 0.55]
    'steel-span'  [0.45, 0.30, 0.25]
```

Per-section spawner config + lap scaling lives in each `SectionDef` in `data/sections.ts`. Terrain handling:
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
shoulder modifier (v6) → steerMul ×0.65, decelMul ×0.55 (multiplied on top of section terrain)
```

---

## 6. Validation gates

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # 145 tests pass as of v6 ship
npm run build          # production build succeeds
```

Manual signed-in QA checklist:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

---

## 7. v6-specific gotchas worth knowing

- **`ROAD` constants in `data/constants.ts` are legacy.** Only `StraightRoadGeometry` reads them. Don't add new imports of `ROAD.X_MIN/X_MAX/WIDTH/CENTER/LANE_COUNT` outside that file — go through the profile.
- **Renderer slow path uses run accumulation per segment index.** Stable wide / narrow / fork-sustain stretches collapse to 1 or 2 fills. Tapers and fork open/close cost one fill per affected row. Body, edges, divider, lane markings, tunnel overlay all use this pattern.
- **`ForkGeometry` requires constant segment count across keyframes.** Outside the fork the segments touch (divider width 0). Constraint is checked at construction.
- **Width-change lane-count snapping.** `WidthChangeGeometry.laneCount(worldY)` uses the previous keyframe's value, so lane count stays stable through each "stretch" and changes only at keyframe boundaries. Mid-taper width interpolates smoothly; lane count pops once at the deliberate boundary.
- **Tunnel overlay covers entities.** It draws AFTER particles but before weather/vignette. Snipers in NEON_CITY's tunnel still hit you — only visibility is reduced, not collision.
- **`PlayerCar.currentSegmentIdx` is auto-assigned on the FIRST fork frame** (no entry penalty). Reset when the fork ends. Hits divider only when player tries to cross MID-fork.
- **Section 1 (NEON_HIGHWAY) shoulders are 60px each side.** Pavement [160, 640], envelope [100, 700]. Tutorial introduces the shoulder mechanic implicitly.
- **`roadGeometry` is set in `applyRoadProfile()` from each `SectionDef`.** Sections without `roadGeometry` get `StraightRoadGeometry` automatically.
- **`tunnelZones` is read each render frame from `currentSection`.** Adding zones to a section is purely declarative.
- **Per-handoff invariant docs were removed.** This is the only one. If you need the old prose for context, `git log --diff-filter=D --summary -- DOCS/SPEED-RACER-V*-HANDOFF.md` will show when they were deleted.

---

## 8. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # game loop, damage funnel, collision resolution,
│                                  #   recap, applyRoadProfile, off-road bump-kill scan
├── index.ts
├── data/
│   ├── constants.ts               # PLAYER + legacy ROAD constants (only StraightRoadGeometry uses ROAD)
│   ├── secondaryWeapons.ts
│   └── sections.ts                # SectionDef, SectionPalette, TunnelZone, all 7 sections
├── entities/
│   ├── PlayerCar.ts               # segment-aware clamp, shoulder handling, pendingDividerHit
│   ├── EnemyCar.ts                # 5 enemy types, bump physics, segment-aware AI
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts             # Tank/Drone, profile-aware spawn helpers
└── systems/
    ├── RoadProfile.ts             # interfaces + StraightRoadGeometry + RoadProfile wrapper
    ├── RoadGeometries.ts          # WidthChangeGeometry, ForkGeometry, ShoulderedRoadGeometry
    ├── RoadRenderer.ts            # body / edges / lanes / divider / tunnel overlay / posts / shoulders
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # segment-aware spawn, formations bail in fork sections
    ├── BossSpawner.ts
    ├── TerrainHazards.ts
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

---

## 9. Section identity at a glance

| § | Section        | Geometry feature          | Enemy mix              | Boss bias             |
|---|----------------|---------------------------|------------------------|-----------------------|
| 1 | NEON HIGHWAY   | Drivable shoulders        | ram-only (tutorial)    | (no bosses yet)       |
| 2 | NEON CITY      | Tunnel mid-section        | ram + shooter          | default               |
| 3 | STEEL SPAN     | Visual bridge (scenery)   | + enforcer             | default               |
| 4 | ALPINE PASS    | Two narrow chokepoints    | ram-heavy + civilians  | tank-heavy            |
| 5 | SUNSET COAST   | Fork with central divider | balanced 4-type        | default               |
| 6 | HARBOR RUN     | (none — water terrain)    | + patrol (jet-boats)   | chopper-heavy         |
| 7 | FROST PASS     | (none — ice terrain)      | tightest spawns        | default               |

The next geometry feature should probably target a section that doesn't already have one (§3 if you do bridge promotion; §6 or §7 if you want fresh terrain). Don't stack two new geometry features in the same section without a strong reason.
