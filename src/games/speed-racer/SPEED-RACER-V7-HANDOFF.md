# Speed Racer — v7 → v8 Handoff

v7 shipped 2026-05-02. This is the **only** Speed Racer handoff doc — supersedes all prior versions, which have been removed. The previous coder is on this team and can answer questions about anything below or anything in `git log`.

**v8 is the production-polish pass.** v7 closed the unconditional backlog. What's left is QA, audio/feel, and the playtest-gated tuning knobs that need real player data — see §4.

---

## 1. What v7 added

v7 was the "finish the open backlog" pass before production polish. Three independent items shipped:

1. **Drone targeting prediction** (§4.4 in v6 backlog) — Drone swoop now leads `playerVx` at lock time. Capped at `DRONE_MAX_LEAD = 120px` so a committed sideways dodge can still escape by reversing mid-swoop (target is locked at swoop start, not re-aimed). `playerVx` now threaded through `BossSpawner.update` → `Drone.update`.
2. **Real bridge transition for Steel Span** (§4.3) — §3 was previously a bridge in scenery only. Now it's a true road-body transition. Introduces the reusable **`PaletteOverrideZone`** mechanism (see §2 below). STEEL_SPAN crossfades to weathered concrete deck, steel-railing edges, amber warning glow, white lane paint across worldY 1500–6500 with 350-unit fades on each end.
3. **Aquatic enemies for Harbor Run** (§4.1) — §6 previously just reskinned road enemies. Now it has signature water threats:
   - **`dropper`** — slate-blue jet-boat with a stern release rack. Slow lateral drift (50 px/sec) toward the player. Releases timed depth charges into the player's lane.
   - **`strafer`** — magenta jet-boat with twin forward gun barrels. Patrol-style sine weave + shooter-style aim-lead bursts.
   - **`DepthCharge`** entity (`entities/DepthCharge.ts`) — fuse-timed canister with blinking red telegraph (blink rate ramps as fuse runs out), water-spume detonation, radial damage check. Models after `BombChopper.Bomb`'s `justExploded` pattern.
   - New `'depth_charge'` `DeathCause` extending union, `causeLabel` map, AND `improvementHint` switch.

All v5/v6 invariants preserved (chassis HP funnel, world-frame motion, ram state machine, validation gates, `getBounds()` honesty, single-block player visual state, bump-knockoff loop, RoadProfile pipeline, fork same-segment guards, shoulders are player-only).

---

## 2. PaletteOverrideZone — the new reusable infra

v7 introduced one piece of infra worth understanding before touching `data/sections.ts` or anything render-related.

### What it does

`PaletteOverrideZone` declaratively crossfades any subset of color fields on a section's `SectionPalette` across a section-relative worldY range. Think "this stretch of §3 has concrete instead of neon," but reusable for any future "the road itself changes paint" effect.

### Shape

```ts
interface PaletteOverrideZone {
  startWorldY: number;
  endWorldY: number;
  fadeLength?: number;                    // worldY units of fade-in/out at each end. Default 200.
  palette: Partial<Pick<SectionPalette, PaletteColorField>>;  // only the fields you want to override
}
```

`PaletteColorField` is the union of every string color field on `SectionPalette`. Numeric fields (`horizonAlpha`) and enum fields (`sceneryStyle`) are intentionally NOT overridable — those describe layout/intensity, not paint. Add them only if you have a real reason to interpolate them.

### How it resolves

`resolvePalette(section, sectionRelativeWorldY)` is a pure free-standing function in `data/sections.ts`. Called once per render frame from `SpeedRacerGame.onRender()` using `roadProfile.playerWorldY()`. Sections without overrides return the base palette unchanged (zero overhead).

### Coordinate notes

- `worldY` is **section-relative** (matches the rest of the v6 RoadProfile pipeline). Profiles are reusable across loops without bookkeeping at the section level.
- Multiple zones in one section compose left-to-right.
- Hex color interpolation is straight RGB lerp. If you need perceptual interpolation (HCL, OKLCH), upgrade `lerpHex` — call sites won't notice.

### When to use it

Good fits: tunnels where the road body should darken inside, weather where the surface looks wet, set-piece transitions like the bridge. Bad fits: static section identity (just set the base palette), per-frame effects (use a render-time overlay instead).

---

## 3. Conventions in force (don't regress)

These are the invariants. If you find yourself working around one, that's a smell — talk to me before bypassing.

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** `PLAYER.Y = 480` is load-bearing for the world-Y math.
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycle`, not `y = -offset`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`). Depth charges follow the hazard model.
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)`. Don't call `triggerDeath` directly from collision code (`civilian_spree` and `self_end` are the only direct callers).
- **Recap invariant.** New `DeathCause` requires extending the union, the `causeLabel` map, AND the `improvementHint` switch. v6 added `'barrier_collision'`; v7 added `'depth_charge'`; follow that pattern.
- **`getBounds()` is sacred.** Visual changes leave the configured `width × height` hitbox alone.
- **Edge-detect single-shot inputs.** Track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Ram AI is a state machine** (`cruise → lock → charge`). Don't restore continuous tracking. Same-segment guard prevents rams locking through a divider — keep it.
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
- **(v7) `PaletteOverrideZone` is for color crossfades only.** Numeric/enum palette fields aren't in the override union. If you need to fade `horizonAlpha` etc., extend `PaletteColorField` AND `lerpHex` consciously — don't sneak it in.
- **(v7) `resolvePalette` is called once per frame in `onRender`.** Don't call it from per-row render code — that re-walks the override list 600× per frame and tanks slow-path geometry sections.
- **(v7) Depth charges follow the `justExploded` single-frame pattern.** Set `justExploded = true` on the detonation frame, immediately false the next update. The game's collision pass relies on this for exactly-once damage. Mirrors `Bomb.justExploded`.
- **(v7) Anything with `EnemyConfig.bulletSpeed != null` fires through `EnemySpawner.updateShooter`.** That's how `strafer` reuses the shooter aim-lead pipeline. New shooting enemies should set `bulletSpeed` rather than spawning projectiles in their own AI.
- **(v7) Drone swoop target is locked at swoop start, NOT re-aimed mid-swoop.** Lead is computed once when transitioning hover → swoop. Re-aiming would break the "reverse direction to dodge" escape that the lead cap (`DRONE_MAX_LEAD = 120`) was designed around.

---

## 4. v8 backlog — production polish

### 4.1 — Manual signed-in QA pass (HIGH PRIORITY)

The signed-in flow has been deferred since v1. Before production, walk a real account through:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account, ordered correctly.
- Challenge progress advances on each metric: distance, top speed, max combo, powerups used.
- Achievements unlock at the right thresholds.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Half-day of focused testing. Block production until done.

### 4.2 — Per-section music (carryover from v6)

Still deferred — needs audio team coordination on the swap API and fade timing.
- `ProceduralMusicEngine` is mapped once at game start. Add `musicTrack?: string` to `SectionDef` and swap in `advanceSection()`.
- Need fade-out / fade-in to avoid jarring transitions at section boundaries.
- Coordinate with audio: fade duration, do crossfades sound right with their layered patches, what's the max distinct tracks per game.

Production-level polish — when each section feels musically distinct, the loop becomes meaningfully more replayable.

### 4.3 — Sound design pass for v6/v7 additions

New mechanics don't have dedicated audio yet — currently piggyback generic `'explosion'` / `'hit'` SFX:
- **Depth charges** — water-plop on drop, blinking-warning beep, deeper sub-bass on detonation (distinct from chopper bombs which are airborne).
- **Bridge transition** — ambient swap when entering/leaving the bridge zone (steel-cable wind, water below).
- **Tunnel** — reverb tail + muffled high-end while inside `tunnelZones`.
- **Drone swoop** — rising whine that telegraphs swoop commit (currently silent except hit SFX).
- **Strafer bursts** — distinct firing SFX vs static shooters (faster cadence, lighter timbre).

Coordinate with audio team. Most of these are 1-line `services.audio.playSound` calls once the SFX exist.

### 4.4 — HP cap per section (playtest-gated)

`MAX_HP = 3` globally. If late sections feel trivial with full HP, gate via per-section HP cap on `SectionDef`. Only act if playtest shows §6/§7 are too easy. Pre-existing knob — no v7 change.

### 4.5 — Section-clear reward inflation cap (playtest-gated)

`base + combo × lives × 250` scales fast at high lives counts. If late-game scores balloon, cap at `max(lives, 3)` or similar. Only act if leaderboards start looking absurd.

### 4.6 — Bump-mechanic playtest tuning (playtest-gated)

v5 shipped the knockoff loop; v6/v7 didn't touch the core knobs. v7 added two new bumpable types (`dropper` 1.2, `strafer` 1.0). Watch for:
- Soft cars (ram/shooter/patrol/strafer at 1.0) too easy?
- Dropper (1.2) feel right — slightly stickier than ram but still bumpable?
- Enforcer (2.5) trivial vs impossible?
- SWAT (6.0) bumpable at boost?
- Slide too sticky/fast?

Knobs in `SpeedRacerGame.ts` (`BUMP_FORCE_MIN/MAX`, `BUMP_OFF_ROAD_MARGIN`) and `EnemyCar.ts` (`BUMP_FRICTION`, `BUMP_AI_SUPPRESS`, per-type `bumpResistance`).

### 4.7 — Harbor Run depth-charge tuning (post-launch playtest)

v7 default fuse is 1.4s, radius 56px, dropper drops at distY 220–480 ahead of player. Watch for:
- Charges feel undodgeable late-game when spawn cadence tightens via lap scaling? Bump fuse to 1.6s.
- Charges trivial because dropper's slow drift never positions them in your lane? Bump dropper drift from 50 → 70 px/sec.
- Too many charges on screen at once making §6 chaotic? Cap `depthCharges.length` per section, or lower dropper weight from 3 → 2.

Knobs: `DEFAULT_FUSE` and `EXPLOSION_RADIUS` in `entities/DepthCharge.ts`; drop window in `EnemySpawner.updateDropper`; weights in `data/sections.ts` HARBOR_RUN.

### 4.8 — Drone prediction lead tuning (post-launch playtest)

v7 cap is `DRONE_MAX_LEAD = 120`. Watch for:
- Drones feel too smart and always hit even on lateral-reversal dodges? Drop cap to 80.
- Drones feel no different from v6 (lead too small)? Raise cap to 160.

Knob: `DRONE_MAX_LEAD` in `entities/BossEnemies.ts`.

### 4.9 — Performance pass

60fps on mid-tier hardware needs verification. Slow-path road geometry sections (§4 Alpine taper, §5 Sunset fork) are the most expensive frames — Harbor Run with 7 spawn types and possibly several depth charges + projectiles + boats on screen is now also high-density. Quick wins if it dips:
- Cap `depthCharges.length` to ~8.
- Object-pool projectiles + depth charges (currently allocated per-spawn).
- Profile slow-path road body — already run-accumulated but the per-row shape query could be memoized for stable stretches.

### 4.10 — Bigger-than-an-incremental ideas (v9+ territory)

- **Replays / ghosts.** `dt`-keyed input serialization. Wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile. Nothing currently enforces it.
- **Pixel-sprite migration.** `assetBudgetKB = 130` on the manifest is the current limit. v3-v7 stayed all-canvas. If a v8 art lead wants to migrate, raise the budget first.

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
    dropper  280 /  90 / 1.2 /  2     strafer  290 / 50 / 1.0 / 2 (bulletSpeed 480)

EnemySpawner.ts:
  BURST_INTRA_COOLDOWN = 0.18s          MAX_AIM_LEAD_VX = ±200 px/s
  Inter-burst cooldown = 1.4 + Math.random() * 0.8
  Dropper cadence      = 1.6 + Math.random() * 0.9 (drop window: distY 220..480)

DepthCharge.ts:
  DEFAULT_FUSE         = 1.4s           EXPLOSION_RADIUS = 56px
  EXPLOSION_LIFETIME   = 0.4s           Blink rate ramps 5 → 23 Hz over fuse

BossEnemies.ts:
  Drone:
    DRONE_HOVER_SPEED  = 160            DRONE_SWOOP_SPEED  = 520
    DRONE_RETREAT_SPEED = 260           DRONE_MAX_LEAD     = 120 (v7)

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
npm test               # 145 tests pass as of v7 ship
npm run build          # production build succeeds
```

Manual signed-in QA checklist (still pending — see §4.1):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

---

## 7. v7-specific gotchas worth knowing

- **`PaletteOverrideZone.fadeLength` defaults to 200.** STEEL_SPAN uses 350 because the bridge crossfade is long-form (5000 worldY active range) and a sharper fade reads as "the road suddenly turns to concrete." For shorter zones, the 200 default works.
- **`PaletteColorField` excludes `horizonAlpha`.** The horizon glow strength is intentional layout, not paint. If a future zone needs to fade the glow itself, extend the union — but think about whether you actually want a fade or a hard switch.
- **Depth charges render LAST in `EnemySpawner.render`.** Above projectiles and boats, so the warning ring is always visible even if a boat sits on the canister. Don't reorder.
- **`EnemyConfig.bulletSpeed != null` is the firing dispatch.** v6 hardcoded `e.config.type === 'shooter'`; v7 generalized. Strafers fire because they have `bulletSpeed: 480`. New shooting enemies just need to set `bulletSpeed` — don't add type checks.
- **Dropper drop window is `distY 220..480`.** Below 220 the fuse is too short for the player to react; above 480 the charge detonates before the player reaches it. If you change `DEFAULT_FUSE`, re-tune this window.
- **`DRONE_MAX_LEAD = 120` is calibrated against `STEER_MAX_SPEED = 380`.** A player at full sideways speed gets perfectly tracked up to 120px, then the cap kicks in. If you raise either, re-think the relationship.
- **`resolvePalette` lerps RGB linearly.** Mid-fade colors will look slightly muddy on saturated palettes (it's not perceptually-uniform). Acceptable for the bridge use case; if a future zone fades a pure red to a pure green you'll see the murky midpoint — switch to OKLCH then.
- **HARBOR_RUN now has 7 enemy types.** That's the most of any section. Keep an eye on lap-scaled spawn intervals — the 0.6s floor stacked with 7 types means nearly every spawn picks a different type, which can feel chaotic. If playtest shows it, drop weights for the legacy types (ram/shooter/enforcer/armored) on §6 specifically.
- **Per-handoff invariant docs were removed.** This is the only one. If you need the old prose for context, `git log --diff-filter=D --summary -- src/games/speed-racer/SPEED-RACER-V*-HANDOFF.md` will show when they were deleted.

---

## 8. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # game loop, damage funnel, collision resolution,
│                                  #   recap, applyRoadProfile, off-road bump-kill scan,
│                                  #   resolvePalette per-frame call (v7)
├── SPEED-RACER-V7-HANDOFF.md      # this doc
├── index.ts
├── data/
│   ├── constants.ts               # PLAYER + legacy ROAD constants (only StraightRoadGeometry uses ROAD)
│   ├── secondaryWeapons.ts
│   └── sections.ts                # SectionDef, SectionPalette, TunnelZone,
│                                  #   PaletteOverrideZone (v7), resolvePalette (v7),
│                                  #   all 7 sections
├── entities/
│   ├── PlayerCar.ts               # segment-aware clamp, shoulder handling, pendingDividerHit
│   ├── EnemyCar.ts                # 7 enemy types, bump physics, segment-aware AI,
│   │                              #   dropper + strafer (v7) sprites + AI dispatch
│   ├── DepthCharge.ts             # (v7) fuse-timed water hazard with radial detonation
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts             # Tank/Drone, profile-aware spawn helpers,
│                                  #   drone aim-lead (v7)
└── systems/
    ├── RoadProfile.ts             # interfaces + StraightRoadGeometry + RoadProfile wrapper
    ├── RoadGeometries.ts          # WidthChangeGeometry, ForkGeometry, ShoulderedRoadGeometry
    ├── RoadRenderer.ts            # body / edges / lanes / divider / tunnel overlay / posts / shoulders
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # segment-aware spawn, formations bail in fork sections,
    │                              #   dropper + depth-charge tracking (v7),
    │                              #   bulletSpeed-keyed firing dispatch (v7)
    ├── BossSpawner.ts             # threads playerVx through (v7)
    ├── TerrainHazards.ts
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

---

## 9. Section identity at a glance

| § | Section        | Geometry feature          | Palette feature (v7)   | Enemy mix                     | Boss bias       |
|---|----------------|---------------------------|------------------------|-------------------------------|-----------------|
| 1 | NEON HIGHWAY   | Drivable shoulders        | —                      | ram-only (tutorial)           | (no bosses yet) |
| 2 | NEON CITY      | Tunnel mid-section        | —                      | ram + shooter                 | default         |
| 3 | STEEL SPAN     | (none — scenery bridge)   | **Concrete crossfade** | + enforcer                    | default         |
| 4 | ALPINE PASS    | Two narrow chokepoints    | —                      | ram-heavy + civilians         | tank-heavy      |
| 5 | SUNSET COAST   | Fork with central divider | —                      | balanced 4-type               | default         |
| 6 | HARBOR RUN     | (none — water terrain)    | —                      | **+ patrol + dropper + strafer (v7)** | chopper-heavy |
| 7 | FROST PASS     | (none — ice terrain)      | —                      | tightest spawns               | default         |

§3 now has a palette feature alongside its scenery bridge — the road body itself transitions. §6's "no geometry" gap is now filled by aquatic-specific enemy AI instead of geometry. Future polish ideas should target §1, §2, §7 (which still rely on a single feature each) only if there's a clear gameplay reason — production polish is the priority over more features.
