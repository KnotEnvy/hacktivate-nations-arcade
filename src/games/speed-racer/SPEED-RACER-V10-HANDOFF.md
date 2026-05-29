# Speed Racer — v10 → Release Handoff

v10 shipped 2026-05-09. **Final pre-release handoff.** Supersedes v9, which has been removed per the per-handoff invariant.

The game is feature-complete. Your job is the release gate, not new features. After you ship, the next validation step is real-world user testing — no further dev waves are planned. Keep changes surgical.

---

## 1. What v10 added

### Wave 4 — road turns / curvature

Every section authors `roadCurve` keyframes (in `data/sections.ts`) — bear-left/bear-right zones with smoothstep-interpolated lateral offsets (50–120px, holds 1500–2500 worldY ≈ 4–7 sec at base speed). Curves stay clear of chokepoints (§4 / §8) and the §5 fork stretch.

- **Authoring:** every schedule starts and ends at offset 0. Smoothstep between keyframes — 4 keyframes per bear is the typical pattern (entry@0, ramp-end@peak, hold-end@peak, exit@0).
- **Architecture:** new `CurveSchedule` class in `RoadProfile.ts`. `RoadGeometry.setCurve()` attaches it; `shapeAt` applies the offset to xMin/xMax/segments/shoulder bounds in every implementation. Curves invalidate the renderer fast path (`isUniform()` returns false), so all 9 sections now render via the slow path.
- **Slow-path shoulder rendering** added in `RoadRenderer.renderShouldersStripped` so shouldered geometries (§1, §6) keep their shoulder strips and rumble dashes through curves.

### Wave 3b — HUD redesign

`SpeedRacerGame.onRenderUI` was rebuilt around an arcade-cabinet feel:

- **Top-center hero zone:** live score (was hidden in recap-only before) + combo multiplier with decay bar.
- **Top-left:** lives + civs.
- **Top-right:** section indicator + progress bar (color-keyed to section), small dist/kills.
- **Bottom-left instrument cluster:** top-half-arc speedometer (color-tiered cyan→green→orange) + chassis plates.
- **Bottom-right:** secondary-weapon bay (`[Q]`, label, ammo). Empty state still anchors the eye.
- **Bottom-center:** dimmed controls hint.

All zones stay outside the player Y range (380–510) and the road body. Dispatch is one method per zone — keep the dispatch flat, don't merge.

---

## 2. Pre-release checklist

The work between you and ship. Block release until done.

### 2.1 — Manual signed-in QA pass (carryover, half-day of testing)

The signed-in flow has never had a dedicated QA pass. Walk a real account through:

- [ ] Wallet credit from `coinsEarned` lands on the arcade hub.
- [ ] Leaderboard write appears for the account, ordered correctly.
- [ ] Challenge progress advances on each metric: distance, top speed, max combo, powerups used.
- [ ] Achievements unlock at the right thresholds.
- [ ] Analytics `trackGameEnd` fires with the correct `ownerId`.
- [ ] Sign-out / sign-in resets state cleanly.

### 2.2 — Audio team finalization

Per-section music wiring is in (v8); cinematic SFX hooks aren't. Audio team needs to sign off:

- [ ] Track choices per section (`epic_tension` §4, `epic_heroic` §5, `casual_chill` §6, `action_intense` §8, `sports_competitive` §9). Inheriting sections (§1, §2, §3, §7) read as intended.
- [ ] Crossfade quality. `AudioManager.playMusic` does stop-then-start with a small gap. Upgrade to a true crossfade if transitions feel jarring.
- [ ] `SECTION_MUSIC_FADE_SECONDS = 1.5s` ≤ `SECTION_CLEAR_FLASH_DURATION = 1.8s` constraint maintained.
- [ ] Respawn cinematic SFX — three new hooks at phase transitions in `tickRespawnVan`:
  - **Van approach** during `incoming` (distant truck-engine rumble fade-in)
  - **Door hiss/clank** at `incoming → dropoff`
  - **Peel-off** at `dropoff → departing` (engine accel ramp)

### 2.3 — Sound design pass (mechanic-specific SFX)

New mechanics still using generic `'explosion'` / `'hit'` / `'powerUp'` hooks:

- [ ] Depth charges — water-plop on drop, blinking-warning beep, sub-bass detonation.
- [ ] Bridge / tunnel ambient swaps.
- [ ] Drone swoop — rising whine telegraphing the commit.
- [ ] Strafer bursts — distinct firing SFX vs static shooters.
- [ ] §6 HARBOR harbor-approach, §7 OPEN_SEA dawn→day, §8 CHANNEL lock walls.
- [ ] Civilian bullet hit (currently shares enemy 'hit' SFX — differentiate so the player hears the soft-traffic distinction).

Each is a 1-line `services.audio.playSound` once the SFX exists.

### 2.4 — Performance verification

60fps on mid-tier hardware. v10 puts **all 9 sections** on the slow path (curves invalidate fast-path). Watch:

- §4 ALPINE_PASS taper + curve + heavy spawn
- §7 OPEN_SEA / §8 CHANNEL with bosses
- §8 CHANNEL chokepoints during chopper bosses

Quick wins if it dips: cap `depthCharges.length` to ~8, object-pool projectiles + depth charges, memoize per-row shape queries on stable stretches.

### 2.5 — Production build

For release, run the **full** gates (do **not** skip `npm run build` like the per-wave dev workflow did):

```bash
npm run type-check
npm run lint
npm test
npm run build
```

10 jest tests is the v10 baseline.

---

## 3. Tuning knobs (last-resort levers from real-world feedback)

Don't touch what isn't reported. Listed by file.

```
SpeedRacerGame.ts
  COMBO_DECAY_TIME            = 4.0s
  CIVILIANS_LOST_GAME_OVER    = 3
  STARTING_LIVES              = 1     MAX_LIVES = 5
  LIFE_BONUS_SCORES           = [2500, 10000, 25000, 50000, 100000]
  RESPAWN_INVULN_DURATION     = 2.0s  HIT_INVULN_DURATION = 1.1s
  MAX_HP                      = 3

  Section-clear bonus:        base 500 + combo × lives × 250
                              (cap lives factor at max(lives,3) if leaderboards inflate)

  Lap scaling (private):      spawn × 0.9^wraparounds, floor 0.6s
                              burst +0.08/loop cap 0.6
                              formation +0.05/loop cap 0.35

  Bump physics:               BUMP_FORCE_MIN/MAX 80/520
                              BUMP_OFF_ROAD_MARGIN 30
                              Player recoil = 50 + bumpResistance * 30

  Respawn cinematic:          INCOMING 0.7s / DROPOFF 0.6s / DEPARTING 0.7s
                              Drop Y 380, forward speed 600 in / 700 out

WeaponSystem.ts
  FIRE_COOLDOWN 0.10s (alternating L/R single-shot)
  BULLET_SPEED 950, BARREL_OFFSET_X 12

PlayerCar.ts (Wave 3a)
  Y_AT_BRAKE 510 / Y_AT_BASE 480 / Y_AT_BOOST 380
  Y_LERP_TAU 0.18s

EnemyCar.ts (per type — forwardSpeed / bumpResistance / hp)
  ram      260 / 1.3 / 2          shooter  300 / 1.3 / 3 (bulletSpeed 520)
  enforcer 250 / 2.5 / Inf        armored  180 / 6.0 / Inf
  patrol   300 / 1.3 / 2
  dropper  280 / 1.4 / 3          strafer  290 / 1.3 / 3 (bulletSpeed 480)

data/sections.ts
  Per-section spawnerConfig.spawnInterval / shooterBurstChance / formationChance
  Per-section roadCurve keyframes (Wave 4)
  Per-section musicTrack (omit = inherit)
  Per-section paletteOverrides (string color fields only)

Terrain handling
  road     steerMul 1.0   decelMul 1.0
  water    steerMul 0.7   decelMul 0.55
  ice      steerMul 0.55  decelMul 0.28
  shoulder modifier ×0.65 / ×0.55 (multiplied on top of section terrain)
```

---

## 4. Non-regression invariants

The release-team-relevant rules. Each came from a specific bug; bypassing any of them undoes prior work.

### Coordinates / motion
- `dt` is seconds, capped at 0.1 upstream.
- Canvas 800×600. `PLAYER.Y = 480` is the **canonical road anchor** for `worldYAtScreen`. Player's *visual* Y varies 380–510 (Wave 3a). Don't unify these — entities at fixed screen positions need the constant anchor; the player's own queries need the dynamic anchor.
- `setPlayerScreenY` must be called BEFORE shape queries each frame. Currently right after `player.update`.
- Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycle`.

### Damage / collision
- All lethal collisions route through `takeDamage(cause)`. Only `civilian_spree` and `self_end` may call `triggerDeath` directly.
- `getBounds()` is sacred — visual changes leave the configured `width × height` hitbox alone.
- Bump-knockoff loop: side-swipes inject `bumpVx`, never deal direct damage and never directly kill. Off-road kill credit is owned by `SpeedRacerGame`'s post-spawner scan.
- Civilians use the bump-knockoff loop too: bullets via `civ.takeHit()`, ram via `civ.applyBump()`. **Never** insta-kill from collision code.
- New `DeathCause` requires extending the union, the `causeLabel` map, AND the `improvementHint` switch — three sites.

### Geometry pipeline
- `RoadProfile` is the ONLY way to query road shape. Use `shapeAt*` / `laneCenterAt*` / `isOnRoadAtScreen`. The legacy `ROAD` constants in `data/constants.ts` are fallbacks for `StraightRoadGeometry` only.
- (v10) `setCurve(schedule | null)` attaches a `CurveSchedule` to any geometry. Schedules MUST start and end at offset 0. Smoothstep interpolation between keyframes.
- (v10) Curve offsets apply uniformly to fork segments and shoulder bounds (the road bends together, not per-segment).
- (v10) Slow path renders shoulders + rumble dashes via `renderShouldersStripped`. Do not regress to fast-path-only shoulder handling — that loses the shoulder strip on §1 and §6 once curves attach.
- `isUniform()` returns false when a curve is attached → renderer slow path. Don't add a "curve fast path" without auditing all per-row consumers.

### Forks (§5)
- Divider crossing routes through `takeDamage('barrier_collision')`. `PlayerCar.pendingDividerHit` is read+cleared by `SpeedRacerGame` after `player.update`.
- Same-segment guard for AI targeting: `updateRamAI` and `updateArmoredAI` bail when the player is on the opposite side. Add the guard to any new player-targeting AI.

### Palette / music
- (v7) `PaletteOverrideZone` interpolates string color fields only — numeric/enum fields stay on the base palette.
- (v7) `resolvePalette` is called once per frame in `onRender`. Don't call from per-row code.
- (v8) `OPEN_SEA.palette` is an intentional mid-tone "transition" palette, NOT a default. Mutating it without re-tuning the dawn/day crossfade endpoints will produce muddy interpolation.
- (v8) `musicTrack` uses sticky inheritance. Adding it to a previously-inheriting section changes the chain for everything downstream.

### Combat / spawn
- Section 1 enemy weights `[1, 0, 0]` are tutorial-load-bearing (ram-only). The weight-zero exclusion is the picker contract.
- Lap scaling is monotonic and clamped. Don't lift the clamps.
- Aquatic arc is three sections (§6 → §8). Each carries 3–4 enemy types max — focused identity is the design goal.
- (v9) Bullets are alternating L/R single-shot at `FIRE_COOLDOWN = 0.10s`. Don't restore the simultaneous-pair pattern without retuning enemy HP.

### Respawn cinematic (v9)
- Cinematic is the canonical entry to a life. `onInit`, `respawn`, and `onRestart` all kick it off via `startRespawnCinematic`. Don't add a fourth path that bypasses it.
- `respawnInvuln` is armed at the cinematic's `'dropoff' → 'departing'` transition, NOT at `respawn()` call. Moving it earlier eats into the player's i-frame window during cinematic blackout.

### HUD (v10)
- `score` renders live at top-center via `renderScoreBanner`. Don't bury it back in recap-only.
- HUD zones stay outside player Y range (380–510) and road x range (160–640 plus shoulders). New HUD additions respect these zones.
- `onRenderUI` dispatches to one method per zone (`renderScoreBanner`, `renderTopLeftPanel`, `renderTopRightPanel`, `renderInstrumentPanel`, `renderSecondaryPanel`, `renderControlsHint`). Keep the dispatch flat.

---

## 5. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts        # Game loop, damage funnel, collision resolution, recap,
│                              applyRoadProfile (curves + geometry, v10), off-road bump-kill
│                              scan, respawn cinematic state machine + tickRespawnVan,
│                              applySectionMusic, HUD dispatch (Wave 3b panels)
├── SPEED-RACER-V10-HANDOFF.md  # this doc
├── index.ts
├── data/
│   ├── constants.ts         # PLAYER + legacy ROAD constants
│   ├── secondaryWeapons.ts
│   └── sections.ts          # SectionDef (incl. roadCurve, musicTrack, paletteOverrides),
│                              all 9 section definitions, resolvePalette
├── entities/
│   ├── PlayerCar.ts         # speed-driven Y dynamics (Wave 3a)
│   ├── EnemyCar.ts          # 7 enemy types, bump physics, segment-aware AI
│   ├── Civilian.ts          # HP, bumpVx, bumpResistance (v9 soft-traffic)
│   ├── DepthCharge.ts       # fuse-timed water hazard (v7)
│   ├── WeaponVan.ts         # pickup + respawn render variants (v9)
│   ├── Projectile.ts, Missile.ts, Hazard.ts, BombChopper.ts
│   └── BossEnemies.ts       # Tank/Drone, drone aim-lead (v7)
└── systems/
    ├── RoadProfile.ts       # RoadGeometry interface, CurveKeyframe + CurveSchedule (v10),
    │                          StraightRoadGeometry, RoadProfile (dynamic playerScreenY)
    ├── RoadGeometries.ts    # WidthChangeGeometry, ForkGeometry, ShoulderedRoadGeometry
    │                          (all curve-aware as of v10)
    ├── RoadRenderer.ts      # body / edges / lanes / divider / posts / tunnel,
    │                          shoulder rendering on both fast and slow paths (v10)
    ├── WeaponSystem.ts      # FIRE_COOLDOWN 0.10s, alternating L/R (v9)
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts      # bulletSpeed-keyed firing dispatch (v7)
    ├── BossSpawner.ts       # per-section bias (v8)
    └── TerrainHazards.ts, Weather.ts, TouchControls.ts, Particles.ts, CameraShake.ts
```

---

## 6. Section identity at a glance

| § | Section        | Geometry                              | Palette feature           | Curve magnitude   | Enemy mix                            | Boss bias       | Music                  |
|---|----------------|---------------------------------------|---------------------------|-------------------|--------------------------------------|-----------------|------------------------|
| 1 | NEON HIGHWAY   | shouldered + curves (50px)            | —                         | mild              | ram-only (tutorial)                  | (no bosses)     | (inherit primary)      |
| 2 | NEON CITY      | curves (80px) + tunnel mid            | —                         | moderate          | ram + shooter                        | default         | (inherit)              |
| 3 | STEEL SPAN     | curves (70/90px)                      | concrete bridge crossfade | long sweepers     | + enforcer                           | default         | (inherit)              |
| 4 | ALPINE PASS    | width-change chokepoints + curves (110/120px) | —                 | sharp switchbacks | ram-heavy + civilians                | tank-heavy      | `epic_tension`         |
| 5 | SUNSET COAST   | fork + curves (100px) outside fork    | —                         | flanking sweepers | balanced 4-type + SWAT debut         | default         | `epic_heroic`          |
| 6 | HARBOR RUN     | shouldered + curves (70/80px)         | working-harbor crossfade  | gentle            | ram + shooter + patrol               | chopper-leaning | `casual_chill`         |
| 7 | OPEN SEA       | straight + curves (100px)             | dawn→day crossfade        | long sweepers     | patrol + strafer + shooter + dropper | chopper-dominant| (inherit chill)        |
| 8 | CHANNEL        | width-change locks + curves (80px)    | —                         | short flanking    | ram + enforcer + dropper + strafer   | drone-heavy     | `action_intense`       |
| 9 | FROST PASS     | curves (90px) on ice                  | —                         | long, on ice      | tightest spawns                      | default         | `sports_competitive`   |

Loop wraps §9 → §1, with `applyLapScaling` tightening spawn cadence each wraparound (clamps in §3).

---

## 7. Validation gates

Per-release (full):

```bash
npm run type-check    # no errors
npm run lint          # no warnings
npm test              # 10 jest tests pass
npm run build         # production build succeeds
```

If real-world testing flags a fix, per-fix validation can skip `npm run build` if the change is scoped to Speed Racer game code; rerun the full gates before each release candidate.
