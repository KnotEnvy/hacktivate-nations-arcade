# Speed Racer — v2 Handoff

Welcome. v1 shipped April 17–18 2026. This doc is everything you need to pick up where we left off: what works, what's tuned, what's intentionally missing, and where to add it.

---

## 1. What v1 ships

**Concept:** Spy Hunter-style top-down vehicular combat on an endless synthwave highway. Keyboard-only. Single life, arcade-style death → in-canvas recap → retry.

**Registered as:** `speed-racer`, Tier 2, 130 KB asset budget, `inputSchema: ['keyboard']`.

**Gameplay loop**
- Player drives the spy car; world scrolls toward the player at `player.speed` px/sec.
- Machine gun autofires with `SPACE`. Secondary weapon fires with `KeyQ` (edge-detected).
- Enemies: Ram (1 HP, sideswipe AI), Shooter (2 HP, fires bullets when aligned), Armored (∞ HP — bulletproof, must be missiled or oil-slicked... actually oil leaves armored untouched, so they're strictly missile kills in v1).
- Civilians: drive normally. Hitting or shooting one drops the combo and adds to `civiliansLost`. Hit 3 civilians and you die (`civilian_spree`).
- Weapon Vans spawn every 18–28s. Dock with the rear (`van.getDockBounds()`) to equip a random secondary (`missile` / `oil` / `smoke`) with preset ammo.
- Score = `floor(distance / 10) + enemiesDestroyed * 100 + sum(kill bonuses × combo)`. Combo maxes at x5, decays after 4s of no kills.
- Death routes through an in-canvas **recap panel** (see §5) before the outer React game-over overlay.

**Extended payload** (`this.extendedGameData`, drives achievements/challenges)
```
distance, speed (max), combo (max), powerups_used,
enemies_destroyed, civilians_lost, van_pickups, sections_cleared
```
`sections_cleared` is wired but always `0` — intentional for v1 (see v2 scope).

---

## 2. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts            # BaseGame subclass, orchestrator + recap
├── index.ts
├── data/
│   ├── constants.ts             # CANVAS, ROAD, PLAYER, ROAD_RENDER, SCENERY
│   └── secondaryWeapons.ts      # SECONDARY_CONFIGS + pickRandomSecondary()
├── entities/
│   ├── PlayerCar.ts             # Steering + accel/brake, bounds + render
│   ├── EnemyCar.ts              # ENEMY_CONFIGS + AI for ram/armored (shooter AI lives in spawner)
│   ├── Civilian.ts              # Passive traffic, pastel colors
│   ├── WeaponVan.ts             # Has payload + dockBounds vs bodyBounds
│   ├── Projectile.ts            # Used by both player gun and shooter enemies
│   ├── Missile.ts               # Secondary weapon, kills armored
│   └── Hazard.ts                # Oil + smoke, ground-scroll + lifetime
└── systems/
    ├── RoadRenderer.ts          # Scrolling road, parallax scenery
    ├── WeaponSystem.ts          # Player machine gun
    ├── SecondaryWeaponSystem.ts # Active secondary + ammo + cooldown + missile/hazard lists
    ├── EnemySpawner.ts          # Owns enemies, civilians, vans, enemy projectiles
    ├── Particles.ts              # Explosion / muzzle / hit / pickup bursts
    └── CameraShake.ts           # Trauma-based shake, applied in render()
```

Related files outside the game folder:
- `src/games/registry.ts` — registration (`speed-racer`)
- `src/data/Games.ts` — catalog entry
- `src/lib/gameThemes.ts` — `'speed-racer'` theme, primary `#FF0080` (must stay unique per test)
- `src/services/ProceduralMusicEngine.ts` — mapped to `action_chase` / `sports_competitive`
- `src/components/arcade/AudioSettings.tsx` — short label `'SPD'`
- `public/games/speed-racer/speed-racer-thumb.svg` — 512×512 thumbnail

---

## 3. Conventions that matter

- **dt is seconds**, capped at 0.1 upstream in `useGameModule.ts`. All speeds are px/sec, accelerations px/sec².
- **Canvas is 800×600.** Road: `X_MIN=160`, `X_MAX=640`, `WIDTH=480`, `CENTER=400`, 4 lanes. Player Y is fixed at `480` (`PLAYER.Y`).
- **World-frame motion model.** Each enemy / civilian / van has a `forwardSpeed` (world-frame px/sec). Its screen vy is `playerSpeed - forwardSpeed`. Speeding up makes you catch slow traffic; braking lets it overtake. Hazards (oil/smoke) are stuck to the ground → `vy = playerSpeed`.
- **Input.** Use `services.input` — it's an `InputManager` that takes KeyboardEvent `code` values (`'KeyQ'`, `'Space'`, etc.), plus convenience helpers `isLeftPressed()`, `isUpPressed()`, etc. Do **not** compare to lowercase `'q'` — that will never match.
- **Edge detection** for single-shot actions: track `...WasDown` and check `down && !wasDown`. See the `KeyQ` handler.
- **Audio** via `this.services?.audio?.playSound?.(name, { volume })`. See `AudioManager.ts` for the `SoundName` union. v1 uses: `shoot`, `explosion`, `hit`, `collision`, `powerUp`, `laser`, `whoosh`.
- **Lint rule does not honor `_`-prefixed unused params.** Remove the param entirely from the signature — don't rename.
- **`gameThemes.test.ts` enforces unique primary colors** across themes. If you change the palette, pick a hex not used by another theme.

---

## 4. Death & recap flow (critical — don't regress this)

The game no longer calls `this.endGame()` directly at death. Instead:

1. Collision handler calls `this.triggerDeath(cause)`.
2. `recapMode` flips true, `recapStats` snapshot is captured, `extendedGameData` is finalized immediately so the end-of-game payload is correct regardless of dismissal timing.
3. `onUpdate` short-circuits to `updateRecap(dt)` — particles + shake keep ticking, plus a timer + input watcher.
4. `onRender` still runs the scene (minus the player sprite) and overlays the synthwave recap panel via `renderRecap()`. `onRenderUI` early-returns during recap so the HUD doesn't double-draw.
5. `RECAP_INPUT_LOCKOUT = 1.2s` before dismiss is accepted, and we require the player to *release* any dismiss key before re-press — prevents the same SPACE that killed you from auto-closing the recap.
6. Dismiss (Space/Enter/Esc/R) or `RECAP_AUTO_DISMISS = 12s` calls `finalizeRecap()` → `this.endGame()`, which triggers the outer React "GAME COMPLETE" overlay.

**Why this matters:** v1 had a real bug where killing → `endGame()` left the canvas black for up to 100ms while ThemedGameCanvas polled `isGameOver()`. Worse, under a state-batching race the React overlay could get clobbered from `'ended'` back to `'paused'` and never reappear. Both are fixed:
- Canvas stays alive throughout recap (no blank gap).
- `ThemedGameCanvas.tsx` now early-returns from the `isRunning`/`gameState` transition effect when `gameState === 'ended'`.

**If you add new death paths in v2,** route them through `triggerDeath(cause)` with a new `DeathCause` string and extend the `causeLabel` map in `renderRecap()`. Don't call `this.endGame()` directly from collision code.

---

## 5. Tuning knobs (top of `SpeedRacerGame.ts` + `data/constants.ts`)

```
COMBO_DECAY_TIME       = 4.0s
MAX_COMBO_MULTIPLIER   = 5
CIVILIANS_LOST_GAME_OVER = 3
SMOKE_SLOW_FACTOR      = 0.4     // enemies retain 40% of forward motion in smoke
SMOKE_SLOW_DURATION    = 1.5s

Spawner (set in onInit):
  spawnInterval          1.4s
  enemyTypeWeights       ram:6, shooter:3, armored:1
  civilianChance         0.7 per civTimer tick
  civilianSpawnInterval  2.4s
  vanIntervalMin/Max     18s / 28s

PLAYER:
  STEER_ACCEL/DECEL      1800 / 2400
  STEER_MAX_SPEED        380
  BASE/BOOST/BRAKE       360 / 640 / 160
  SPEED_ACCEL/DECEL      320 / 480
```

`ENEMY_CONFIGS` (`entities/EnemyCar.ts`) has the per-type HP, score, coin drop, forward speed, and `bulletproof` flag.

---

## 6. Deferred v1 polish (tweaks flagged during playtest)

**Status: intentionally deferred past v2.** Product owner reviewed the v1 build and confirmed the outstanding tweaks were "mainly cosmetic and minor" — not gating for the v2 scope below. The v2 team built §7.1–§7.8 directly without re-litigating v1 polish, and v3 handoff inherits this same posture.

If you want to revisit, fresh playtest is the right starting point — the section progression, lives system, and terrain handling that landed in v2 changed the moment-to-moment feel enough that v1 polish notes may no longer apply. See `SPEED-RACER-V3-HANDOFF.md` for the current state of the codebase.

---

## 7. v2 scope — skipped in v1

Each item has a one-line "where to start" pointer.

### 7.1 Multi-section progression
**What:** Distinct highway sections (urban → bridge → mountain → coast etc.) with themed palettes and escalating difficulty. `extendedGameData.sections_cleared` is already reserved — currently always 0.

**Where to start:**
- Add `src/games/speed-racer/data/sections.ts` with `SectionDef { id, backgroundPalette, enemyWeights, civilianChance, spawnInterval, lengthMeters, transitionBanner }`.
- In `onUpdate`, advance a `currentSectionProgress` based on `this.distance`; when it exceeds `section.lengthMeters`, increment `sectionsCleared`, swap the spawner's `configure({...})` for the next section, and trigger a banner.
- `RoadRenderer` currently has hard-coded colors in `ROAD_RENDER` — lift those to a palette param accepted by `update()/render()`.
- Show a section banner in `onRenderUI` for ~2s at each transition.

### 7.2 Boat / water transformation
**What:** A river section where the car becomes a boat. Steering physics lighten, shooting continues, enemies are jet-boats.

**Where to start:**
- Add `PlayerBoat` entity or a `mode: 'car' | 'boat'` flag on `PlayerCar`. Swap render + adjust `STEER_*` constants.
- `RoadRenderer` becomes a `TerrainRenderer`; add a water mode with wake lines replacing lane dividers.
- New enemy configs in `ENEMY_CONFIGS` (`jetboat_ram`, `jetboat_shooter`). Keep the `EnemyCar` base class; the AI shapes transfer.
- Transition is a section boundary: end of road → bridge ramp into water → bridge back onto road.

### 7.3 Ice / weather sections
**What:** Reduced traction (more lateral drift), visibility modifier (vignette or snowfall overlay), and palette swap.

**Where to start:**
- Add a `TerrainFriction` multiplier consumed by `PlayerCar.update()` — currently `vx` has a fixed `STEER_DECEL`; divide by the multiplier on ice.
- Weather overlay lives in a new `WeatherSystem` (sibling to `ParticleSystem`) rendered in `onRender` after particles.

### 7.4 Bomb Chopper enemy
**What:** A helicopter that crosses the screen dropping bombs. Rare event enemy, high score value.

**Where to start:**
- New entity `entities/BombChopper.ts` + bomb projectile variant (shrinks / lands / explodes in a radius).
- Scheduled separately from the ground spawner — add a `BossSpawner` system or extend `EnemySpawner` with a `scheduledEvents` timeline.
- Explosion radius vs player bounds = death (`triggerDeath('chopper_bomb')`).

### 7.5 Bonus-threshold extra lives
**What:** At score thresholds (e.g., 10k, 25k, 50k), award an extra life. v1 is strictly single-life.

**Where to start:**
- Add `lives: number` to `SpeedRacerGame`; change `triggerDeath` to decrement and only enter recap when `lives === 0`.
- Between-life transition: brief invuln window + a "LIFE LOST" flash — don't use the full recap panel.
- Thresholds come from a `LIFE_BONUS_SCORES` array; fire when `this.score` crosses each only once per run.

### 7.6 Touch controls
**What:** Add mobile input. v1 manifest is `inputSchema: ['keyboard']`.

**Where to start:**
- Update manifest to `['keyboard', 'touch']` in **both** `SpeedRacerGame.manifest` and `src/data/Games.ts`.
- `InputManager` already has touch hooks — add a virtual D-pad overlay (steer L/R + accel pedal + fire) via a new `TouchControls` component mounted inside `ThemedGameCanvas` for touch-capable UAs, or extend shared touch infra if present.
- Secondary fire needs its own touch button; edge-detection in the game stays the same.

### 7.7 Bespoke daily challenges
**What:** `speed-racer_*` challenge templates that use the extended payload metrics (distance, speed, combo, powerups_used, enemies_destroyed).

**Where to start:**
- `src/lib/challenges.ts` is the challenge template source. Add templates like `speed-racer_distance_10k`, `speed-racer_no_civ_3min`, `speed-racer_combo_x5`.
- Metric names must match `extendedGameData` keys. Confirm wiring end-to-end with a manual signed-in run (§9 validation).

### 7.8 Achievements pass
**What:** v1 ships with no Speed Racer-specific achievements. Bubble Pop has 13; match that bar.

**Where to start:**
- `src/data/Achievements.ts`. Use extended payload metrics as predicates. Ideas: "Highway Hero" (kill 50 enemies in one run), "Ghost Driver" (clear 5k distance with 0 civilians), "Full Arsenal" (equip all three secondaries in one run — needs a new payload key `unique_secondaries_used`).

---

## 8. Known incidental cleanup

- `PlayerCar.pushOffRoad()` exists but is unused. Intended for a "ram into armored = bypass" mechanic that didn't land. Remove or wire up.
- `EnemyCar.fireCooldown` lives on every enemy but only shooter-type uses it (AI for shooters lives in `EnemySpawner.updateShooter`, not on the entity). Fine for v1; consider moving into a subclass hierarchy if the type list grows.
- `EnemySpawner.updateShooter` hard-codes `ENEMY_BULLET_SPEED = 520` at module scope. Move into the enemy config when adding jet-boats / new shooters.
- Armored enemies take oil-slick hits but are explicitly skipped (`if (!enemy.config.bulletproof)`). If "bulletproof but oil-vulnerable" is desired, flip that check.

---

## 9. Validation gates

Everything must stay green. Run before opening a v2 PR:

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # 119/119 passing (plus whatever you add)
npm run build          # production build succeeds
```

Manual signed-in QA pass (not yet done by v1 team — flag for v2 intake):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly; no leaked per-account data.

---

## 10. Suggested v2 sequencing

1. **Deferred v1 polish** (§6) — land first, they're cheap and playtest-driven.
2. **Multi-section progression** (§7.1) — unblocks boat and weather sections cleanly. Build the section machinery before skinning new terrain.
3. **Achievements pass** (§7.8) — easy win once multi-section is in; boosts replay.
4. **Extra lives** (§7.5) — low risk, high feel improvement.
5. **Touch controls** (§7.6) — independent, can run in parallel.
6. **Bomb Chopper** (§7.4) — boss-style scheduled event; wait until multi-section is stable.
7. **Boat / weather** (§7.2, §7.3) — biggest scope; depends on terrain abstraction from §7.1.
8. **Daily challenges** (§7.7) — finish with this once the payload is stable.

Good luck. Game is in a good place — keep the recap invariant (§4), the world-frame motion model (§3), and the validation gates (§9), and you'll have a smooth v2.
