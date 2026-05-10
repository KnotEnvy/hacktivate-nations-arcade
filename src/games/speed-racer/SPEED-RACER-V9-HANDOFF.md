# Speed Racer — v9 → v10 Handoff

v9 shipped 2026-05-09. This is the **only** Speed Racer handoff doc — supersedes the v8 handoff, which has been removed per the per-handoff invariant. The previous coder is on this team and can answer questions about anything below.

**v9 was the playtest-driven feel pass.** Three waves of focused improvements went in (combat rebalance, Spy-Hunter respawn cinematic, speed-driven player Y), each validated in the live build before moving on. The game now reads much more like authentic Spy Hunter than v8 did.

**v10 is the unfinished playtest list and the structural items.** Two playtest items the user explicitly deferred to a future team: HUD redesign (§4a) and road turns (§4b). Plus the standing v8 carryover backlog (signed-in QA, audio coordination, sound design, perf, etc.). See §4.

---

## 1. What v9 added

v9 was three discrete waves, each playtest-validated before the next started:

### 1.1 — Wave 1: Combat feel rebalance

Number-tuning across `WeaponSystem.ts`, `EnemyCar.ts`, and `Civilian.ts` plus a soft civilian rework. The four sub-items rebalance together — they're a unit.

1. **Bullets: alternating L/R + slower fire.** `FIRE_COOLDOWN: 0.085 → 0.10s`. Single bullet per shot now (was two simultaneously). `shotsFired % 2` drives L/R alternation through the existing `BARREL_OFFSET_X = ±12` offset. Net DPS dropped from ~23.5 bullets/sec → ~10 bullets/sec (~42% of pre-v9). Combined with the HP bump in 1.2, kills feel meaningfully more deliberate.

2. **Enemy HP +1 across the board.** ram 1→2, patrol 1→2, shooter 2→3, dropper 2→3, strafer 2→3. enforcer/armored unchanged (still ∞, missile-only). Boss HP untouched.

3. **Bump resistance: soft cars stickier.** ram/shooter/patrol/strafer 1.0→1.3, dropper 1.2→1.4 (preserves "stickier than soft" ordering). enforcer 2.5 / armored 6.0 unchanged. "Tiny bit harder" reads as 30% — felt but not jarring.

4. **Civilians become soft traffic.** Big design shift: civs are no longer instant-death glass, they're first-class traffic governed by the same bump/HP loop as enemies.
   - `Civilian.hp = 2`, `Civilian.bumpResistance = 1.3` (matches shooter post-tuning).
   - New methods: `Civilian.applyBump(forceVx)`, `Civilian.takeHit(damage)`.
   - New `bumpVx`, `bumpCooldown` fields with the same friction / cooldown / suppress constants as `EnemyCar`.
   - Road clamp in `Civilian.update()` releases when `|bumpVx| > BUMP_AI_SUPPRESS` so the off-road scan can catch them sliding off.
   - **Bullet vs civ:** `civ.takeHit(bullet.damage)` instead of insta-kill; counts a strike only when HP ≤ 0.
   - **Player ram vs civ:** applies bump impulse like a soft enemy side-swipe; **never** an insta-kill, **never** damages the player. Has a stable-sign fudge (`Math.abs(dx) < 1 ? 1 : Math.sign(dx)`) so rear-end overlaps where dx ≈ 0 still produce a lateral push instead of sticking.
   - **Off-road scan extended to civs** (parallel loop after the enemy scan). Off-road or divider-gap = strike + combo drop, no score.
   - `CIVILIANS_LOST_GAME_OVER = 3` stays; `civiliansLost` resets each life (was already in `respawn()`).

### 1.2 — Wave 2: Spy-Hunter weapons-truck respawn cinematic

Iconic feature item. Plays on **first life AND every respawn** ("each life") — drops the player onto the road via a full cinematic sequence.

**State machine (totals 2.0s):**

| Phase | Duration | Behavior |
|-------|----------|----------|
| `incoming` | 0.7s | Van enters from `y=720` (off-screen below), eases up to `RESPAWN_VAN_DROP_Y = 380`. Doors closed. Overlay fades in. **Player not rendered, no input.** |
| `dropoff` | 0.6s | Van settles at drop Y, scroll-matched. Doors open. Player car appears (`player.reset()` + `player.x = van.x`). Overlay holds full opacity. **Still no input.** |
| `departing` | 0.7s | Doors close, van accelerates off the top of the screen. Overlay fades out. **Input enabled.** `respawnInvuln = RESPAWN_INVULN_DURATION` armed here, NOT at `respawn()` call — so i-frames begin the moment the player can act. |

**Architecture:**
- **Reuses `WeaponVan`** with two new optional render variants: `mode: 'pickup' | 'respawn'` (default `'pickup'`) skips the payload-glyph diamond; `doorsOpen: boolean` (default `false`) swaps the rear-doors render between closed (split with handles + dock highlight) and open (dark interior with two splayed angled door panels). `forwardSpeed` was made mutable so the cinematic can override per phase.
- **`SpeedRacerGame` owns the cinematic state machine.** New fields: `respawnPhase: 'idle' | 'incoming' | 'dropoff' | 'departing'`, `respawnTimer`, `respawnVan: WeaponVan | null`, `respawnOverlayText: string`, `currentLifeNumber: number`.
- **Direct y-lerp positioning.** `tickRespawnVan` calls `respawnVan.update()` (so the rotating beacon keeps animating) but then **overrides `van.y`** each frame from a phase-relative eased lerp. Ease-out for incoming (fast then slows), ease-in for departing (slow then fast). The van always lands exactly at the drop point and exits exactly off-screen regardless of frame rate.
- **`onUpdate` gates** input through the cinematic. While `respawnPhase` is `'incoming'` or `'dropoff'`, normal gameplay early-returns; only road scroll / particles / shake / HUD timer ticks run for visual continuity. `'departing'` and `'idle'` run normal gameplay; `tickRespawnVan` is called from both paths (no-op when `'idle'`).
- **`onRender` skips player.render** during `'incoming'` only. Renders `respawnVan` between the spawner's vans and the bullets layer.
- **`onRenderUI` adds a center-screen overlay**: `"GET READY!"` on first life (`currentLifeNumber === 1` after `onInit` / `onRestart`), `"LIFE N"` after each respawn (`currentLifeNumber` is incremented inside `respawn()` before `startRespawnCinematic` is called). Pulses gently, gold drop shadow, with the subtitle `"— WEAPONS TRUCK INBOUND —"`.
- **Trigger sites:** `onInit`, `respawn`, and `onRestart` all call `startRespawnCinematic(text)`. Game-start text is `'GET READY!'`; respawn text is `LIFE ${currentLifeNumber}`.

### 1.3 — Wave 3a: Speed-driven player Y dynamics

Classic Spy-Hunter feel — the car visually moves up the screen when boosting and gently down when braking.

- **Y target curve** (asymmetric piecewise-linear, in `PlayerCar.ts`): `Y_AT_BRAKE = 510` (gentler retreat), `Y_AT_BASE = 480` (matches `PLAYER.Y`), `Y_AT_BOOST = 380` (full Spy Hunter advance). Linear interpolation between the three points.
- **Smoothing:** exponential lerp with `Y_LERP_TAU = 0.18s` (~0.5s effective response). Frame-rate-independent: `y += (targetY - y) * (1 - exp(-dt/tau))`.
- **`RoadProfile` gets a dynamic anchor** so shape queries / palette zones / lane math at the player's row track the visual position:
  - New `playerScreenY` field (defaults to `PLAYER.Y`, reset by `RoadProfile.reset()`).
  - New `setPlayerScreenY(y)` setter, called by `SpeedRacerGame.onUpdate` immediately after `player.update` and **before any shape queries**.
  - `playerWorldY()` is now `worldYAtScreen(this.playerScreenY)` — when the car visually moves up to y=380, its worldY advances by +100 because it's rendered over road that scrolled past `PLAYER.Y` already. `shapeAtPlayer()` correctly returns the geometry under the player's actual visual row.
  - **`worldYAtScreen()` itself remains anchored to the canonical `PLAYER.Y` constant.** Entities at fixed screen positions still convert correctly. Only the *player's own* position uses the dynamic anchor.

All v5/v6/v7/v8 invariants preserved (chassis HP funnel, world-frame motion, ram state machine, validation gates, `getBounds()` honesty, single-block player visual state, bump-knockoff loop, RoadProfile pipeline, fork same-segment guards, shoulders are player-only, PaletteOverrideZone semantics, `justExploded` single-frame pattern, `bulletSpeed`-keyed firing dispatch, drone swoop locked at swoop start, three-section aquatic arc with focused identities, sticky music inheritance).

No new entities. No new systems beyond the cinematic state machine. v9 is feel + a tiny set of plumbing surfaces.

---

## 2. Wave 1.4 (civilian rework) — the new (small) trait surface

The civilian-as-soft-traffic change is worth understanding before touching `Civilian.ts` or any civilian-related collision in `SpeedRacerGame.ts`.

### Shape

```ts
// New fields on Civilian
hp: number = 2;
readonly bumpResistance = 1.3;
bumpVx = 0;
private bumpCooldown = 0;
// New methods
applyBump(forceVx: number): void;   // injects bumpVx (cooldown-gated)
takeHit(damage: number): boolean;   // decrements hp; returns true on kill
```

Constants (`BUMP_FRICTION = 240`, `BUMP_AI_SUPPRESS = 30`, `BUMP_COOLDOWN = 0.12`) are duplicated locally in `Civilian.ts` and **must match** `EnemyCar.ts`. If you're adding more bumpable non-enemy traffic types, extract a shared module rather than duplicating a third time.

### How a strike happens

A civilian only counts as a "strike" (toward `CIVILIANS_LOST_GAME_OVER = 3`) when one of these is true on the frame they die:
1. **Bullet hit** reduced their HP to ≤ 0. Tracked in the bullet collision pass.
2. **Off-road bump scan** caught them past the road edge or in a divider gap. Tracked in the post-spawner scan in `SpeedRacerGame.onUpdate`, parallel to the enemy off-road scan.

Casual rear-ends / glancing taps **do not** count. The civ might be visually shoved aside but still alive on the road. That's the design.

### Why the player ram never insta-kills

The pre-v9 player-vs-civ collision did `civ.alive = false` on contact. v9 replaces that with `civ.applyBump(force)` + a player recoil. This is what makes accidental civ deaths *recoverable* instead of run-ending — the design goal of the playtest item.

Side effect: it's now possible for a player to physically push a civ off the road. That's a deliberate kill (counted as a strike). The bump-knockoff loop is the only way ram-induced civilian kills happen.

### Why dx ≈ 0 needs a sign fudge

When the player rear-ends a civ exactly behind them (`dx` near 0), `Math.sign(dx)` returns 0, so `applyBump(-0)` is a no-op and the civ stays glued to the bumper. The fudge `Math.abs(dx) < 1 ? 1 : Math.sign(dx)` picks a stable direction so the bump always produces a lateral push. Don't remove it without re-thinking that case.

---

## 3. Wave 2 (respawn cinematic) — the new infra surface

v9's largest mechanism. Skim before touching `WeaponVan.ts`, `tickRespawnVan`, or any of the cinematic constants in `SpeedRacerGame.ts`.

### Shape

```ts
// On WeaponVan (additive, fully back-compatible)
mode: 'pickup' | 'respawn' = 'pickup';
doorsOpen: boolean = false;
forwardSpeed: number; // was readonly; now mutable for cinematic-controlled motion

// On SpeedRacerGame
type RespawnPhase = 'idle' | 'incoming' | 'dropoff' | 'departing';
private respawnPhase: RespawnPhase = 'idle';
private respawnTimer = 0;
private respawnVan: WeaponVan | null = null;
private respawnOverlayText = '';
private currentLifeNumber = 1;

// Tuning constants (in SpeedRacerGame.ts, near the music constants)
RESPAWN_VAN_INCOMING_DURATION  = 0.7;
RESPAWN_VAN_DROPOFF_DURATION   = 0.6;
RESPAWN_VAN_DEPARTING_DURATION = 0.7;
RESPAWN_VAN_DROP_Y             = 380;  // van settles here (just above PLAYER.Y = 480)
RESPAWN_VAN_INCOMING_FORWARD_SPEED  = 600; // visual; y is direct-lerped
RESPAWN_VAN_DEPARTING_FORWARD_SPEED = 700; // visual; y is direct-lerped
```

### How the gate works

`onUpdate` has a phase gate at the top:

```ts
if (this.respawnPhase === 'incoming' || this.respawnPhase === 'dropoff') {
  this.tickRespawnVan(dt);
  // visual continuity: road scroll, particles, shake, HUD timer ticks
  return;
}
this.tickRespawnVan(dt);  // no-op when 'idle', advances van during 'departing'
// ...normal update...
```

So `tickRespawnVan` is always called when phase ≠ `'idle'`, but only the cinematic-blocking phases (`'incoming'` / `'dropoff'`) early-return. Player input flows normally during `'departing'` and `'idle'`.

### Why direct y-lerp (not forwardSpeed-based motion)

The van's normal `update()` flow uses `vy = playerSpeed - forwardSpeed` and integrates `y += vy * dt`. That's fine for pickup vans cruising at near-player speed, but for the cinematic we need the van to land **exactly** at `RESPAWN_VAN_DROP_Y` after **exactly** `RESPAWN_VAN_INCOMING_DURATION` seconds, regardless of frame rate. Direct y-lerp guarantees that:

```ts
const t = Math.min(1, this.respawnTimer / RESPAWN_VAN_INCOMING_DURATION);
const eased = 1 - Math.pow(1 - t, 3);  // ease-out
this.respawnVan.y = 720 + (RESPAWN_VAN_DROP_Y - 720) * eased;
```

`respawnVan.update()` is still called for visual side effects (the rotating warning beacon, road clamp). The `forwardSpeed` values are decorative — they're set per phase for "vibes" but the y position is the lerp's authority.

### Why `respawnInvuln` is armed at 'departing' start, not in respawn()

Pre-v9, `respawn()` set `respawnInvuln = RESPAWN_INVULN_DURATION` immediately. With the cinematic, that 2.0s i-frame window would partially burn during the 1.3s of cinematic where the player can't act. v9 moves the arm to the `'dropoff' → 'departing'` transition inside `tickRespawnVan` so the player gets the full 2.0s i-frame window starting the moment they take control.

`startRespawnCinematic` does set a belt-and-suspenders `respawnInvuln` covering `'incoming' + 'dropoff'` (1.3s) — that's just paranoia in case any collision edge-case fires during the gate.

### Why `currentLifeNumber` increments in respawn(), not at cinematic start

It's incremented once per call to `respawn()`, then `startRespawnCinematic(\`LIFE ${currentLifeNumber}\`)` reads the new value. `onInit` and `onRestart` reset it to 1 first, then call `startRespawnCinematic('GET READY!')` — which uses literal text, not the number. So the LIFE text always shows "the life number you're starting now," and the GET READY text is reserved for life #1.

### Why `onRestart` doesn't bypass the cinematic

After a recap, the player presses Space/Enter and the run restarts via `onRestart()`. v9 makes `onRestart` kick off the GET READY cinematic again so each new run feels symmetric with the first launch. If you ever want to *skip* the cinematic on rapid restarts, gate it on a "user has played already this session" flag — but the user explicitly wanted every life to start with the drop-off, so don't shortcut by default.

---

## 4. Wave 3a (player Y dynamics) — the new (small) coordinate twist

### Shape

```ts
// In PlayerCar.ts (module-level constants)
const Y_AT_BRAKE = 510;
const Y_AT_BASE  = 480;
const Y_AT_BOOST = 380;
const Y_LERP_TAU = 0.18;  // ~0.5s response

// In RoadProfile.ts
private playerScreenY: number = PLAYER.Y;
setPlayerScreenY(y: number): void { this.playerScreenY = y; }
playerWorldY(): number {
  return this.worldYAtScreen(this.playerScreenY);
}

// In SpeedRacerGame.onUpdate, after player.update:
this.roadProfile.setPlayerScreenY(this.player.y);
```

### Why the Y math works

The road coordinate system has a canonical anchor at `PLAYER.Y` (the constant): an entity at screen-y = `PLAYER.Y` has worldY = `currentScroll - sectionStartScroll`. That convention is **unchanged** — `worldYAtScreen()` still uses the constant. Entities like enemies, civilians, and projectiles are at fixed screen positions relative to scroll; their worldY conversion is anchored to the canonical reference.

What changes is the **player's** worldY. When the car visually moves up to y=380, the player's actual position over the scrolled road is `playerWorldY = scrollAnchor + (PLAYER.Y - 380) = scrollAnchor + 100` — i.e., +100 worldY ahead of "where they would be at PLAYER.Y." `shapeAtPlayer()` queries geometry at this dynamic worldY, so road clamp / fork detection / palette zones at the player track the visual position.

### Asymmetric curve (don't symmetrize)

The brake side is gentler (50 px range from base) than the boost side (100 px range). The user explicitly tuned this — symmetric (e.g., 540 brake) felt sluggish on slowdown. If you change one direction, sanity-check the other doesn't drift back into symmetry by accident.

### Cinematic interaction

`PlayerCar.reset()` pins `y = PLAYER.Y = 480` and `speed = BASE_SPEED = 360`. The cinematic dropoff path calls `player.reset()` → `player.x = respawnVan.x`, so the car arrives at y=480 with cruise speed. The next gameplay frame's lerp computes target=480 and stays put. No special-casing needed.

### Don't query `shapeAtPlayer()` before `setPlayerScreenY`

In `onUpdate` the order is:
```
player.update(dt, input);          // updates this.player.y
roadProfile.setPlayerScreenY(this.player.y);
// ... shoulder check, AI, collisions, etc. — all use shapeAtPlayer ...
```

If you add new shape-query work earlier in the frame, push the `setPlayerScreenY` call earlier with it. The cost of the "old" `playerScreenY` value being read is one frame of geometry mismatch, which is invisible in normal play but can cause a one-frame lane-clamp glitch under heavy steering.

---

## 5. Conventions in force (don't regress)

These are the invariants. If you find yourself working around one, that's a smell — talk to me before bypassing.

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** `PLAYER.Y = 480` is the **canonical road anchor** for `worldYAtScreen`. The player's *visual* Y now varies (380–510) per Wave 3a; the constant remains the road coordinate reference.
- **Scroll direction.** Patterns drift **down** as `worldScroll` grows. Use `y = offset - cycle`, not `y = -offset`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`). Depth charges follow the hazard model.
- **Damage funnel.** All lethal collisions route through `takeDamage(cause)`. Don't call `triggerDeath` directly from collision code (`civilian_spree` and `self_end` are the only direct callers).
- **Recap invariant.** New `DeathCause` requires extending the union, the `causeLabel` map, AND the `improvementHint` switch. v6 added `'barrier_collision'`; v7 added `'depth_charge'`; v8/v9 added none.
- **`getBounds()` is sacred.** Visual changes leave the configured `width × height` hitbox alone. With v9's dynamic player Y, `getBounds()` correctly tracks the visual position via `this.y` — keep it that way.
- **Edge-detect single-shot inputs.** Track `...WasDown`, fire on `down && !wasDown`. Touch secondary uses `consumeSecondaryPress()`.
- **Ram AI is a state machine** (`cruise → lock → charge`). Don't restore continuous tracking. Same-segment guard prevents rams locking through a divider — keep it.
- **Bump-knockoff loop is sacred.** Side-swipes inject `bumpVx`, never deal direct damage and never directly kill. Off-road kill credit is owned by `SpeedRacerGame`'s post-spawner scan, not `EnemyCar` (or `Civilian` since v9). AI lateral motion + road clamp suspend while `|bumpVx| > BUMP_AI_SUPPRESS = 30`. `bumpResistance` is the only knob — no per-type force multipliers in `SpeedRacerGame`.
- **Section 1 enemy weights `[1, 0, 0]` are tutorial-load-bearing.** Ram-only by design. Cumulative-subtraction picker treats weight 0 as hard exclusion.
- **Player visual state is set once per frame.** `setDamageLevel`, `setSecondary`, `setOnShoulder`, `pulseGunRecoil` all called from one block in `SpeedRacerGame.update()` right after `player.update()`.
- **Lap scaling is monotonic and clamped.** `applyLapScaling` floors `spawnInterval` at 0.6s, caps `shooterBurstChance` at 0.6, caps `formationChance` at 0.35.
- **Difficulty pressure axes ramp monotonically §1 → §9.** New sections slot on the curve at their natural intensity, not flat.
- **(v6) RoadProfile is the ONLY way to query road shape.** Don't import `ROAD` constants for clamp/lane math anywhere. Use `roadProfile.shapeAt*` / `laneCenterAt*` / `isOnRoadAtScreen`. The `ROAD` constants in `data/constants.ts` are legacy fallbacks used only by `StraightRoadGeometry`.
- **(v6) Section-relative worldY for geometry queries.** Profiles are keyed on distance-into-section, not absolute scroll. `RoadProfile` handles the conversion; consumers just call screen-Y-aware helpers.
- **(v6) Forks: divider crossing routes through `takeDamage('barrier_collision')`.** `PlayerCar.pendingDividerHit` is read+cleared by `SpeedRacerGame` after `player.update`. Don't call `takeDamage` from inside `PlayerCar`.
- **(v6) Forks: same-segment guard for AI targeting.** Both `updateRamAI` and `updateArmoredAI` bail when player is on the opposite side. Add the guard to any new player-targeting AI.
- **(v6) Shoulders are player-tactical only.** Enemies clamp to pavement; off-road kill scan uses pavement bounds (so bumps onto shoulder still score). Don't extend shoulders to enemies without re-thinking the bump loop.
- **(v6) Lint does NOT honor `_`-prefixed unused params alone.** Use `void _name;` to satisfy the rule when interface contracts force the param to remain.
- **(v7) `PaletteOverrideZone` is for color crossfades only.** Numeric/enum palette fields aren't in the override union. If you need to fade `horizonAlpha` etc., extend `PaletteColorField` AND `lerpHex` consciously — don't sneak it in.
- **(v7) `resolvePalette` is called once per frame in `onRender`.** Don't call it from per-row render code — that re-walks the override list 600× per frame and tanks slow-path geometry sections.
- **(v7) Depth charges follow the `justExploded` single-frame pattern.** Set `justExploded = true` on the detonation frame, immediately false the next update. The game's collision pass relies on this for exactly-once damage.
- **(v7) Anything with `EnemyConfig.bulletSpeed != null` fires through `EnemySpawner.updateShooter`.** That's how `strafer` reuses the shooter aim-lead pipeline. New shooting enemies should set `bulletSpeed` rather than spawning projectiles in their own AI.
- **(v7) Drone swoop target is locked at swoop start, NOT re-aimed mid-swoop.** Lead is computed once when transitioning hover → swoop. Re-aiming would break the "reverse direction to dodge" escape that the lead cap (`DRONE_MAX_LEAD = 120`) was designed around.
- **(v8) The aquatic arc is three sections (§6 → §8), not one.** Each carries 3–4 enemy types max. Don't push more types in to "fill out" any of them — the focused identity is the design goal.
- **(v8) `OPEN_SEA.palette` is an intentional mid-tone "transition" palette**, NOT a default. It's what shows between the two stacked `paletteOverrides` zones. Touching it without re-thinking the dawn/day crossfade endpoints will produce muddy interpolation.
- **(v8) `musicTrack` uses sticky inheritance.** Sections that omit it keep whatever's playing; sections that set it swap (with crossfade) only when different from current. Adding `musicTrack` to a previously-inheriting section changes the chain for everything downstream — chase the implications before committing.
- **(v8) `MusicName` is type-imported from `AudioManager`** in `data/sections.ts`. Unknown track names won't compile. If a track is renamed in `ExtendedMusicName`, sections.ts breaks at compile time (intended safety net).
- **(v8) `SECTION_MUSIC_FADE_SECONDS = 1.5` is calibrated against `SECTION_CLEAR_FLASH_DURATION = 1.8`.** The fade completes during the visual section-clear flash. If you change one, re-think the other.
- **(v8) Loop is 9 sections.** `SECTIONS.length` is referenced dynamically everywhere — don't hardcode 7 or 9.
- **(v9) Bullets are alternating L/R single-shots.** `shotsFired % 2` selects the offset; `FIRE_COOLDOWN = 0.10s` is the per-shot interval. Don't restore the simultaneous-pair pattern without retuning enemy HP — the two changes were tuned together.
- **(v9) Civilians use the bump-knockoff loop.** They are NOT enemies (no scoreValue, no AI, no firing) but they share the bump physics and HP semantics. Bullets via `civ.takeHit(damage)`; player ram via `civ.applyBump(force)`. **Never** insta-kill a civ from collision code. Strikes only happen via HP=0 from bullets or off-road from the post-spawner scan.
- **(v9) The respawn cinematic is the canonical entry to a life.** Both `onInit` (game start) and `respawn` (extra-life consumed) and `onRestart` (player retried after recap) kick it off via `startRespawnCinematic`. Don't add a fourth path that bypasses it without explicit user buy-in.
- **(v9) `respawnInvuln` is armed at the cinematic's `'dropoff' → 'departing'` transition**, NOT at `respawn()` call. Moving the arm earlier eats into the player's i-frame window during the cinematic blackout.
- **(v9) `RoadProfile.worldYAtScreen` stays anchored at the constant `PLAYER.Y`.** Only `playerWorldY()` uses the dynamic `playerScreenY`. Don't unify them — entities at fixed screen positions need the constant anchor, the player's own queries need the dynamic anchor.
- **(v9) `setPlayerScreenY` must be called BEFORE any shape queries each frame.** Currently `SpeedRacerGame.onUpdate` does it immediately after `player.update`. New shape-query code added before that point will read a stale anchor.

---

## 6. v10 backlog

The v9 build plays through cleanly. What's left is the user-deferred playtest items the team explicitly punted to v10, plus the v8 carryover that's still pending.

### 6.1 — User-deferred playtest items (HIGH PRIORITY)

These two were on the original 8-item playtest list and **were not addressed in v9 by the user's explicit choice** ("we are going to give wave 3b and 4 and whatever leftover work to our next team").

**§6.1.a — HUD redesign (open scope, needs design pass).** The current HUD is functional but mostly stuck in corners. Player request was: *"Improve the player HUD, we should be able to use more of the game screen creatively to enhance the gameplay and user experience and feel."*

Current state:
- **Top-left:** combo meter (only when combo > 1), `CIVS N/3` indicator, lives icons, chassis-integrity meter, secondary weapon
- **Top-right:** `SPEED N`, `DIST Nm`, `KILLS N`, section indicator + progress bar
- **Bottom-center:** controls hint
- **Overlays:** life-lost flash, extra-life flash, section-clear flash, section banner, GET READY!/LIFE N (v9)
- **Player Y range (post-3a):** 380–510, so HUD elements at y < 380 or y > 510 don't conflict with the car. Most of the current HUD respects this already.

Recommended approach when this is taken up:
1. Brainstorm with the user about goals (more arcade feel? Cleaner? More info? Less info? Diegetic — HUD elements drawn on the car/road?). Open-scope — start with intent.
2. Produce 2–3 mockups before code. **Offer the visual-companion (browser) tool** for side-by-side layout comparisons; HUD is a genuinely visual question.
3. Once a layout is locked, the implementation is mechanical — `onRenderUI` is one method.

**§6.1.b — Road turns / curvature (largest engineering item).** Player request was: *"Add turns to the road geometry to give it a real driving on the road feel."*

Scope:
- New `RoadGeometry` implementation with lateral (x-axis) curvature as a function of section-relative worldY. Likely a `CurvedRoadGeometry` class implementing the existing `RoadGeometry` interface.
- `RoadShape` already returns `xMin`/`xMax`/optional segments per worldY — curvature naturally fits as a horizontal offset applied to those bounds. **No interface change needed**, just a new geometry implementation.
- `RoadRenderer` already does per-row queries via the profile — should "just work" if the geometry returns the curved bounds correctly. Verify the slow-path render handles wider-bounds shapes without artifacts.
- **AI clamping** (EnemyCar / Civilian / WeaponVan road clamps) all use `roadProfile.shapeAtScreen(this.y)` → already correct. They'll follow the curve.
- **Player clamp** uses `shapeAtPlayer()` → already correct, follows the curve at player's row.
- **Risk:** the curve's lateral offset over the full visible road span (y=0 to y=600) might introduce visual artifacts where the road appears to "kink" at sharp curve transitions. Worth playtesting at a few curve magnitudes and section transitions before merging.
- **Suggested first cut:** add curvature as a sine wave with low amplitude (~30 px lateral) over a long wavelength (~3000 worldY). Subtle but readable. Layer it into existing geometries (e.g., make `WidthChangeGeometry` and `ShoulderedRoadGeometry` curve-aware) rather than introducing a fourth top-level geometry — keeps the section data simple.

### 6.2 — Manual signed-in QA pass (HIGH PRIORITY, still blocking production)

Carryover from v7/v8. The signed-in flow has been deferred since v1. Before production, walk a real account through:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account, ordered correctly.
- Challenge progress advances on each metric: distance, top speed, max combo, powerups used.
- Achievements unlock at the right thresholds.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Half-day of focused testing. Block production until done.

### 6.3 — Audio team coordination on the v8 music wiring + v9 cinematic SFX

Per-section music wiring (v8) is API-complete but still needs audio team review:
- Are the chosen track assignments (`epic_tension`, `epic_heroic`, `casual_chill`, `action_intense`, `sports_competitive`) the right vibe per section, or do they want bespoke tracks?
- `AudioManager.playMusic` does stop-then-start with a small gap, not a true crossfade. If transitions feel jarring, upgrade to a real crossfade.
- `SECTION_MUSIC_FADE_SECONDS = 1.5` is a guess. Keep it ≤ `SECTION_CLEAR_FLASH_DURATION = 1.8`.
- Consider adding `musicTrack` to currently-inheriting sections (§1, §2, §3, §7).

**v9 cinematic adds three new SFX needs**:
- **Van approach:** distant truck-engine-rumble fade-in during `incoming` phase.
- **Door hiss / open-clank** at the `'incoming' → 'dropoff'` transition.
- **Peel-off:** harder engine acceleration at `'dropoff' → 'departing'` transition, ramping up as the van leaves the screen.

Knobs: `musicTrack` on each `SectionDef`; `SECTION_MUSIC_FADE_SECONDS`; new SFX hooks would go in `tickRespawnVan` at phase transitions.

### 6.4 — Sound design pass for v6/v7/v8/v9 mechanics

Carryover from v7/v8. New mechanics still piggyback generic `'explosion'` / `'hit'` / `'powerUp'` SFX:
- **(v7)** Depth charges — water-plop on drop, blinking-warning beep, deeper sub-bass on detonation.
- **(v7)** Bridge / tunnel ambient swaps.
- **(v7)** Drone swoop — rising whine that telegraphs swoop commit.
- **(v7)** Strafer bursts — distinct firing SFX vs static shooters.
- **(v8)** §6 HARBOR_RUN harbor-approach, §7 OPEN_SEA dawn → day, §8 CHANNEL lock walls.
- **(v9)** Cinematic SFX (see §6.3).
- **(v9)** Civilian bullet hit (currently shares enemy 'hit' SFX) — could differentiate so player hears "I just damaged a civ" without killing them.

Most are 1-line `services.audio.playSound` calls once the SFX exist.

### 6.5 — HP cap per section (playtest-gated)

`MAX_HP = 3` globally. Watch §7 OPEN_SEA + §8 CHANNEL specifically since they're the highest-pressure beats.

### 6.6 — Section-clear reward inflation cap (playtest-gated)

`base + combo × lives × 250` over 9 section-clears can balloon. Cap at `max(lives, 3)` if leaderboards look absurd.

### 6.7 — Bump-mechanic playtest tuning (already partially addressed in v9 Wave 1)

v9 raised soft cars to `bumpResistance = 1.3` and dropper to 1.4. Watch:
- Is 1.3 the right "tiny bit harder" or do players want 1.2 / 1.4?
- Enforcer (2.5) trivial vs impossible?
- SWAT (6.0) bumpable at boost?
- §8 CHANNEL chokepoints — bump physics vs narrow walls.
- **Civilians at 1.3 bump resistance** — too easy to push them off and rack up strikes? Too hard to keep them out of the way? First playtest iteration of soft-traffic civs.

Knobs in `SpeedRacerGame.ts` (`BUMP_FORCE_MIN/MAX`, `BUMP_OFF_ROAD_MARGIN`), `EnemyCar.ts` (`BUMP_FRICTION`, `BUMP_AI_SUPPRESS`, per-type `bumpResistance`), `Civilian.ts` (`CIVILIAN_BUMP_RESISTANCE`, `CIVILIAN_HP`).

### 6.8 — Aquatic arc tuning (post-launch playtest)

Carryover from v8 §4.7. Three new aquatic sections each have specific watch-fors documented there. No v9 changes to sections — observations should hold.

### 6.9 — Drone prediction lead tuning (post-launch playtest)

Carryover. `DRONE_MAX_LEAD = 120`. With v8's CHANNEL chokepoints + v9's slower bullet DPS, drones may now feel too punishing. Drop to 80–100 if so.

### 6.10 — Performance pass

60fps on mid-tier hardware needs verification. v9 added the cinematic state machine (cheap — one extra entity render for 2s after each death) and the player Y lerp (cheap — two multiplies per frame). Loop content unchanged from v8 (still 9 sections). Specific high-density frames remain §4 ALPINE_PASS taper, §5 SUNSET_COAST fork, §6/§7/§8 aquatic arc with bosses, §8 CHANNEL chokepoints during a chopper boss.

Quick wins if it dips:
- Cap `depthCharges.length` to ~8.
- Object-pool projectiles + depth charges.
- Profile slow-path road body — already run-accumulated but per-row shape query could be memoized for stable stretches.

### 6.11 — Lap-scaling stack-up (v8-specific monitoring)

Carryover. Each loop wraparound spreads spawn-tightening. By loop 5+, the §1 spawn floor (0.6s) might land earlier than expected. Easy adjustment: lap scaling factor `0.9^wraparounds` → `0.92^wraparounds`.

### 6.12 — Bigger-than-an-incremental ideas (v11+ territory)

Carryover from v7/v8:
- **Replays / ghosts.** `dt`-keyed input serialization. Wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile.
- **Pixel-sprite migration.** `assetBudgetKB = 130` on the manifest is the current limit. v3-v9 stayed all-canvas.
- **Dynamic time-of-day** across the whole loop.
- **Aquatic boss variant** (gunboat / submarine) for the aquatic arc.

New v9-suggested:
- **Diegetic HUD elements** — depending on §6.1.a's design direction, some HUD info could move onto the car itself (already partially true with the trunk-mounted secondary weapon hint and the chassis damage tier).
- **Camera shake / tilt during boost** — pair with Wave 3a's Y dynamics for more "felt" speed. Cheap to try. Consider after the HUD redesign so the HUD doesn't fight a shaking screen.

---

## 7. Tuning knobs (the cheat sheet)

```
SpeedRacerGame.ts (top constants):
  COMBO_DECAY_TIME            = 4.0s        MAX_COMBO_MULTIPLIER  = 5
  CIVILIANS_LOST_GAME_OVER    = 3           STARTING_LIVES        = 1
  MAX_LIVES                   = 5           LIFE_BONUS_SCORES     = [2500, 10000, 25000, 50000, 100000]
  RESPAWN_INVULN_DURATION     = 2.0s        MAX_HP                = 3
  HIT_INVULN_DURATION         = 1.1s        HIT_FLASH_DURATION    = 0.5s

  Bump (v5/v9):
    BUMP_FORCE_MIN            = 80          BUMP_FORCE_MAX        = 520
    BUMP_OFF_ROAD_MARGIN      = 30          Player recoil         = 50 + bumpResistance * 30

  Section-clear reward:
    SECTION_CLEAR_BONUS_BASE             = 500
    SECTION_CLEAR_BONUS_PER_COMBO_LIFE   = 250
    SECTION_CLEAR_FLASH_DURATION         = 1.8s

  Music (v8):
    SECTION_MUSIC_FADE_SECONDS = 1.5s   (fits inside SECTION_CLEAR_FLASH_DURATION on purpose)

  Respawn cinematic (v9):
    RESPAWN_VAN_INCOMING_DURATION  = 0.7s
    RESPAWN_VAN_DROPOFF_DURATION   = 0.6s
    RESPAWN_VAN_DEPARTING_DURATION = 0.7s   (total 2.0s blocking, then fades during gameplay)
    RESPAWN_VAN_DROP_Y             = 380
    RESPAWN_VAN_INCOMING_FORWARD_SPEED  = 600  (visual; y is direct-lerped)
    RESPAWN_VAN_DEPARTING_FORWARD_SPEED = 700  (visual; y is direct-lerped)

  Lap scaling (private):
    spawn floor 0.6s          burst cap 0.6           formation cap 0.35
    spawn × 0.9^wraparounds   burst +0.08 per loop    formation +0.05 per loop

PlayerCar.ts (player Y dynamics, v9):
  Y_AT_BRAKE  = 510   (gentler, asymmetric)
  Y_AT_BASE   = 480   (matches PLAYER.Y)
  Y_AT_BOOST  = 380   (full Spy Hunter advance)
  Y_LERP_TAU  = 0.18s (~0.5s effective response)

WeaponSystem.ts (v9):
  FIRE_COOLDOWN = 0.10s  (alternating L/R single-shot)
  BULLET_SPEED  = 950
  BARREL_OFFSET_X = 12

EnemyCar.ts (v9):
  BUMP_FRICTION    = 240   BUMP_AI_SUPPRESS = 30   BUMP_COOLDOWN = 0.12
  RAM_LOCK_TRIGGER = 300   RAM_LOCK_DURATION = 0.4 RAM_CHARGE_LATERAL = 320
  APPROACH_RANGE   = 280   FORWARD_SPEED_ACCEL = 280

  Per type (forwardSpeed / matchSpeedDelta / bumpResistance / hp):
    ram      260 /  20 / 1.3 / 2          shooter  300 / 60 / 1.3 / 3 (bulletSpeed 520)
    enforcer 250 /  50 / 2.5 / Inf        armored  180 / 80 / 6.0 / Inf
    patrol   300 /  30 / 1.3 / 2
    dropper  280 /  90 / 1.4 / 3          strafer  290 / 50 / 1.3 / 3 (bulletSpeed 480)

Civilian.ts (v9):
  CIVILIAN_HP              = 2
  CIVILIAN_BUMP_RESISTANCE = 1.3
  BUMP_FRICTION / BUMP_AI_SUPPRESS / BUMP_COOLDOWN  (must match EnemyCar.ts values)

EnemySpawner.ts:
  BURST_INTRA_COOLDOWN = 0.18s          MAX_AIM_LEAD_VX = ±200 px/s
  Inter-burst cooldown = 1.4 + Math.random() * 0.8
  Dropper cadence      = 1.6 + Math.random() * 0.9 (drop window: distY 220..480)

DepthCharge.ts:
  DEFAULT_FUSE          = 1.4s          EXPLOSION_RADIUS = 56px
  EXPLOSION_LIFETIME    = 0.4s          Blink rate ramps 5 → 23 Hz over fuse

BossEnemies.ts:
  Drone:
    DRONE_HOVER_SPEED   = 160           DRONE_SWOOP_SPEED  = 520
    DRONE_RETREAT_SPEED = 260           DRONE_MAX_LEAD     = 120

BossSpawner.ts (per section bias [chopper, drones, tank]):
  FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
  COOLDOWN          = 38..58s between bosses
  Default weights   = [0.45, 0.30, 0.25]
  Per section:
    'harbor-run'  [0.55, 0.30, 0.15]
    'open-sea'    [0.70, 0.28, 0.02]   // chopper-dominant; tank near-zero on water
    'channel'     [0.40, 0.55, 0.05]   // drones rule the canyon-feel narrows
    'alpine-pass' [0.25, 0.20, 0.55]
    'steel-span'  [0.45, 0.30, 0.25]

Section spawn pacing (v8 curve, monotonic §1 → §9, unchanged in v9):
  §1 NEON HIGHWAY  spawn 2.40   burst —     formation —      types: ram-only (tutorial)
  §2 NEON CITY     spawn 1.70   burst —     formation —      types: ram + shooter
  §3 STEEL SPAN    spawn 1.45   burst 0.12  formation 0.08   types: + enforcer
  §4 ALPINE PASS   spawn 1.30   burst 0.20  formation 0.13   types: ram-heavy + civilians
  §5 SUNSET COAST  spawn 1.15   burst 0.28  formation 0.18   types: balanced 4-type + SWAT debut
  §6 HARBOR RUN    spawn 1.15   burst 0.20  formation 0.14   types: ram + shooter + patrol
  §7 OPEN SEA      spawn 1.05   burst 0.30  formation 0.20   types: patrol + strafer + shooter + dropper
  §8 CHANNEL       spawn 0.98   burst 0.36  formation 0.25   types: ram + enforcer + dropper + strafer
  §9 FROST PASS    spawn 0.95   burst 0.40  formation 0.28   types: balanced 4-type
```

Per-section spawner config + lap scaling lives in each `SectionDef` in `data/sections.ts`. Terrain handling:
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
shoulder modifier (v6) → steerMul ×0.65, decelMul ×0.55 (multiplied on top of section terrain)
```

---

## 8. Validation gates

### Per-wave (incremental game changes) — DEFAULT

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # 10 jest unit tests pass as of v9 ship
```

**Skip `npm run build` for incremental Speed Racer changes.** The Next.js production build covers the entire arcade hub and is too heavy/slow for one game's per-wave changes. The user playtests the live build in dev mode after each wave, which is the real validation. (This was an explicit user preference in v9; if you ever land changes that touch shared infra — hub, manifest, build config, asset budgets, routing — run the full build.)

### Pre-release (whole-game ship)

```bash
npm run type-check
npm run lint
npm test
npm run build          # production build succeeds
```

Plus the manual signed-in QA checklist (still pending — see §6.2):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

---

## 9. v9-specific gotchas worth knowing

- **`PLAYER.Y = 480` is now a constant for the road coordinate system, NOT the player's actual Y.** The player's visual Y ranges 380–510 dynamically (Wave 3a). Any code that wants "the canonical road anchor" should use the constant; anything that wants "where the player car actually is" should use `this.player.y`.
- **`RoadProfile.playerWorldY()` is now dynamic** — incorporates the player's screen Y. `RoadProfile.worldYAtScreen(screenY)` is still anchored at the constant. Don't unify them.
- **`setPlayerScreenY` must be called BEFORE shape queries** in any frame. `SpeedRacerGame.onUpdate` does it right after `player.update`. New shape-query work added before that point would read a stale anchor (one-frame visual glitch under heavy steering).
- **`shotsFired` is now load-bearing** for L/R alternation in `WeaponSystem`. Was previously incremented but unused; if you ever zero it out for a non-cosmetic reason, the next bullet's barrel offset will desync.
- **Civilians have HP and bump physics now.** Anything in collision code that does `civ.alive = false` directly is a bug — go through `civ.takeHit()` or the off-road scan instead.
- **The respawn cinematic blocks input for 1.3s, not the full 2.0s.** `'departing'` (last 0.7s) runs concurrent normal gameplay. Don't move the input gate to cover all 2.0s without re-thinking the player experience — it would feel laggy.
- **`respawnInvuln` is armed at the cinematic's `'dropoff' → 'departing'` transition.** Pre-v9 code that armed it in `respawn()` directly will now double-arm (harmless but redundant) or eat into the i-frame window if the cinematic logic also moves. Audit if you change the cinematic state machine.
- **`startRespawnCinematic` is called from THREE sites:** `onInit` (game start, life 1, GET READY!), `respawn` (extra-life consumed, life N, LIFE N), `onRestart` (player retried after recap, life 1, GET READY!). All three reset or increment `currentLifeNumber` correctly. New entry points must do the same.
- **The `respawnVan` is NOT in the spawner's pickup-van list.** It's a transient owned by `SpeedRacerGame` directly. The spawner-managed pickup vans continue scheduling normally during the cinematic — they're a separate concern.
- **`WeaponVan.payload` is required even in respawn mode.** The cinematic passes `'missile'` as a dummy; the value isn't read because respawn vans aren't dockable (the spawner's dock-pickup loop only looks at vans returned by `spawner.getVans()`). If you ever make payload nullable, audit the dock-pickup site.
- **`forwardSpeed` is now mutable on `WeaponVan`.** Pre-v9 it was readonly. Pickup-van code doesn't assign to it; only the cinematic does. If the spawner ever needs to vary pickup-van speed, that's now possible without an interface change.
- **Per-handoff invariant docs were removed.** The v8 handoff doc (`SPEED-RACER-V8-HANDOFF.md`) was deleted when this v9 doc shipped. Earlier prose was consolidated into the relevant sections here. Don't keep multiple handoffs around.

---

## 10. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # game loop, damage funnel, collision resolution,
│                                  #   recap, applyRoadProfile, off-road bump-kill scan
│                                  #   (enemies + civilians, v9), resolvePalette per-frame,
│                                  #   applySectionMusic + currentMusicTrack (v8),
│                                  #   respawn cinematic state machine + tickRespawnVan +
│                                  #   GET READY/LIFE N overlay (v9)
├── SPEED-RACER-V9-HANDOFF.md      # this doc
├── index.ts
├── data/
│   ├── constants.ts               # PLAYER + legacy ROAD constants. PLAYER.Y is the
│                                  #   canonical road anchor; the player's actual Y is
│                                  #   dynamic per Wave 3a. ROAD constants are legacy
│                                  #   fallbacks used only by StraightRoadGeometry.
│   ├── secondaryWeapons.ts
│   └── sections.ts                # SectionDef, SectionPalette, TunnelZone,
│                                  #   PaletteOverrideZone (v7), resolvePalette (v7),
│                                  #   musicTrack on SectionDef + 5 explicit assignments (v8),
│                                  #   all 9 sections (v8, unchanged in v9)
├── entities/
│   ├── PlayerCar.ts               # segment-aware clamp, shoulder handling,
│   │                              #   pendingDividerHit, speed-driven Y dynamics +
│   │                              #   exponential lerp (v9)
│   ├── EnemyCar.ts                # 7 enemy types, bump physics, segment-aware AI,
│   │                              #   dropper + strafer (v7) sprites + AI dispatch,
│   │                              #   v9 HP +1 + soft-car bumpResistance bumps
│   ├── Civilian.ts                # (v9) HP, bumpVx, bumpResistance, applyBump,
│   │                              #   takeHit; bump physics constants duplicated
│   │                              #   from EnemyCar (must stay in sync)
│   ├── DepthCharge.ts             # (v7) fuse-timed water hazard with radial detonation
│   ├── WeaponVan.ts               # (v9) mode: 'pickup' | 'respawn' + doorsOpen render
│   │                              #   variants; forwardSpeed now mutable
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   ├── BombChopper.ts
│   └── BossEnemies.ts             # Tank/Drone, profile-aware spawn helpers,
│                                  #   drone aim-lead (v7)
└── systems/
    ├── RoadProfile.ts             # interfaces + StraightRoadGeometry + RoadProfile
    │                              #   wrapper. (v9) playerScreenY field + setPlayerScreenY;
    │                              #   playerWorldY uses dynamic anchor.
    ├── RoadGeometries.ts          # WidthChangeGeometry, ForkGeometry, ShoulderedRoadGeometry
    ├── RoadRenderer.ts            # body / edges / lanes / divider / tunnel overlay / posts / shoulders
    ├── WeaponSystem.ts            # (v9) FIRE_COOLDOWN 0.10s, alternating L/R single-shot
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # segment-aware spawn, formations bail in fork sections,
    │                              #   dropper + depth-charge tracking (v7),
    │                              #   bulletSpeed-keyed firing dispatch (v7)
    ├── BossSpawner.ts             # threads playerVx through (v7),
    │                              #   open-sea + channel bias entries (v8)
    ├── TerrainHazards.ts
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

---

## 11. Section identity at a glance

| § | Section        | Geometry feature          | Palette feature           | Enemy mix                                    | Boss bias       | Music             |
|---|----------------|---------------------------|---------------------------|----------------------------------------------|-----------------|-------------------|
| 1 | NEON HIGHWAY   | Drivable shoulders (v6)   | —                         | ram-only (tutorial)                          | (no bosses yet) | (inherit primary) |
| 2 | NEON CITY      | Tunnel mid-section (v6)   | —                         | ram + shooter                                | default         | (inherit)         |
| 3 | STEEL SPAN     | (none — scenery bridge)   | Concrete crossfade (v7)   | + enforcer                                   | default         | (inherit)         |
| 4 | ALPINE PASS    | Two narrow chokepoints (v6) | —                       | ram-heavy + civilians                        | tank-heavy      | `epic_tension` (v8) |
| 5 | SUNSET COAST   | Fork with central divider (v6) | —                    | balanced 4-type + SWAT debut                 | default         | `epic_heroic` (v8) |
| 6 | HARBOR RUN     | Boardwalk shoulders (v8)  | Working-harbor crossfade (v8) | ram + shooter + **patrol**               | chopper-leaning | `casual_chill` (v8) |
| 7 | OPEN SEA       | (none — straight rect)    | **Dawn → day crossfade (v8)** | patrol + **strafer** + shooter + dropper | chopper-dominant| (inherit chill)   |
| 8 | CHANNEL        | **Lock chokepoints (v8)** | —                         | ram + enforcer + **dropper** + strafer       | drone-heavy     | `action_intense` (v8) |
| 9 | FROST PASS     | (none — ice terrain)      | —                         | tightest spawns                              | default         | `sports_competitive` (v8) |

Every section has at least one signature feature. Sections §1, §2, §9 still ride a single feature each — natural targets if a future team has a clear gameplay reason to add another.

Road turns / curvature (§6.1.b) when implemented should layer onto existing geometries rather than introduce a 4th — keeps section data simple and the curvature works orthogonally to width-change / fork / shouldered features.
