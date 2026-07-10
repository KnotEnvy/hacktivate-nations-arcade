# Dungeon Crawl v4 — Wave A.1 (The Roster) + Wave B (The Town)

## Context

Wave A playtested perfectly. User direction: keep the class-select every run — a
ROSTER of four persistent heroes (one per class), each leveling independently,
instead of one locked-in character. Then Wave B: the safe-zone town.

## Wave A.1 — The Roster

- [ ] 1. CharacterStore v2: `{ version: 2, characters: Partial<Record<ClassId,
       SavedHero>> }`, per-hero stats; **v1 → v2 migration** (the user's playtested
       hero lands in its class slot); invalid heroes dropped individually; load()
       always returns a payload (empty roster on missing/corrupt).
- [ ] 2. ProgressionController roster API: heroFor(classId), selectHero(classId)
       (sets active + expeditions++), create(classId, rng); all XP/boon/pressure
       ops act on the ACTIVE hero; retire() clears the active class slot only.
- [ ] 3. Game: startRun ALWAYS shows the roster select ("CHOOSE YOUR HERO");
       confirm resumes that class's hero (welcome banner) or forges a new one;
       hold-R retire affects only the fallen hero's slot.
- [ ] 4. HudRenderer: roster line on each class card ("SIR ROWAN · LV 3" or
       "UNPROVEN"); per-hero level shown before the pick.
- [ ] 5. Tests: migration test; roster independence (level thief, fighter still
       L1); restart returns to roster (heroes kept); classes.test/progression.test
       updated; gates.

## Wave B — The Town of LASTLIGHT

Core loop: roster pick → arrive in TOWN (hand-built map, walkable, uses the
existing TileMap/renderers) → quest board (E) picks an expedition → gate departs →
seeded roguelite run as today → final-floor boss → stairs = **VICTORY** → gold
banked (+ quest rewards) → back to town in the same session. Death still ends the
arcade session (hero endures; carried gold is lost — banked gold is safe).

- [ ] 1. Data: `data/quests.ts` (4 authored quests: floors, biome, boss tier,
       minLevel, gold+XP rewards + ENDLESS DEPTHS entry) + `data/gear.ts`
       (blacksmith tracks: Blade/Armor/Boots/Quiver, 3 tiers each, banked-gold
       prices). Save additive fields per hero: gold, gear, provisions.
- [ ] 2. Generator: optional `opts { forceBoss?, biomeId? }` threaded through
       pickWeighted/placeHazards/isBossFloor — omitted = today's behavior
       (determinism tests untouched).
- [ ] 3. Player: gear folds (damage/hp/speed/daggers) + provisions applied at
       expedition start.
- [ ] 4. `town/TownController.ts`: builds the town map (Inn, blacksmith stall,
       alchemist stall, quest board, gate), owns town movement/interactions +
       overlay state (quest board / smith / alchemist), purchases from banked
       gold. HudRenderer gains renderQuestBoard/renderSmith/renderAlchemist/
       renderVictory; TileRenderer reuses merchant sprite for vendors + a board
       sprite.
- [ ] 5. Game wiring: states 'town' + 'victory'; expedition start (fresh seed,
       quest shape, provisions); victory flow (bank goldBalance + rewards,
       victories++, return to town); recap-row assembly moved to HudRenderer
       (line-budget valve); metrics quests_completed + gold_banked.
- [ ] 6. Wiring: GameEndData +2 keys, 3 achievements (First Contract / banked-gold
       / two-quests-in-a-session), characterization update (town-first init still
       satisfies the metric contract; monkey runs the town safely).
- [ ] 7. New town.test.ts (quest/gear contracts, town map reachability, banking
       flow) + full gates.

## Invariants

Rewards ride trusted metrics; banked gold is game-internal (arcade pickups/coins
untouched); generator stays pure (quest shape is a deterministic param); death
recap → endGame unchanged; every file under 1500 (TownController extraction is
mandatory); existing SoundName palette only.

## Review (2026-07-08)

**Both waves shipped.** type-check ✅ · lint ✅ (zero new warnings; DungeonCrawlGame
went OVER the guardrail mid-wave and was brought back under by extracting the boss
director + scroll effects into systems/Combat.ts and consolidating draft nav) ·
dungeon-crawl suites 95/95 (7 suites; +town.test.ts with 10 tests) · full dev suite
418/418 · release suite 10/10.

**Wave A.1 (Roster):** every run opens on CHOOSE YOUR HERO; each class card shows
its persistent hero ("SIR ROWAN · LV 3" / "UNPROVEN"); v1 saves migrate into their
class slot (the user's playtested fighter survives); retire clears only the fallen
hero's slot. Save format is now v2 (roster).

**Wave B (Lastlight):** session flow = roster pick → the town of LASTLIGHT (warm
hand-built map: Inn, quest board, blacksmith, alchemist, depths gate) → quest
departure (fresh seed; quest pins biome; boss ONLY on the final floor) → VICTORY
banks carried gold + rewards into the hero's treasury → back to town, same session.
Death still ends the arcade session (hero endures; carried gold lost). Blacksmith
sells 4 permanent gear tracks × 3 tiers from banked gold; alchemist packs
one-expedition provisions (scroll/daggers/wider torch) consumed at the gate.
Endless Depths remains on the board (classic rules, glory only).

**Conscious changes:** boss AI/touch damage + castScroll effects moved into Combat
(CombatHost += addProjectile/revealMap); tests that pressed Q/F right after the
class pick now depart through the gate first.

**Awaiting user playtest:** town feel + readability, quest pacing (3/4/5/6 floors),
gear prices vs quest gold rewards, provision value, Ashen Court tier-4 boss
difficulty, victory→level-up→town flow.

**Next (Wave C):** Sagas & Stories — authored multi-quest arcs with interludes,
secret cracked-wall rooms (player-sourced booms reveal them) feeding miniquests.
