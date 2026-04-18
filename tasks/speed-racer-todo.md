# Speed Racer — Build Plan

Started: 2026-04-17
Game ID: `speed-racer`
Catalog: Tier 2, keyboard-only, 130 KB asset budget

## Concept

Spy Hunter-inspired top-down vertical-scrolling vehicular combat. Player drives an armed spy car down a highway with a forward-firing machine gun. Enemy vehicles actively try to kill you; civilians drive normally (and you pay a score penalty for hitting/shooting them). Periodically a Weapon Van appears — drive into its trailer to load a limited-use secondary weapon (oil slick, smoke screen, missile). Progressive difficulty. Single life, arcade-style.

V1 ships with a single endless section, scaffolded so multi-section support can drop in cleanly later. Bomb Chopper enemy deferred post-launch.

## File layout

```
src/games/speed-racer/
├── SpeedRacerGame.ts       # BaseGame subclass, orchestrator
├── index.ts
├── entities/
│   ├── PlayerCar.ts
│   ├── EnemyCar.ts         # Ram, Shooter, Armored variants
│   ├── Civilian.ts
│   ├── WeaponVan.ts
│   ├── Projectile.ts
│   ├── Hazard.ts           # oil slick, smoke cloud
│   └── Particle.ts
├── systems/
│   ├── RoadRenderer.ts
│   ├── EnemySpawner.ts
│   ├── WeaponSystem.ts
│   ├── WeaponVanSystem.ts
│   ├── CivilianSystem.ts
│   ├── InputController.ts
│   └── EffectsSystem.ts
└── data/
    ├── constants.ts
    └── sections.ts         # one section in v1, structure ready for more
```

## Controls (keyboard-only)

- `A/D` or `←/→` — free horizontal steering
- `W/↑` — accelerate
- `S/↓` — brake
- `Space` — machine gun (hold to autofire)
- `Shift` or `F` — fire secondary weapon
- `Q/E` — cycle held secondary weapons

## Enemy roster (v1)

- Ram Car — sideswipes, fast, fragile, machine-gun killable
- Shooter — trails and shoots back, medium HP
- Armored Limo — bulletproof to gun, must be missiled or rammed off road

Civilians — score penalty + multiplier reset when hit.

## End-of-game payload (extendedGameData)

- `distance` (m) — challenge metric
- `speed` (max reached) — challenge metric
- `combo` (max) — challenge metric
- `powerups_used` (secondary fires) — challenge metric
- `enemies_destroyed` — analytics
- `civilians_lost` — analytics
- `van_pickups` — analytics
- `sections_cleared` — analytics

Base payload (auto): `score`, `pickups`, `timePlayedMs`, `coinsEarned`.

## Phases

### Phase 1 — Scaffolding ✅
- [x] Create folder structure under `src/games/speed-racer/`
- [x] Stub `SpeedRacerGame.ts` extending BaseGame with placeholder render
- [x] `index.ts` barrel export
- [x] Register in `src/games/registry.ts`
- [x] Update `src/data/Games.ts` thumbnail path + description
- [x] Placeholder SVG at `public/games/speed-racer/speed-racer-thumb.svg`
- [x] Verify `npm run type-check` and `npm run lint` pass
- [ ] Manually verify tier-2 unlock and launch flow in arcade (user-side smoke test)

### Phase 2 — Driving core ✅
- [x] `PlayerCar` with free horizontal steering, accel/brake feel
- [x] `InputController` — used shared `services.input` (InputManager) directly; custom wrapper deferred to Phase 3 if edge detection needed
- [x] `RoadRenderer` with scrolling road, lane dividers, dashed center, edge glow, parallax distant trees, roadside posts
- [x] Constant baseline speed, no traffic yet
- [x] HUD shows live SPEED + DIST
- [x] Extended payload populated with placeholder zeros for future metrics
- [ ] Manual smoke: confirm steering + accel/brake feel right

### Phase 3 — Machine gun + Ram enemy ✅
- [x] `WeaponSystem` autofire machine gun with cooldown
- [x] `Projectile` entity
- [x] Ram enemy AI (lateral approach + sideswipe)
- [x] AABB collision, hit/kill resolution
- [x] Distance-based scoring + per-kill bonus

### Phase 4 — Enemy variety + civilians ✅
- [x] Shooter enemy (trails, fires back)
- [x] Armored Limo (bulletproof)
- [x] Enemy projectiles
- [x] Civilian entities (no attack, friendly-fire penalty)
- [x] Multiplier mechanic (grows per kill, resets on civilian hit)

### Phase 5 — Weapon Van + secondary weapons ✅
- [x] WeaponVan spawns periodically (18–28s)
- [x] Rear load-zone pickup hitbox
- [x] Secondary weapons: oil slick, smoke screen, missile (distinct effects, ammo, cooldowns)
- [x] Q to fire secondary; HUD shows label + ammo

### Phase 6 — Polish + juice ✅
- [x] Particles (explosions, sparks, muzzle flash, pickups, hits)
- [x] Camera shake on big events
- [x] Side motion lines scaling with player speed
- [x] HUD: speed, distance, kills, combo meter w/ decay bar, civilian counter, secondary weapon
- [x] Audio hooks (shoot/explosion/hit/powerUp/collision/laser/whoosh) via `services.audio.playSound`

### Phase 7 — Theme, thumbnail, validation ✅
- [x] Add `speed-racer` to `src/lib/gameThemes.ts` (synthwave palette, primary `#FF0080`)
- [x] 512×512 SVG thumbnail (synthwave road, player car, enemy)
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (clean)
- [x] `npm test` passes (119/119)
- [x] `npm run build` passes
- [ ] Manual signed-in QA: wallet credit, leaderboard write, achievements, challenges, analytics ownership, sign-out/sign-in reset (deferred to user)
- [ ] Confirm extended payload drives challenge engine correctly (deferred to user)

## Out of scope for v1

- Boat/water transformation
- Ice/weather sections
- Bomb Chopper enemy
- Bonus-threshold extra lives
- Touch controls (manifest is keyboard-only)
- Bespoke `speed-racer_*` daily challenge templates

## Review notes

### 2026-04-17 — All phases complete
- Phase 3 fix: removed unused `_playerY` param from `EnemyCar.updateArmoredAI`; lint rule does not honor underscore prefix.
- Phase 7 fix: changed speed-racer theme primary from `#FF1493` (already taken by puzzle) to `#FF0080` to satisfy `gameThemes.test.ts` "no duplicate primary colors" rule.
- All gates green: lint clean, type-check clean, 119/119 tests pass, production build succeeds.
- Game ready for manual QA. Next step is user playtest + signed-in flow verification (wallet credit, leaderboard write, achievements, challenges).
