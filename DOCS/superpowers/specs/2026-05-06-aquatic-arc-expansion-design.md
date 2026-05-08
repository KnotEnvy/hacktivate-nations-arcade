# Aquatic Arc Expansion — Design Spec

**Date:** 2026-05-06
**Status:** Approved by user 2026-05-06. Implementation pending.
**Game:** Speed Racer (post-v7)
**Author:** Claude (collaboration with user)

---

## 1. Problem statement

The v7 Harbor Run section currently carries 7 enemy types (`ram, shooter, enforcer, armored, patrol, dropper, strafer`) inside a single 7,000-unit stretch. The v7 handoff already flagged this as a smell — at lap-scaled spawn intervals near the 0.6s floor, near-every spawn picks a different type, which reads as chaotic noise rather than a focused identity. The aquatic arc also has no narrative shape: it's "the water section" sandwiched between coast and ice.

This spec extends the aquatic stretch into three distinct sections so each gets a focused enemy mix, a signature feature, and its own visual identity. The arc grows the loop from 7 sections to 9.

## 2. Goals & non-goals

**Goals**
- Distribute the 7 enemy types so no aquatic section runs more than 4.
- Give each aquatic section one signature gameplay/visual feature, matching the §1–§7 pattern.
- Preserve the monotonic difficulty ramp invariant (§1 → §9).
- Reuse existing infra only — no new geometry classes, entities, systems, or palette primitives.

**Non-goals**
- New enemy types (we have 7; redistribution does the work).
- New scenery primitives (rocks, islands, etc.).
- Weather effects on aquatic sections (would compete with FROST PASS's snow signature).
- Per-section music or new SFX (still v7 §4.2 / §4.3 backlog).
- Touching the lap-scaling knobs (`spawn floor 0.6s`, `burst cap 0.6`, `formation cap 0.35` stay).

## 3. Section order

`SECTIONS` array (`data/sections.ts`) becomes:

```
1. NEON_HIGHWAY  (unchanged)
2. NEON_CITY     (unchanged)
3. STEEL_SPAN    (unchanged)
4. ALPINE_PASS   (unchanged)
5. SUNSET_COAST  (unchanged)
6. HARBOR_RUN    (rework — calmer, patrol-led intro)
7. OPEN_SEA      (NEW — strafer-led, time-of-day palette crossfade)
8. CHANNEL       (NEW — dropper-led, chokepoint geometry)
9. FROST_PASS    (unchanged content; index shifts §7 → §9)
```

## 4. Difficulty curve

Monotonic across §1 → §9 preserved.

| § | Section | spawnInterval | shooterBurstChance | formationChance | civilianChance | civilianSpawnInterval |
|---|---|---|---|---|---|---|
| 5 | SUNSET COAST | 1.15 | 0.28 | 0.18 | 0.60 | 2.0 |
| 6 | HARBOR RUN (rework) | 1.15 | 0.20 | 0.14 | 0.55 | 2.1 |
| 7 | OPEN SEA (new) | 1.05 | 0.30 | 0.20 | 0.50 | 2.2 |
| 8 | CHANNEL (new) | 0.98 | 0.36 | 0.25 | 0.55 | 2.0 |
| 9 | FROST PASS | 0.95 | 0.40 | 0.28 | 0.65 | 1.9 |

Burst/formation chances climb monotonically. Civilian density dips in OPEN SEA so the section reads as "out at sea, traffic thins out" then climbs back in CHANNEL/FROST.

## 5. Section definitions

### 5.1 §6 HARBOR RUN — rework

**Identity:** calm aquatic intro, patrol-led, working-harbor approach.

**Length:** `lengthMeters: 6000` (down from 7000 — section is shorter to compensate for the arc adding two new sections).

**Terrain:** `'water'` (unchanged).

**Enemy mix (3 types):**
```ts
enemyTypes: ['ram', 'shooter', 'patrol'],
enemyTypeWeights: [3, 2, 5],   // patrol headlines
enemyVisual: 'jetboat',
```

**Spawner config:**
```ts
spawnInterval: 1.15,
civilianChance: 0.55,
civilianSpawnInterval: 2.1,
vanIntervalMin: 16,
vanIntervalMax: 22,
shooterBurstChance: 0.20,
formationChance: 0.14,
```

**Signature feature:** `ShoulderedRoadGeometry(160, 640, 4, 50)` — 50px paved shoulders read as wooden boardwalks/floating pontoons. Tactical hop-out, sluggish on shoulder (existing v6 modifier handles this).

**Palette identity:** existing turquoise harbor palette retained as base. Add a `paletteOverrides` zone that crossfades to a working-harbor look in the back half:

```ts
paletteOverrides: [
  {
    startWorldY: 2200,
    endWorldY: 5800,
    fadeLength: 300,
    palette: {
      // Working harbor: concrete pier walls, sodium-amber lighting
      roadColor: '#0a3050',           // slightly deeper than base for "harbor channel"
      roadShadeColor: '#031a30',
      edgeColor: '#FFB840',           // sodium-amber pier glow
      edgeGlowColor: '#FFB840',
      laneLineColor: '#FFE9B0',
      sceneryColor: '#1f3a5a',
      sceneryAccent: '#FFB840',
      sceneryRimColor: '#3a5a7a',
      postColor: '#FFB840',
      postAccent: '#FFE9B0',
    },
  },
],
```

### 5.2 §7 OPEN SEA — new

**Identity:** strafer-led aquatic peak, dawn-to-day cinematic crossfade.

**Length:** `lengthMeters: 7000`.

**Terrain:** `'water'`.

**Enemy mix (4 types):**
```ts
enemyTypes: ['patrol', 'strafer', 'shooter', 'dropper'],
enemyTypeWeights: [3, 5, 2, 2],   // strafer headlines, dropper foreshadows §8
enemyVisual: 'jetboat',
```

**Spawner config:**
```ts
spawnInterval: 1.05,
civilianChance: 0.50,
civilianSpawnInterval: 2.2,
vanIntervalMin: 18,
vanIntervalMax: 24,
shooterBurstChance: 0.30,
formationChance: 0.20,
```

**Signature feature:** time-of-day palette crossfade. No `roadGeometry` (straight rectangle, full 480 width). Two stacked `paletteOverrides`:

```ts
paletteOverrides: [
  // Zone A — dawn (strong at entry, fades out toward midpoint)
  {
    startWorldY: 0,
    endWorldY: 3500,
    fadeLength: 600,
    palette: {
      // Coral/peach dawn: warm horizon, deep teal water, gold edges
      roadColor: '#0a4a6a',
      roadShadeColor: '#04283a',
      edgeColor: '#FFAA66',
      edgeGlowColor: '#FF8866',
      laneLineColor: '#FFE0B0',
      grassTop: '#4a1a2a',
      grassBottom: '#28284a',
      horizonColor: '#FF8866',
      sceneryColor: '#2a3a5a',
      sceneryAccent: '#FFAA66',
      sceneryRimColor: '#FF6666',
      postColor: '#FFAA66',
      postAccent: '#FFE0B0',
      bannerColor: '#FFAA66',
      bannerGlow: '#FF8866',
    },
  },
  // Zone B — high day (fades in past midpoint, full strength at exit)
  {
    startWorldY: 3500,
    endWorldY: 7000,
    fadeLength: 600,
    palette: {
      // Saturated cyan ocean, white-hot edges, near-white lane paint
      roadColor: '#0888B8',
      roadShadeColor: '#05607F',
      edgeColor: '#FFFFFF',
      edgeGlowColor: '#88FFFF',
      laneLineColor: '#FFFFFF',
      centerLineColor: '#FFE9B0',
      grassTop: '#0070A8',
      grassBottom: '#00B0E0',
      horizonColor: '#FFFFFF',
      sceneryColor: '#0a8ac8',
      sceneryAccent: '#FFFFFF',
      sceneryRimColor: '#88FFFF',
      postColor: '#FFFFFF',
      postAccent: '#88FFFF',
      bannerColor: '#88FFFF',
      bannerGlow: '#FFFFFF',
    },
  },
],
```

**Note:** `horizonAlpha` is intentionally NOT in the override because `PaletteOverrideZone` only handles string color fields (v7 invariant). Base palette `horizonAlpha` stays at the §6 value (0.30) — acceptable compromise; if playtest demands a brighter dawn glow we extend `PaletteColorField` consciously per the v7 gotcha.

**Base palette** for OPEN_SEA acts as the "midday transition" — what you see between the two zones. Set it to mid-tones so the crossfade reads as a gradient rather than a snap:

```ts
palette: {
  roadColor: '#0a6090',
  roadShadeColor: '#053048',
  edgeColor: '#88E0FF',
  edgeGlowColor: '#88E0FF',
  laneLineColor: '#FFFFFF',
  centerLineColor: '#FFE066',
  grassTop: '#003860',
  grassBottom: '#0070A0',
  horizonColor: '#FFCC88',
  horizonAlpha: 0.30,
  sceneryStyle: 'water',
  sceneryColor: '#0a6090',
  sceneryAccent: '#88FFFF',
  sceneryRimColor: '#1a80B0',
  postColor: '#FFFFFF',
  postAccent: '#88E0FF',
  bannerColor: '#88E0FF',
  bannerGlow: '#88FFFF',
},
```

### 5.3 §8 CHANNEL — new

**Identity:** aquatic finale, dropper showcase, industrial canal with chokepoints.

**Length:** `lengthMeters: 6000`.

**Terrain:** `'water'`.

**Enemy mix (4 types):**
```ts
enemyTypes: ['ram', 'enforcer', 'dropper', 'strafer'],
enemyTypeWeights: [2, 2, 5, 3],   // dropper headlines, enforcer for armor pressure
enemyVisual: 'jetboat',
```

**Spawner config:**
```ts
spawnInterval: 0.98,
civilianChance: 0.55,
civilianSpawnInterval: 2.0,
vanIntervalMin: 14,
vanIntervalMax: 20,
shooterBurstChance: 0.36,
formationChance: 0.25,
```

**Signature feature:** `WidthChangeGeometry` mirroring ALPINE PASS structure (two narrow lock segments). 4-lane wide → 2-lane lock → 4-lane pool → 2-lane lock → 4-lane exit:

```ts
roadGeometry: new WidthChangeGeometry([
  { worldY:    0, xMin: 160, xMax: 640, laneCount: 4 },
  { worldY: 1600, xMin: 160, xMax: 640, laneCount: 4 },
  { worldY: 1800, xMin: 240, xMax: 560, laneCount: 2 },
  { worldY: 2400, xMin: 240, xMax: 560, laneCount: 2 },
  { worldY: 2600, xMin: 160, xMax: 640, laneCount: 4 },
  { worldY: 3800, xMin: 160, xMax: 640, laneCount: 4 },
  { worldY: 4000, xMin: 240, xMax: 560, laneCount: 2 },
  { worldY: 4600, xMin: 240, xMax: 560, laneCount: 2 },
  { worldY: 4800, xMin: 160, xMax: 640, laneCount: 4 },
  { worldY: 6000, xMin: 160, xMax: 640, laneCount: 4 },
]),
```

The narrow stretches are 600 worldY long each — long enough for a dropper to release a depth charge that lands while the player is still in the 2-lane corridor. This is the gameplay payoff: depth charges in 4-lane water are dodgeable; in 2-lane water they're a real threat.

**Palette identity:** desaturated industrial canal — slate-blue water, concrete lock walls, warning-yellow edge glow.

```ts
palette: {
  roadColor: '#2a3a48',           // slate water
  roadShadeColor: '#162028',
  edgeColor: '#FFC840',            // warning amber
  edgeGlowColor: '#FFC840',
  laneLineColor: '#FFFFFF',
  centerLineColor: '#FFE066',
  grassTop: '#0a1418',             // dark dock slabs
  grassBottom: '#1a2830',
  horizonColor: '#FFC840',
  horizonAlpha: 0.22,
  sceneryStyle: 'water',
  sceneryColor: '#3a4a58',         // concrete lock walls
  sceneryAccent: '#FFC840',
  sceneryRimColor: '#5a6a78',
  postColor: '#FFC840',
  postAccent: '#FFFFFF',
  bannerColor: '#FFC840',
  bannerGlow: '#FFFFFF',
},
```

## 6. Boss bias updates (`BossSpawner.ts`)

Add two new entries; HARBOR_RUN tweaked:

```ts
'harbor-run': [0.55, 0.30, 0.15],  // (was [0.60, 0.30, 0.10] — slightly less chopper-heavy now that §6 is calmer overall)
'open-sea':   [0.70, 0.28, 0.02],  // chopper dominant, tank near-zero (no narrative read on open water)
'channel':    [0.40, 0.55, 0.05],  // drones rule the canyon-feel narrows; chopper plays less well in tight water
```

Tank weights drop near-zero on water for narrative reasons. Default weights `[chopper 0.45, drones 0.30, tank 0.25]` and other section overrides unchanged.

## 7. Subtitles & banner copy

- §6 HARBOR RUN — `subtitle: 'Working harbor · Patrol lanes'` (was `'Jet-boat lanes · Floaty handling'`)
- §7 OPEN SEA — `subtitle: 'Dawn to day · Open water'`
- §8 CHANNEL — `subtitle: 'Lock channels · Depth charges'`

## 8. File-level changes

```
src/games/speed-racer/data/sections.ts
  — Rework HARBOR_RUN (length, weights, paletteOverrides, subtitle, geometry)
  — Add OPEN_SEA SectionDef
  — Add CHANNEL SectionDef
  — Update SECTIONS export array order

src/games/speed-racer/systems/BossSpawner.ts
  — Tweak 'harbor-run' bias entry
  — Add 'open-sea' and 'channel' bias entries

src/games/speed-racer/SPEED-RACER-V7-HANDOFF.md
  — No edit during implementation. Will be replaced by SPEED-RACER-V8-HANDOFF.md
    when v8 ships per the per-handoff invariant.
```

No new files. No changes to entities, RoadProfile, RoadRenderer, EnemySpawner, EnemyCar, or PlayerCar.

## 9. v7 invariants this design respects

- ✅ `PaletteOverrideZone` used only for string color fields (`horizonAlpha` left on base palette).
- ✅ `resolvePalette` already called once per frame in `onRender` — no per-row addition.
- ✅ Difficulty pressure axes ramp monotonically §1 → §9.
- ✅ Section identity preserved: each aquatic section has one clear feature.
- ✅ No type checks added for shooting enemies — strafer's `bulletSpeed: 480` already drives dispatch.
- ✅ Drone swoop unchanged.
- ✅ Depth charge `justExploded` pattern unchanged.
- ✅ Enemy weights `[1, 0, 0]` style cumulative-subtraction picker handles weight-0 hard exclusion (only relevant if any aquatic section adopts that pattern; current weights are all positive).

## 10. Validation gates

```
npm run type-check   # no errors
npm run lint         # no warnings
npm test             # 145 tests pass (no test changes expected — pure data additions)
npm run build        # production build succeeds
```

If any test counts or assertions reference the section count or names of HARBOR_RUN's content, those tests need updating. Implementation plan should include a grep step for `HARBOR_RUN`, `'harbor-run'`, `SECTIONS.length`, and `7` in test files.

## 11. Risks and mitigations

1. **Lap-scaling stack-up.** A 9-section loop spreads spawn-tightening across more sections. By loop 5 the §1 spawn floor (0.6s) might land earlier than expected.
   - **Mitigation:** flag for §4.6 playtest. If problematic, lap scaling factor `0.9^wraparounds` can be eased to `0.92^wraparounds`. Knob is `applyLapScaling` in `SpeedRacerGame.ts`.

2. **§7 OPEN SEA could feel "empty"** with no road geometry feature.
   - **Mitigation:** if playtest flags it, bolt on a single wide-pulse `WidthChangeGeometry(480 → 560 → 480)` mid-section. ~10 lines.

3. **Three consecutive water sections may feel terrain-fatiguing.**
   - **Mitigation:** §6 has shoulders (semi-road tactical feel), §8 has chokepoints (geometry pressure). Visual differentiation via palette is strong. If playtest hates it, shorten §6 to 5000 so the arc paces faster.

4. **Two stacked palette zones in §7 with `fadeLength: 600` each are large** — fades cover most of the section length. If the lerp produces muddy midtones on high-saturation pairs (the v7 RGB-lerp gotcha), the dawn→day midpoint may look washed out.
   - **Mitigation:** the OPEN_SEA base palette is set to mid-tones explicitly, so the crossfade lands on intentional midpoint colors rather than passing through interpolated mush. If still muddy, upgrade `lerpHex` to OKLCH per the v7 gotcha.

5. **Boss-bias tank weight near-zero on water sections.**
   - **Mitigation:** tank still appears via global weight floor on default sections (§5, §9). Players don't go a full loop without seeing one.

## 12. What's intentionally deferred (YAGNI)

- New static water hazards (rocks, debris). Chokepoint geometry creates equivalent pressure.
- Weather effects on water sections. FROST_PASS owns the weather signature.
- Per-section music swap. Still v7 §4.2 backlog.
- New SFX for §6 harbor-approach palette crossfade or §8 lock walls. Still v7 §4.3 backlog.
- `horizonAlpha` time-of-day fade in §7. Requires extending `PaletteColorField`. If playtest demands it, do it consciously.
- HUD treatment for the time-of-day shift (sun angle indicator, etc.). Out of scope.

## 13. Open questions for playtest (post-implementation)

- Does §6 feel like a calm aquatic intro or just a less-dense version of v7's Harbor Run? Patrol weight may need to climb higher (5 → 6) if it doesn't read as patrol-led.
- Does §7's dawn → day transition register? If players don't notice, fadeLength may need to shrink so the change is more pronounced (less smooth, more cinematic).
- Does §8's chokepoint + dropper combo land as intended threat? If too brutal, dropper weight 5 → 4 or narrow stretch length 600 → 400.
- Does the boss bias shift feel right per section, or do players want more chopper-everywhere parity?
