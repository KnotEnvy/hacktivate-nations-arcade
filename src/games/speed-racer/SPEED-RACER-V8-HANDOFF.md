# Speed Racer — v8 → v9 Handoff

v8 shipped 2026-05-06. This is the **only** Speed Racer handoff doc — supersedes all prior versions, which have been removed per the per-handoff invariant. The previous coder is on this team and can answer questions about anything below.

**v8 was the production-polish pass.** The aquatic stretch, which v7 had crammed with 7 enemy types in one section, is now a three-section arc with focused identities. Per-section music wiring landed. Everything compiles, lints, tests pass, build succeeds, and the build looks right in playtest.

**v9 is playtest-driven tuning.** The unconditional backlog is closed; what's left is live-data tuning knobs (HP, rewards, bump physics, depth charges, drone lead, the new aquatic arc), an audio coordination pass, and the still-pending signed-in QA gate. See §4.

---

## 1. What v8 added

v8 had two streams: aquatic arc expansion (the meat) and per-section music wiring (infra surface, awaiting audio team content):

1. **Three-section aquatic arc** (replaces v7's single Harbor Run). Loop grew **7 → 9 sections**. The arc is HARBOR RUN → OPEN SEA → CHANNEL, each with a focused enemy mix (3–4 types instead of 7) and one signature feature:
   - **§6 HARBOR RUN** — calm aquatic intro, patrol-led. `[ram, shooter, patrol]` weights `[3, 2, 5]`. `ShoulderedRoadGeometry(160, 640, 4, 50)` for tactical hop-out boardwalks. `paletteOverrides` zone in the back half crossfades to a working-harbor concrete + sodium-amber look (reuses STEEL SPAN's pattern).
   - **§7 OPEN SEA** — strafer-led aquatic peak, dawn → day cinematic. `[patrol, strafer, shooter, dropper]` weights `[3, 5, 2, 2]`. No `roadGeometry`. **Two stacked `paletteOverrides`** — coral/peach dawn fading to saturated cyan high-day, 600-unit fades on each. Base palette is set to *intentional mid-tone colors* so the crossfade midpoint reads cleanly (sidesteps the v7 RGB-lerp gotcha).
   - **§8 CHANNEL** — dropper-led aquatic finale, industrial canal. `[ram, enforcer, dropper, strafer]` weights `[2, 2, 5, 3]`. `WidthChangeGeometry` mirrors ALPINE PASS pattern with two narrow lock segments (4-lane → 2-lane, 600 worldY long each) — depth charges in 4-lane water are dodgeable; in 2-lane water they're a real threat. That's the gameplay payoff for the arc.

   Difficulty pressure ramps monotonically across §6 → §8 (spawn 1.15 → 1.05 → 0.98, burst 0.20 → 0.30 → 0.36, formation 0.14 → 0.20 → 0.25), preserving the §1 → §9 invariant. FROST PASS shifts §7 → §9, content unchanged.

2. **Boss bias for the new aquatic sections** (`BossSpawner.ts`). HARBOR_RUN tweaked to `[0.55, 0.30, 0.15]`; OPEN_SEA `[0.70, 0.28, 0.02]` (chopper dominant, tank near-zero); CHANNEL `[0.40, 0.55, 0.05]` (drones rule the canyon-feel narrows).

3. **Per-section music wiring** (v7 §4.2 carryover, partially closed). `SectionDef` gains optional `musicTrack?: MusicName` typed-imported from `AudioManager`. `SpeedRacerGame.advanceSection` calls a new `applySectionMusic` helper that crossfades via `services.audio.playMusic(track, SECTION_MUSIC_FADE_SECONDS)` only when the section declares a track AND it differs from the last one we explicitly installed. Sections without `musicTrack` inherit (sticky inheritance), so we don't pay a crossfade per boundary. **Audio team work still pending** — see §4.2.
   - Track assignments installed for 5 narrative beats: ALPINE_PASS `epic_tension`, SUNSET_COAST `epic_heroic`, HARBOR_RUN `casual_chill`, CHANNEL `action_intense`, FROST_PASS `sports_competitive`. Other sections inherit. Hub still owns the initial track via `playGameMusic('speed-racer', 'primary')` on game launch.
   - `currentMusicTrack: string | null` field tracks our last explicit swap; resets in `onInit()` and `reset()` so a restart re-evaluates §1 from scratch.

All v5/v6/v7 invariants preserved (chassis HP funnel, world-frame motion, ram state machine, validation gates, `getBounds()` honesty, single-block player visual state, bump-knockoff loop, RoadProfile pipeline, fork same-segment guards, shoulders are player-only, PaletteOverrideZone semantics, `justExploded` single-frame pattern, `bulletSpeed`-keyed firing dispatch, drone swoop locked at swoop start).

No new entities. No new systems. No new infra primitives. v8 is content + a tiny music plumbing surface.

---

## 2. Per-section music — the new (small) plumbing

v8's only new bit of infra worth understanding before touching `data/sections.ts` or `SpeedRacerGame.advanceSection`.

### Shape

```ts
// In SectionDef:
musicTrack?: MusicName;  // imported from '@/services/AudioManager'

// In SpeedRacerGame:
const SECTION_MUSIC_FADE_SECONDS = 1.5;
private currentMusicTrack: string | null = null;
private applySectionMusic(section: SectionDef): void { ... }
```

### How it resolves

`applySectionMusic(section)` is called from three places: `onInit()`, `reset()`, and at the tail of `advanceSection()`. It bails when:
1. The section omits `musicTrack` (sticky inheritance — current track keeps playing).
2. The section's `musicTrack` equals `currentMusicTrack` (no-op, avoids redundant crossfades).

Otherwise it calls `services?.audio?.playMusic?.(track, SECTION_MUSIC_FADE_SECONDS)` and updates `currentMusicTrack`. The optional chain tolerates harnesses without an audio service (mocked tests, hub-less run modes).

### Why sticky inheritance matters

The 9-section loop only declares 5 explicit `musicTrack` values. The other 4 sections inherit from whatever's currently playing. This is a load-bearing design choice:

- §6 HARBOR_RUN sets `casual_chill`; §7 OPEN_SEA inherits it on purpose — the visual dawn → day crossfade carries the drama, the music doesn't fight it.
- §1 omits `musicTrack` so the hub-installed primary (`action_chase`) survives into the tutorial without us re-triggering it.

If you assign `musicTrack` to a section that previously inherited, you change the inheritance chain for everything downstream. Think it through; don't just copy-paste.

### Why the fade duration is 1.5s

`SECTION_MUSIC_FADE_SECONDS = 1.5` deliberately fits inside `SECTION_CLEAR_FLASH_DURATION = 1.8`. The fade completes during the visual section-clear flash, so the new track is audible by the time gameplay starts in the new section. If you change one, think about the other.

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
- **Difficulty pressure axes ramp monotonically §1 → §9.** New sections slot on the curve at their natural intensity, not flat.
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
- **(v8) The aquatic arc is three sections (§6 → §8), not one.** Each carries 3–4 enemy types max. Don't push more types in to "fill out" any of them — the focused identity is the design goal. If a new aquatic threat lands, find one of the three to slot it into and trim something else.
- **(v8) `OPEN_SEA.palette` is an intentional mid-tone "transition" palette**, NOT a default. It's what shows between the two stacked `paletteOverrides` zones. Touching it without re-thinking the dawn/day crossfade endpoints will produce muddy interpolation through the wrong midpoint. If you change one of the override zones, sanity-check the base.
- **(v8) `musicTrack` uses sticky inheritance.** Sections that omit it keep whatever's playing; sections that set it swap (with crossfade) only when different from current. Adding `musicTrack` to a previously-inheriting section changes the chain for everything downstream — chase the implications before committing.
- **(v8) `MusicName` is type-imported from `AudioManager`** in `data/sections.ts`. Unknown track names won't compile. If a future track is added to AudioManager's `ExtendedMusicName` union, it becomes immediately assignable in section definitions; if a track is renamed there, sections.ts breaks at compile time (this is the desired safety net).
- **(v8) `SECTION_MUSIC_FADE_SECONDS = 1.5` is calibrated against `SECTION_CLEAR_FLASH_DURATION = 1.8`.** The fade completes during the visual section-clear flash. If you change one, re-think the other.
- **(v8) Loop is 9 sections.** `SECTIONS.length` is referenced dynamically everywhere in `SpeedRacerGame.ts` (modulo, total display) — don't hardcode 7 or 9. If you add a 10th section, no other code change is needed.

---

## 4. v9 backlog — playtest-driven tuning

The v8 build plays through cleanly. What's left is calibration against real player data, audio team coordination, and the still-pending production blocker.

### 4.1 — Manual signed-in QA pass (HIGH PRIORITY, still blocking production)

Carryover from v7. The signed-in flow has been deferred since v1. Before production, walk a real account through:
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account, ordered correctly.
- Challenge progress advances on each metric: distance, top speed, max combo, powerups used.
- Achievements unlock at the right thresholds.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

Half-day of focused testing. Block production until done.

### 4.2 — Audio team coordination on the new music wiring

v8 wired the API surface. Per-section track swaps now work, but the actual music coordination still needs the audio team:
- Are the chosen track assignments (`epic_tension`, `epic_heroic`, `casual_chill`, `action_intense`, `sports_competitive`) the right vibe for each section, or do they want bespoke tracks?
- `AudioManager.playMusic` currently does stop-then-start with a small gap, not a true crossfade. If transitions feel jarring, upgrade to a real crossfade (either inside `playMusic` or as a dedicated `crossfadeTo(name, duration)` method).
- `SECTION_MUSIC_FADE_SECONDS = 1.5` is a guess. If their layered patches need longer/shorter, retune. Keep it ≤ `SECTION_CLEAR_FLASH_DURATION` so the swap finishes during the visual flash.
- Consider adding `musicTrack` to currently-inheriting sections (§1, §2, §3, §7) if the audio team wants finer-grained beats.

Knob: `musicTrack` on each `SectionDef` in `data/sections.ts`; `SECTION_MUSIC_FADE_SECONDS` in `SpeedRacerGame.ts`.

### 4.3 — Sound design pass for v6/v7/v8 mechanics

Carryover from v7, plus new v8 surfaces. New mechanics still piggyback generic `'explosion'` / `'hit'` / `'powerUp'` SFX:
- **(v7)** Depth charges — water-plop on drop, blinking-warning beep, deeper sub-bass on detonation (distinct from chopper bombs which are airborne).
- **(v7)** Bridge transition — ambient swap when entering/leaving the STEEL SPAN bridge zone (steel-cable wind, water below).
- **(v7)** Tunnel — reverb tail + muffled high-end while inside `tunnelZones`.
- **(v7)** Drone swoop — rising whine that telegraphs swoop commit (currently silent except hit SFX).
- **(v7)** Strafer bursts — distinct firing SFX vs static shooters (faster cadence, lighter timbre).
- **(v8)** §6 HARBOR_RUN harbor-approach palette zone — ambient swap when crossing the worldY 2200–5800 zone (working harbor, distant cranes, sodium hum).
- **(v8)** §7 OPEN_SEA dawn → day shift — optional ambient layer (gulls, distant wind) that swells through the crossfade.
- **(v8)** §8 CHANNEL lock walls — concrete reverb / metallic clang ambience while inside the narrow lock segments.

Most of these are 1-line `services.audio.playSound` or per-section ambient calls once the SFX exist. Coordinate with audio team.

### 4.4 — HP cap per section (playtest-gated)

`MAX_HP = 3` globally. v8 playtest looked good, but if the now-longer 9-section loop makes late sections feel trivial with full HP, gate via per-section HP cap on `SectionDef`. Pre-existing knob — no v8 change. Watch §7 OPEN_SEA + §8 CHANNEL specifically since they're the new high-pressure beats.

### 4.5 — Section-clear reward inflation cap (playtest-gated)

`base + combo × lives × 250` scales fast at high lives counts, and there are now 9 section-clears per loop instead of 7 — leaderboards may inflate faster. Cap at `max(lives, 3)` or similar if scores balloon. Only act if leaderboards look absurd.

### 4.6 — Bump-mechanic playtest tuning (playtest-gated)

Carryover. v5 shipped the knockoff loop; v6/v7/v8 didn't touch the core knobs. v7 added two bumpable types (`dropper` 1.2, `strafer` 1.0) — both are now spread across §6, §7, §8 in v8. Watch:
- Soft cars (ram/shooter/patrol/strafer at 1.0) too easy?
- Dropper (1.2) feel right — slightly stickier than ram but still bumpable?
- Enforcer (2.5) trivial vs impossible?
- SWAT (6.0) bumpable at boost?
- §8 CHANNEL chokepoints — bump physics vs narrow walls feel right, or do enemies pinball off the lock walls?

Knobs in `SpeedRacerGame.ts` (`BUMP_FORCE_MIN/MAX`, `BUMP_OFF_ROAD_MARGIN`) and `EnemyCar.ts` (`BUMP_FRICTION`, `BUMP_AI_SUPPRESS`, per-type `bumpResistance`).

### 4.7 — Aquatic arc tuning (post-launch playtest, v8-specific)

Replaces v7 §4.7. The three new aquatic sections each have specific watch-fors:

**§6 HARBOR RUN** — does it read as a calm patrol-led intro or just thinner v7 Harbor? If too thin, patrol weight 5 → 6 or add modest dropper presence (weight 1).

**§7 OPEN SEA** — does the dawn → day palette crossfade register? If players don't notice, fadeLength 600 → 400 (sharper transition) or extend `PaletteColorField` to include `horizonAlpha` so the horizon glow strength can fade too. If players DO notice but find it too cinematic / too long, the section length 7000 itself could shrink to 6000.

**§8 CHANNEL** — depth charges in 2-lane lock segments are the gameplay payoff. If too brutal, dropper weight 5 → 4 OR narrow stretch length 600 → 400. If trivial because depth charges always detonate before the player reaches them in narrow water, drop dropper drift speed 50 → 70 px/sec or tighten the drop window.

**Three-water-sections fatigue** — does the visual differentiation hold up, or does water start to blur after §6? Mitigation: shorten §6 to 5000 worldY so the arc paces faster.

Knobs: weights in each section's `spawnerConfig` in `data/sections.ts`; `DEFAULT_FUSE` and `EXPLOSION_RADIUS` in `entities/DepthCharge.ts`; drop window in `EnemySpawner.updateDropper`; per-section `lengthMeters`.

### 4.8 — Drone prediction lead tuning (post-launch playtest)

Carryover from v7. Cap is `DRONE_MAX_LEAD = 120`. With v8's CHANNEL chokepoints, drones may get even more punishing — the §8 boss bias is drone-heavy (0.55) and drones thrive in narrow water. If drones feel undodgeable in §8 specifically, drop `DRONE_MAX_LEAD` to 80–100; if they feel too dumb in §7's open water, raise to 140–160.

Knob: `DRONE_MAX_LEAD` in `entities/BossEnemies.ts`.

### 4.9 — Performance pass (now more relevant)

60fps on mid-tier hardware needs verification. The loop grew 7 → 9 sections, so a full-loop playtest now exercises ~28% more content per cycle. Specific high-density frames:
- §4 ALPINE_PASS taper (slow-path road geometry).
- §5 SUNSET_COAST fork (slow-path road geometry).
- §6/§7/§8 aquatic arc combined with bosses — at lap-scaled spawn floors plus 4 enemy types plus possibly several depth charges + projectiles + boats on screen.
- §8 CHANNEL chokepoints during a chopper boss — narrow geometry + bombs + multiple boats stacked.

Quick wins if it dips:
- Cap `depthCharges.length` to ~8.
- Object-pool projectiles + depth charges (currently allocated per-spawn).
- Profile slow-path road body — already run-accumulated but the per-row shape query could be memoized for stable stretches.

### 4.10 — Lap-scaling stack-up (v8-specific monitoring)

A 9-section loop means each loop wraparound spreads spawn-tightening across more sections. By loop 5+, the §1 spawn floor (0.6s) might land earlier than expected. Easy adjustment if it shows up: lap scaling factor `0.9^wraparounds` → `0.92^wraparounds` in `applyLapScaling`. No code complexity, just a knob change.

### 4.11 — Bigger-than-an-incremental ideas (v10+ territory)

Carryover from v7:
- **Replays / ghosts.** `dt`-keyed input serialization. Wait for arcade-wide replay infra.
- **Landscape orientation lock** on mobile. Nothing currently enforces it.
- **Pixel-sprite migration.** `assetBudgetKB = 130` on the manifest is the current limit. v3-v8 stayed all-canvas. If a v9+ art lead wants to migrate, raise the budget first.

New v8-suggested:
- **Dynamic time-of-day** across the whole loop, not just §7. Could be a per-loop offset that rotates the dawn/day/dusk palette across all sections each wraparound. Cheap once `horizonAlpha` is in `PaletteColorField`. Only worth building if the §7 reception is strong.
- **Aquatic boss variant.** Tank doesn't fit on water (current weight near-zero on §7/§8). A water-themed boss (gunboat? submarine surface attack?) would round out the boss roster for the aquatic arc. Significant scope — new entity, new AI.

---

## 5. Tuning knobs (the cheat sheet)

```
SpeedRacerGame.ts (top constants):
  COMBO_DECAY_TIME            = 4.0s        MAX_COMBO_MULTIPLIER  = 5
  CIVILIANS_LOST_GAME_OVER    = 3           STARTING_LIVES        = 1
  MAX_LIVES                   = 5           LIFE_BONUS_SCORES     = [2500, 10000, 25000, 50000, 100000]
  RESPAWN_INVULN_DURATION     = 2.0s        MAX_HP                = 3
  HIT_INVULN_DURATION         = 1.1s        HIT_FLASH_DURATION    = 0.5s

  Bump (v5):
    BUMP_FORCE_MIN            = 80          BUMP_FORCE_MAX        = 520
    BUMP_OFF_ROAD_MARGIN      = 30          Player recoil         = 50 + bumpResistance * 30

  Section-clear reward:
    SECTION_CLEAR_BONUS_BASE             = 500
    SECTION_CLEAR_BONUS_PER_COMBO_LIFE   = 250
    SECTION_CLEAR_FLASH_DURATION         = 1.8s

  Music (v8):
    SECTION_MUSIC_FADE_SECONDS = 1.5s   (fits inside SECTION_CLEAR_FLASH_DURATION on purpose)

  Lap scaling (private):
    spawn floor 0.6s          burst cap 0.6           formation cap 0.35
    spawn × 0.9^wraparounds   burst +0.08 per loop    formation +0.05 per loop

EnemyCar.ts:
  BUMP_FRICTION    = 240   BUMP_AI_SUPPRESS = 30   BUMP_COOLDOWN = 0.12
  RAM_LOCK_TRIGGER = 300   RAM_LOCK_DURATION = 0.4 RAM_CHARGE_LATERAL = 320
  APPROACH_RANGE   = 280   FORWARD_SPEED_ACCEL = 280

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
  DEFAULT_FUSE          = 1.4s          EXPLOSION_RADIUS = 56px
  EXPLOSION_LIFETIME    = 0.4s          Blink rate ramps 5 → 23 Hz over fuse

BossEnemies.ts:
  Drone:
    DRONE_HOVER_SPEED   = 160           DRONE_SWOOP_SPEED  = 520
    DRONE_RETREAT_SPEED = 260           DRONE_MAX_LEAD     = 120 (v7)

BossSpawner.ts (per section bias [chopper, drones, tank]):
  FIRST_BOSS_DELAY  = 14s after sectionsCleared >= 1
  COOLDOWN          = 38..58s between bosses
  Default weights   = [0.45, 0.30, 0.25]
  Per section:
    'harbor-run' [0.55, 0.30, 0.15]   // (v8) was [0.60, 0.30, 0.10] in v7
    'open-sea'   [0.70, 0.28, 0.02]   // (v8) chopper-dominant; tank near-zero on water
    'channel'    [0.40, 0.55, 0.05]   // (v8) drones rule the canyon-feel narrows
    'alpine-pass' [0.25, 0.20, 0.55]
    'steel-span'  [0.45, 0.30, 0.25]

Section spawn pacing (final v8 curve, monotonic §1 → §9):
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

## 6. Validation gates

```bash
npm run type-check     # no errors
npm run lint           # no warnings
npm test               # 10 jest unit tests pass as of v8 ship (suite scope is repo-wide, not per-game)
npm run build          # production build succeeds
```

Manual signed-in QA checklist (still pending — see §4.1):
- Wallet credit from `coinsEarned` lands on the arcade hub.
- Leaderboard write appears for the account.
- Challenge progress advances on a relevant metric.
- Analytics `trackGameEnd` fires with the correct `ownerId`.
- Sign-out / sign-in resets state cleanly.

---

## 7. v8-specific gotchas worth knowing

- **`SECTIONS.length` is 9 now, not 7.** All references in `SpeedRacerGame.ts` are dynamic — `(sectionIndex + 1) % SECTIONS.length` for advance, `SECTIONS.length` for HUD totals. If you add a 10th, no other change is needed.
- **`OPEN_SEA.palette` is a midpoint, not a default.** Both stacked overrides have `fadeLength: 600` so the section is mostly mid-crossfade. The base palette colors are intentionally chosen mid-tones between the dawn override and the day override. Touching the base without retuning the override endpoints will produce muddy interpolation through the wrong midpoint.
- **`OPEN_SEA` has no `roadGeometry`** — it's the only aquatic section that's a straight rectangle. The "feature" is purely the time-of-day palette. If playtest demands road shape too, bolt on a single wide-pulse `WidthChangeGeometry(480 → 560 → 480)` mid-section.
- **`CHANNEL` chokepoints are 600 worldY long.** Calibrated against `DEFAULT_FUSE = 1.4s` and dropper drop window — long enough that a charge dropped at the entrance detonates while the player is still in the corridor. If you change `DEFAULT_FUSE`, re-think the chokepoint length too.
- **`musicTrack` only triggers a swap when DIFFERENT from `currentMusicTrack`.** First-pass equality on the string. If you add the same track to consecutive sections, the second one is a no-op (correct behavior). If you want forced re-trigger, you'd need a different mechanism.
- **`currentMusicTrack` resets to null on `onInit` AND `reset`.** Restart re-evaluates §1's track from scratch. Since §1 omits `musicTrack`, no swap fires on restart by default — the hub-installed primary keeps playing. If you assign `musicTrack` to §1, restart will trigger a swap to it.
- **`MusicName` import in `data/sections.ts`** is a typed coupling to AudioManager. If a track is renamed in `ExtendedMusicName`, sections.ts breaks at compile time (intended safety net).
- **HARBOR_RUN has only 3 enemy types now (was 7).** If you're inheriting v7 mental models, adjust — patrol is the headliner here, dropper and strafer live in §7 and §8.
- **Per-handoff invariant docs were removed** (this is the only one). Earlier prose was consolidated into this doc as v8 shipped.

---

## 8. File map

```
src/games/speed-racer/
├── SpeedRacerGame.ts              # game loop, damage funnel, collision resolution,
│                                  #   recap, applyRoadProfile, off-road bump-kill scan,
│                                  #   resolvePalette per-frame call (v7),
│                                  #   applySectionMusic + currentMusicTrack (v8)
├── SPEED-RACER-V8-HANDOFF.md      # this doc
├── index.ts
├── data/
│   ├── constants.ts               # PLAYER + legacy ROAD constants (only StraightRoadGeometry uses ROAD)
│   ├── secondaryWeapons.ts
│   └── sections.ts                # SectionDef, SectionPalette, TunnelZone,
│                                  #   PaletteOverrideZone (v7), resolvePalette (v7),
│                                  #   musicTrack on SectionDef + 5 explicit assignments (v8),
│                                  #   all 9 sections (v8)
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
    ├── BossSpawner.ts             # threads playerVx through (v7),
    │                              #   open-sea + channel bias entries (v8)
    ├── TerrainHazards.ts
    ├── Weather.ts
    ├── TouchControls.ts
    ├── Particles.ts
    └── CameraShake.ts
```

---

## 9. Section identity at a glance

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

Every section now has at least one signature feature. The aquatic arc (§6 → §8) is the v8 work. §1, §2, §9 still ride a single feature each — production polish priority is over more features, but if a future team has a clear gameplay reason, those are the natural targets.
