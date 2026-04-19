# Speed Racer — v3 Handoff

v2 shipped April 18 2026. Supersedes `SPEED-RACER-V2-HANDOFF.md` (kept for history). This doc tells the v3 team what landed, what stayed the same, and where to plug in next.

---

## 1. What v2 added (since v1)

All §7 v2 scope items from the v2 doc are now in. v1 invariants (recap flow, world-frame motion, validation gates) all preserved.

**Multi-section progression (§7.1).** 7 themed sections cycle in order, then loop. Each has its own palette, scenery style, spawner config, and optional terrain handling. Source of truth: `src/games/speed-racer/data/sections.ts`.

| # | id            | scenery    | terrain | feel                                          |
|---|---------------|------------|---------|-----------------------------------------------|
| 1 | neon-highway  | trees      | road    | gentle intro, no armored                      |
| 2 | neon-city     | buildings  | road    | snipers + 1 armored                           |
| 3 | steel-span    | bridge     | road    | armored gauntlet, generous van cadence        |
| 4 | alpine-pass   | mountain   | road    | ram-heavy, civilian dodge                     |
| 5 | sunset-coast  | coast      | road    | mixed-threat finale of the loop               |
| 6 | harbor-run    | water      | water   | floaty steering, jet-boat lanes               |
| 7 | frost-pass    | ice        | ice     | very slippy, snowfall overlay                 |

`SECTIONS` is consumed via `getSection(index)` which wraparounds — adding sections is just an array push.

**Section banners.** Fade-in / hold / fade-out transition banner with palette-matched glow. Live in `SpeedRacerGame.renderSectionBanner()`. Constants `BANNER_FADE_IN`, `BANNER_HOLD`, `BANNER_FADE_OUT` at the top of the file.

**Terrain handling.** `SectionDef.terrain?: 'road' | 'water' | 'ice'` selects a `HandlingProfile` from `TERRAIN_HANDLING` in `sections.ts`. The game calls `player.setHandling(steerMul, decelMul)` on every section change (`applyTerrainHandling()`). Water = floaty boat, ice = very slippy.

**RoadRenderer is palette-driven.** All hard-coded colors lifted into `SectionPalette`. Renderer takes the active palette per render call. Scenery dispatch handles `trees | buildings | bridge | mountain | coast | water | ice`. Per-block scenery uses a seeded LCG (`seededRandom` + `hash(blockIndex, salt)`) so parallax is stable as the road scrolls.

**Bomb Chopper boss (§7.4).** `entities/BombChopper.ts` defines `BombChopper` (helicopter, 1 HP, missile-killable, `CHOPPER_SCORE_REWARD = 1500`, `CHOPPER_COIN_REWARD = 35`) and `Bomb` (falls to a fixed target X/Y set on release — does **not** track the player after drop). `systems/BossSpawner.ts` schedules them: first chopper after `sectionsCleared >= 1`, then 38–58s cooldown. Bombs explode in a 64px radius — `bomb.justExploded` fires for one frame so the game does a single damage check. New death cause: `'chopper_bomb'` ("BOMBED FROM ABOVE").

**Extra lives (§7.5).** `STARTING_LIVES = 1`, `MAX_LIVES = 5`. `LIFE_BONUS_SCORES = [10000, 25000, 50000, 100000]` — each crossed threshold awards +1 life (capped). `triggerDeath` decrements when `lives > 1` and `cause !== 'self_end'` (ESC always ends the run), then calls `respawn()` which clears enemies/projectiles/bombs, drops the combo, resets `civiliansLost`, and arms `RESPAWN_INVULN_DURATION = 2.0s` of invulnerability. Player flickers during invuln (12 Hz). UI: 5 small car icons (`renderLivesIcons`); red vignette `LIFE LOST` overlay (`renderLifeLostOverlay`); gold pulse `EXTRA LIFE` overlay (`renderExtraLifeOverlay`).

**Touch controls (§7.6).** Manifest is now `inputSchema: ['keyboard', 'touch']`. `systems/TouchControls.ts` renders a translucent on-canvas D-pad (left side) + FIRE circle + WEAPON pill (right side). Layout is canvas-space (800×600). Auto-hides until first touch is observed so desktop play stays uncluttered. The game ORs `tc.leftHeld()` etc. into a tiny `DirectionalInput` adapter passed to `player.update()`. Secondary fire is edge-triggered via `tc.consumeSecondaryPress()` so a held finger doesn't burn ammo.

**Bespoke daily challenges (§7.7).** 6 templates added in `src/lib/challenges.ts` — all `gameId: 'speed-racer'`, `aggregation: 'max'`. Metric union extended with `enemies_destroyed | van_pickups | sections_cleared`. `ArcadeHub.tsx` updates progress for these inside the `selectedGameId === 'speed-racer'` block.

| templateId                    | metric             | target |
|-------------------------------|--------------------|--------|
| speedracer_distance_haul      | distance           | 5000   |
| speedracer_demolisher         | enemies_destroyed  | 20     |
| speedracer_top_speed          | speed              | 640    |
| speedracer_bridge_burner      | sections_cleared   | 3      |
| speedracer_quartermaster      | van_pickups        | 3      |
| speedracer_combo_chain        | combo              | 4      |

**Achievements (§7.8).** 13 speed-racer achievements added to `src/data/achievements.ts`. ArcadeHub wires the metric checks: `enemies_destroyed`, `van_pickups`, `powerups_used`, `sections_cleared`, plus the cross-game `distance`, `max_speed`, `max_combo`, `score`. `GameEndData` extended with `van_pickups`, `powerups_used`, `sections_cleared`, `civilians_lost`.

---

## 2. Updated file map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # orchestrator, recap, lives, sections, touch wiring
├── index.ts
├── data/
│   ├── constants.ts               # CANVAS, ROAD, PLAYER, SCENERY (no more ROAD_RENDER)
│   ├── secondaryWeapons.ts
│   └── sections.ts                # NEW — SectionDef, palette, terrain, SECTIONS array
├── entities/
│   ├── PlayerCar.ts               # + setHandling(steerMul, decelMul); takes DirectionalInput
│   ├── EnemyCar.ts
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Missile.ts
│   ├── Hazard.ts
│   └── BombChopper.ts             # NEW — BombChopper + Bomb
└── systems/
    ├── RoadRenderer.ts            # palette-driven; dispatches 7 scenery styles
    ├── WeaponSystem.ts
    ├── SecondaryWeaponSystem.ts
    ├── EnemySpawner.ts            # exports SpawnerOptions for Partial<> on SectionDef
    ├── BossSpawner.ts             # NEW — chopper schedule + bomb pool
    ├── TouchControls.ts           # NEW — virtual D-pad + action buttons overlay
    ├── Particles.ts
    └── CameraShake.ts
```

Outside the game folder (touched in v2):
- `src/components/arcade/ArcadeHub.tsx` — `GameEndData` extended; speed-racer challenge + achievement wiring
- `src/lib/challenges.ts` — metric union + 6 templates
- `src/data/achievements.ts` — 13 achievements

---

## 3. Conventions still in force (don't regress)

- **dt is seconds**, capped at 0.1 upstream.
- **Canvas 800×600.** Road `X_MIN=160` / `X_MAX=640`. Player Y `480`.
- **World-frame motion.** Enemy `forwardSpeed`; screen `vy = playerSpeed - forwardSpeed`. Hazards stick to ground (`vy = playerSpeed`).
- **Input.** `services.input` (`InputManager`) exposes `isKeyPressed('Space')`, `isLeftPressed()` etc. plus `getTouches()`.
- **Edge detection** for single-shot actions: track `...WasDown`, fire on `down && !wasDown`. The new touch secondary uses `consumeSecondaryPress()` which is one-shot by design.
- **Lint does NOT honor `_`-prefixed unused params.** Remove the param entirely.
- **`gameThemes.test.ts`** enforces unique theme primary colors. Don't reuse `#FF0080`.
- **Recap invariant (§4 of v2 doc).** Death routes through `triggerDeath(cause)`; never call `endGame()` directly from collision code. Add new causes by extending the `DeathCause` union and the `causeLabel` map in `renderRecap()`.

---

## 4. Tuning knobs (top of `SpeedRacerGame.ts`)

```
COMBO_DECAY_TIME       = 4.0s
MAX_COMBO_MULTIPLIER   = 5
CIVILIANS_LOST_GAME_OVER = 3

Banners:
  BANNER_FADE_IN  = 0.45s
  BANNER_HOLD     = 1.6s
  BANNER_FADE_OUT = 0.55s

Lives:
  STARTING_LIVES        = 1
  MAX_LIVES             = 5
  LIFE_BONUS_SCORES     = [10000, 25000, 50000, 100000]
  RESPAWN_INVULN_DURATION = 2.0s
  LIFE_LOST_FLASH_DURATION = 1.2s
  LIFE_BONUS_FLASH_DURATION = 1.6s
```

Bomb Chopper (`BombChopper.ts` + `BossSpawner.ts`):
```
CHOPPER_Y               = 72
CHOPPER_SPEED           = 230 px/s
BOMB_FALL_TIME          = 1.45s
BOMB_EXPLOSION_RADIUS   = 64
CHOPPER_SCORE_REWARD    = 1500
CHOPPER_COIN_REWARD     = 35
FIRST_CHOPPER_DELAY     = 14s after sectionsCleared >= 1
COOLDOWN                = 38..58s between choppers
```

Per-section spawner config (`spawnInterval`, `enemyTypeWeights`, `civilianChance`, `vanIntervalMin/Max`) lives in each `SectionDef` in `data/sections.ts`. `EnemySpawner.pickType` does cumulative subtraction, so a weight of `0` is a hard exclusion — that's how section 1 stays armored-free.

Terrain handling (`TERRAIN_HANDLING` in `sections.ts`):
```
road  → steerMul 1.0,  decelMul 1.0
water → steerMul 0.7,  decelMul 0.55
ice   → steerMul 0.55, decelMul 0.28
```

---

## 5. v3 scope ideas — start here

**v2 took the game from "endless tier-2 prototype" to a complete arcade run with progression, boss, lives, mobile, and metaprogression.** v3 work is incremental polish + reach.

### 5.1 Per-section music cues
Currently the `ProceduralMusicEngine` is mapped once at game start (`action_chase` / `sports_competitive`). Sections feel different visually but sound the same. Hook a music swap into `advanceSection()` so the bridge gets a tense theme, the harbor gets something dubbier, frost pass goes ambient. Define a `musicTrack` field on `SectionDef` and route through the audio engine.

### 5.2 Boss variety
Bomb Chopper is the only boss. Add 1–2 more on the same `BossSpawner` schedule:
- **Tank Convoy** — armored escort; player must use missiles + dodge in formation.
- **Drone Swarm** — small fast units that lock-on and ram from above.

`BossSpawner` already owns the cooldown; extend it with a `pickBoss()` weighted picker and a small registry of boss classes that share `update / render / getBounds / takeHit`.

### 5.3 Boat/Ice gameplay deepening
Current water + ice sections only modify steering and visuals. Could add:
- **Water-only enemies** (jet-boats with wake trails). Add to `ENEMY_CONFIGS` and have `EnemySpawner.configure` accept an `enemyTypes` whitelist (already does — just plumb new types).
- **Ice patches** — discrete hazards that briefly zero out `decelMul` until you cross. Could reuse the `Hazard` system.
- **Snowfall as visibility nerf** — vignette + reduced reticle range. Would need a small `WeatherSystem` (mentioned in the v2 doc, never built).

### 5.4 Section-exit reward
Right now clearing a section is just a banner + slight shake + powerup chime. Consider:
- Score bonus proportional to `(combo * livesRemaining)`.
- Mid-screen `SECTION CLEAR +N` flash next to the banner.
- Maybe a guaranteed weapon van spawn at the start of the next section.

### 5.5 Mobile polish
Touch controls work but haven't been QA'd on a real device. Things likely to need attention:
- D-pad button sizing — 44px hit boxes are minimum-acceptable, may need bigger on small phones.
- Coordinate scaling — `TouchControls` uses canvas-space (800×600). Confirm `InputManager.updateTouchState` returns canvas-space coords correctly when the canvas is CSS-scaled.
- Landscape orientation lock — currently nothing enforces it; D-pad layout assumes wide aspect.
- Browser pinch-zoom interfering with touchstart/touchmove preventDefault.

### 5.6 Achievement pass v2
13 achievements is on par with Bubble Pop, but most are quantity-based (kill N, travel N). Higher-craft ideas:
- **Pacifist mile** — 1000m without firing.
- **Surgeon** — clear a full section with 0 civilians lost.
- **Boss hunter** — kill 3 choppers in one run.
- **Globetrotter** — visit all 7 sections in one run.

These need either new payload keys or in-game tracked counters routed through `extendedGameData`.

### 5.7 Death-cause-specific recap hints
`improvementHint()` is generic. Could branch on `cause`:
- `chopper_bomb` → "Watch the reticle — bombs lock to a fixed spot."
- `civilian_spree` → "Hold fire when civilians are in your lane."
- `enemy_bullet` → "Strafe early — Shooter bullets are slow but tracking your last position."

### 5.8 Replays / ghosts (stretch)
Record `dt`-keyed input frames and serialize a short "best run" replay per section. Could power a leaderboard ghost overlay. Big lift; defer unless arcade-wide replay infra lands first.

---

## 6. Known small things still around

- `PlayerCar.pushOffRoad()` still unused (carried over from v1).
- Armored enemies still skip oil-slick hits — flip if "bulletproof but oil-vulnerable" is desired.
- `EnemySpawner.updateShooter` still hard-codes `ENEMY_BULLET_SPEED`. Move into `ENEMY_CONFIGS` if shooter variants are added.
- `BossSpawner` doesn't render off-screen culling — choppers always render their tail boom even before they're fully on canvas. Cosmetic only.
- Section banner can briefly overlap with the `EXTRA LIFE` overlay if a threshold is crossed exactly at a section boundary. Both fade independently; visually fine but worth noting.

---

## 7. Validation gates (unchanged)

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # all tests pass (count grew with v2 — confirm baseline before changes)
npm run build          # production build succeeds
```

Manual signed-in QA still TODO from v2:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric (try `speedracer_distance_haul`).
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Add for v3:
- Touch QA on at least one iOS device and one Android device. Confirm D-pad hit boxes are reachable, FIRE doesn't accidentally trigger on accel-pad scrolling, and orientation lock (or fallback) behaves.
- Lives flow: deliberately die in section 2 and confirm chopper bombs are cleared, civilian counter resets, and the next death actually ends the run.

---

## 8. Suggested v3 sequencing

1. **Mobile QA pass** — find out what actually breaks before building more on touch.
2. **Per-section music** (§5.1) — small change, big perceptual lift.
3. **Section-clear reward** (§5.4) — couple hours, payoff loop tightens.
4. **Death-cause-specific hints** (§5.7) — text-only, fast.
5. **Boss variety** (§5.2) — biggest entertainment value.
6. **Boat/Ice deepening** (§5.3) — only after boss variety lands, since enemy-type plumbing overlaps.
7. **Achievement pass v2** (§5.6) — finish once new payload keys are stable.
8. **Replays** (§5.8) — only if there's appetite for arcade-wide infra.

Game is in a good place. Keep the recap invariant, the world-frame motion, and the validation gates green, and v3 should be smooth.
