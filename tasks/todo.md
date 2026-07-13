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

---

# Dungeon Crawl v4 — Wave C: Sagas & Stories + Secret Rooms

## Context (2026-07-10)

Waves A.1 + B playtested clean. Owner decisions for Wave C: TWO sagas (3-chapter
early-game + 4-chapter late-game epic, each with its own NEW unique finale boss
kit) and miniquests are COMMITTED (not stretch). Flavor mined by eye from the
local AD&D library (Dungeon Builder's Guidebook, Book of Lairs, Complete Book of
Villains/Necromancers) — all in-game text ORIGINAL, generic archetypes, module
TONE not text, interludes < 60 words each.

## Steps

- [ ] 1. Saga data layer: `data/sagas.ts` (SagaId/SagaDef/SAGAS/ALL_SAGA_IDS,
       2 sagas + interlude prose, helpers), 7 chapter quests in `data/quests.ts`
       (+ `saga` flag + STANDALONE_QUEST_IDS for the classic board page), 2 unique
       finale kits + `bossKitById` in `data/bosses.ts` (rotation array untouched —
       uniques live beside it), `bossKitId` override threaded through Boss ctor +
       `loadFloor`. Conscious town.test quest-contract update (5 standalone +
       saga-flagged extras).
- [ ] 2. Persistence: additive `SavedHero.sagas: Partial<Record<SagaId, number>>`
       (chapters completed; NO version bump — gold/gear precedent), sanitizeHero
       clamp via ALL_SAGA_IDS, ProgressionController saga accessors + advance;
       progression.test factory + clamp tests.
- [ ] 3. Board saga page: TownController Up/Down page toggle on the 'quests'
       overlay, chapter gating (N+1 unlocks when N complete for THIS hero),
       depart on current chapter; HudRenderer.renderSagaBoard.
- [ ] 4. Victory hook + interludes: openVictory advances sagaProgress (current
       chapter only — replays never re-advance; finale => sagasCompleted++);
       new 'interlude' GameState (victory -> interlude -> level-up draft -> town)
       + HudRenderer.renderInterlude (dim + title + wrapped prose + PRESS SPACE,
       OVERLAY lockout const).
- [ ] 5. CrackedWall tile: Tile.CrackedWall = 7, one line in TileMap.isSolidTile
       (collision/LOS/BFS inherit), TileRenderer case (wall + hairline cracks);
       minimap needs NO change (solid => plain wall color).
- [ ] 6. Generator secret rooms + nests: carve 0-2 small rooms off the graph
       after wrapWithWalls (kind 'secret', re-wrap, seal doorway as CrackedWall),
       skip guards in spawnEnemies/placeHazards/placeUrns/placeTorches, stock
       generously (gold x3-5, 1-2 urns, shrine OR scroll) into plan.pickups/urns,
       nest pre-roll into new FloorPlan.secrets (spawns from floor/biome-gated
       tables; game constructs enemies at trigger => level pressure stays out of
       dungeon/). Extend DungeonGenerator.test: 0-2 per floor, sealed-BFS, stock
       on Floor, nest gating, determinism incl. new field.
- [ ] 7. Reveal wiring: CombatHost.crackWall(tx,ty) + player-source boom tile
       scan in Combat (enemy booms NEVER crack); game host binding = map.set
       Floor + particle burst + shake (openConnectedLockedDoors pattern).
- [ ] 8. systems/SecretRooms.ts (~120 lines): per-floor init from plan, reveal
       tracking (secrets_found on first reveal), nest trigger on entry (banner +
       pack spawn via host callbacks), clear detection (banner + rewardGold to
       goldBalance + nests_cleared).
- [ ] 9. Metrics + achievements: sagas_completed / secrets_found / nests_cleared
       in ALL FOUR places same commit (syncExtendedData + ArcadeHub GameEndData +
       achievement requirement.type + characterization 31->34 key contract);
       4 achievements (saga x1, both sagas, first secret, first nest). New
       __tests__/sagas.test.ts + __tests__/secrets.test.ts.
- [ ] 10. Gates + bookkeeping: type-check, lint (1500-line guardrail — valve is
       victory/recap row assembly -> HudRenderer if orchestrator crosses), full
       dev suite, 10-test release suite; refresh Crawler_handoff.json
       (versionHistory, metrics, test counts, awaitingPlaytest; must parse) +
       this file's review section.

## Wave C Invariants

Generator pure in (seed, floor, opts); secret rooms never on the critical path
(stairs/key BFS invariants pinned); player-sourced booms never hurt the player
and are the ONLY thing that cracks walls; rewards ride trusted session metrics;
existing SoundName palette only; every file under 1500 logical lines; dev tests
per step: `npm.cmd run test:dev -- --runInBand --testPathPatterns dungeon-crawl`.

## Wave C Review (2026-07-11)

**Wave C shipped.** type-check ✅ · lint ✅ (DungeonCrawlGame crossed the guardrail
mid-wave and was brought back under by moving view assembly to its owners:
recap/victory rows + shop-item naming + slim HudState into HudRenderer, town
overlay routing into TownController.renderOverlay, projectile drawing into
TileRenderer) · dungeon-crawl suites 105/105 (9 suites; +sagas.test.ts 5,
+secrets.test.ts 2, +2 generator, +1 store clamp).

**Sagas:** two authored arcs — THE PALE PROCESSION (3 bone chapters, unique
finale THE GRAVE WARDEN) and THE UNDYING EMBER (4 chapters ember→sunken→ash,
unique finale THE CINDER REGENT, the game's largest payouts 800g/1000xp).
Chapters are saga-flagged quests off the classic board; the board gains an
Up/Down second page with per-saga progress pips and current-chapter departure
(finales relivable, progress never rewinds or re-advances). Interludes (<60
words each, original prose) play between victory and Lastlight; the epilogue
caps the arc. Unique kits live BESIDE the boss rotation — classic tiers roll
exactly as before. Per-hero `sagas` map rides the additive sanitize pattern.

**Secret rooms:** generator carves 0-2 sealed pockets per floor into untouched
rock (kind 'secret', OFF plan.rooms — stairs/key invariants hold by
construction), sealed by Tile.CrackedWall (solid; renders as cracked wall;
minimap shows plain wall free). ONLY player-sourced booms (fireball/flame
scroll) crack seals via Combat's blast scan → host.crackWall. Stock: gold,
urns, shrine-or-scroll. ~half host a NEST: entering spawns a floor/biome-gated
pack (level pressure at construction, in-game); clearing it pays run-wallet
gold. systems/SecretRooms.ts tracks reveal/trigger/clear behind a narrow host.

**Metrics/achievements:** sagas_completed / secrets_found / nests_cleared in
all four places; 4 new achievements (30 total).

**Gate caveat (NOT Wave C):** the tree carries an unrelated, unfinished
parallel change set (Supabase/trusted-progression hardening + BaseGame
gameTime/destroy semantics, ~40 files, uncommitted). It fails its own dev
tests (trustedProgression, route, sync outbox), fails the release suite 2/10
(releaseApproval calls validateTrustedGameSession without the newly required
clientMutationId), and the full dev suite OOMs in one --runInBand process.
Dungeon-crawl-scoped gates are fully green; owner chose to leave that WIP for
its author. PLAYTEST CAVEAT: the WIP's BaseGame.gameTime seconds→ms change
distorts time-driven visuals (torch flicker, stairs pulse) in ALL games until
reconciled.

**Awaiting playtest:** saga pacing + interlude prose, finale boss difficulty
(Grave Warden t3×1.15hp, Cinder Regent t5×1.25hp), secret-room frequency vs
fireball/flame-scroll access, nest pack difficulty + reward (25+10/floor),
board page discoverability (↑↓ hint on both pages).

**PLAYTESTED 2026-07-12: successful — sagas approved. Wave D begins.**

---

# Dungeon Crawl v4 — Wave D: The Grimoire, the Manual & the Sheet

## Context (2026-07-12)

Wave C playtested clean. Owner picked Wave D scope: SPELLBOOK (mage/cleric
spell picks on level-up), MONSTROUS MANUAL monsters (one per biome + a deep
terror), CHARACTER SHEET (Tab overlay). Supabase save promotion DEFERRED until
the parallel hardening WIP lands (same schema/service files). Inspiration by
eye from the PHB + Monstrous Manual; generic archetypes; all text original.

## Steps

- [ ] 1. `data/spells.ts`: SpellId/SpellDef/SPELLS/ALL_SPELL_IDS + SPELL_TUNING.
       Six spells, class-gated — mage: burning-hands (short player blast),
       frost-ray (radius stun), blink (short teleport + i-frames via
       host.findOpenSpotNear); cleric: cure-wounds (heal, scholar applies),
       bless (haste buff + 1hp), sanctuary (stoneskin + invuln, scholar).
       Additive `SavedHero.spells: SpellId[]` (sanitize: known ids ∩ class-legal;
       no version bump) + progression.test factory/clamp updates.
- [ ] 2. Level-up draft mixes spells: ProgressionController gains DraftPick
       union ({kind:'boon'|'spell'}), draftChoices(rng) (mage/cleric shuffle
       unlearned spells into the 3-card pool), confirmLevelUp(pick) learns
       spells (hero.spells.push + save); game draft flow + HudRenderer boon
       cards render spell cards (icon/color/blurb + LEARNED tag).
- [ ] 3. Casting: Player.spellCds record (ticks in update); Combat.castSpell(id,
       scholarMult) reusing the scroll effect library (frostNova parameterized;
       blink via host.findOpenSpotNear); game input KeyV = cast active spell,
       KeyG = cycle active (banner); HUD spell pip row (icon + cd bar) when the
       hero knows spells.
- [ ] 4. Character sheet: Tab toggles new 'sheet' state from playing/town
       (returns whence it came; InputManager preventDefaults keydown so Tab is
       safe); HudRenderer.renderCharacterSheet — identity + LV/XP, stats,
       treasury, boons w/ stacks, grimoire (active ★), gear tiers, saga pips.
       Tab joins the monkey-test key list CONSCIOUSLY.
- [ ] 5. Monstrous Manual monsters (reuse behavior verbs; drawEnemy switches on
       behavior so renders ride config colors): salamander (ember 5+, ranged),
       bone-archer (bone 4+, ranged, undead), drowned-one (sunken 5+, chase,
       undead), ember-wight (ash 6+, armored, undead), gargoyle (core row 8+,
       flit). DeathCauses + labels/hints + causeForEnemy (TS-forced); ranged
       bolt cause wiring checked at the projectile source; spawnWeights rows;
       bestiary.test conscious updates (undead set, homes table, gentle floor 1
       unchanged, all reachable by 20).
- [ ] 6. Metrics + achievements: spells_learned / spells_cast in ALL FOUR
       places (34->36 keys); 2 achievements (32 total). New __tests__/
       spells.test.ts (data contract, class gating, draft mixing, learn
       persistence, cast effects, cooldowns, sheet toggle).
- [ ] 7. Gates (type-check, lint incl. guardrail, dungeon-crawl suites, release
       suite CAVEAT: 2 pre-existing WIP failures) + Crawler_handoff.json refresh
       (must parse) + this review + COMMIT game files (tests stay uncommitted
       per owner convention).

## Wave D Invariants

Spells are PERSISTENT hero knowledge (save = state, never currency); scroll
effects stay intact (spells parameterize, never repurpose); fighter/thief
drafts unchanged (boons only); floor-1 gentle set unchanged; existing
SoundName palette only; new monsters reuse existing behavior verbs — zero new
AI; every file under 1500 logical lines.

## Wave D Review (2026-07-12)

**Wave D shipped.** type-check ✅ · lint ✅ (orchestrator crossed the guardrail
mid-wave; brought back under by moving natural homes out: findOpenSpotNear →
TileMap, ability dispatch/hazard damage/nearest-enemy targeting/shop product
effects/scroll pickup → Combat) · dungeon-crawl suites 113/113 (10 suites;
+spells.test.ts 7, +1 bestiary gargoyle gate).

**The Grimoire:** six class-gated spells in data/spells.ts (mage: BURNING HANDS
short blast, FROST RAY radius stun, BLINK teleport+i-frames; cleric: CURE
WOUNDS heal, BLESS haste+1hp, SANCTUARY stoneskin+invuln — scholar boon deepens
cure/sanctuary). Casters' level-up drafts mix unlearned spells among the boon
cards (DraftPick union; martial drafts unchanged); learned spells persist on
SavedHero.spells (additive, class-legal sanitize). V casts the readied spell,
G cycles, per-spell cooldowns tick on the Player; HUD spell pip under the
ability row. Effects reuse the scroll library in Combat.castSpell.

**The Manual:** five Monstrous-Manual-inspired monsters, zero new AI verbs —
salamander (ember 5+, ranged), bone-archer (bone 4+, ranged, undead),
drowned-one (sunken 5+, chase, undead), ember-wight (ash 6+, armored — blocks
frontal like knights, undead), gargoyle (ALL biomes 8+, flit — the deep
terror). Ranged types carry per-config bolt causes (Projectile.cause) so the
recap names your killer properly; 5 new DeathCauses with original labels/hints;
undead set + biome homes updated consciously in bestiary.test; floor-1 gentle
set untouched.

**The Sheet:** Tab flips a full character sheet from play or town (world
freezes beneath): identity + XP bar, record (expeditions/victories/falls),
treasury, gear tiers, saga progress, training with stacks, grimoire with the
readied spell marked. Tab joined the monkey-test key list consciously
(with KeyV/KeyG).

**Metrics/achievements:** spells_learned + spells_cast in all four places
(34→36 keys); 2 achievements (32 total).

**Deferred:** Supabase save promotion — still blocked on the parallel
hardening WIP (unchanged; release suite still fails its same 2/10).

**Awaiting playtest:** spell power vs cooldowns (esp. BLINK escape value and
FROST RAY vs the frost scroll), caster draft dilution (spells crowding boons),
new monster pressure (bone-archer sightlines, gargoyle speed at depth 8+,
wight blocking), sheet readability, V/G/Tab hand-feel.

---

# Dungeon Crawl v5 — Wave E: The Six Scores

## Context (2026-07-13)

Waves A–D playtested clean; hardening pass landed; all gates green. Owner
direction: three waves taking the game from rough draft to a story-driven
masterpiece — E: AD&D ability scores (STR/DEX/CON/INT/WIS/CHA), F: findable
items/equipment/inventory, G: NPCs + DM narration + the villain meta-arc.
Owner decisions: per-class 2e base array + 2 points rolled variance at forge;
growth at level milestones 3/6/9 (favored-stat cards join the draft) plus
future item bonuses; the sheet upgrades each wave.

Key design: gameplay folds read the DELTA between the hero's modifier
(floor((score−10)/2)) and the class-base modifier — a hero at the flat base
array plays EXACTLY like today (veterans sanitize to flat base, untouched);
variance and growth add texture, never a rebalance. Sanitize clamps scores to
[classBase, 18]. Field is `scores` (never `stats` — that's the record). Zero
new metric keys / inputs / sounds. DungeonCrawlGame.ts sits at ~1496/1500 —
extraction valve FIRST.

## Steps

- [x] E1. Extraction valve `progression/DraftFlow.ts` (pure refactor): move
      updateClassSelect / openBoonDraft / updateBoonChoice + classIndex /
      boonChoices / boonIndex / boonReturnState behind a narrow host; update
      methods return the next GameState | null. Proof: full dungeon-crawl dev
      suite green with ZERO test edits.
- [x] E2. `data/stats.ts` (gear/spells module convention): StatId/StatDef/
      STATS/ALL_STAT_IDS/StatScores/STAT_BASES (fighter 17/10/15/9/10/11,
      thief 10/17/11/12/9/13, cleric 13/9/13/10/17/10, mage 8/13/10/17/12/12 —
      each sums 72, favored odd)/STAT_FAVORED/STAT_TUNING + statMod/
      zeroStatMods/statModDeltas/rollStatScores/isStatMilestone. New
      __tests__/stats.test.ts data contract.
- [x] E3. Persistence + forge: SavedHero.scores (additive, no version bump),
      sanitize clamp [classBase, 18] absent→flat base, create() rolls AFTER
      the name pick, ProgressionController.statDeltas(); hero fixtures gain
      scores (TS-forced); clamp + round-trip tests.
- [x] E4. Player folds + wiring: statMods field + applyProgression 4th arg +
      setStatMods (mid-run bumps heal the CON delta); folds in swordDamage /
      meleeKnockback / speed / dash cooldown / heartHealBonus / maxHp; CHA in
      hagglerPrice + openVictory rewardGold; WIS mult in grantXp; INT on spell
      cooldown + burning-hands/fireball damage, WIS on cure/bless (Combat).
      maxHp===18 pin UNCHANGED (zero-delta legacy contract); delta siblings in
      stats.test.ts.
- [x] E5. Milestone stat cards: DraftPick += {kind:'stat'; id}; draftChoices
      prepends favored cards (<18) when reaching level 3/6/9; confirmLevelUp
      +1 clamp 18, sessionBoons untouched; DraftFlow confirm branch (banner
      "X RISES", powerup); renderBoonDraft three-way def lookup; draft tests.
- [x] E6. Sheet: six-cell ability strip (score bold + (+mod) beneath, favored
      tinted class color) between XP bar and columns; columns 170→196.
- [x] E7. Gates (type-check, lint guardrail, full dev suite, release suite) +
      Crawler_handoff.json refresh (must parse) + review here + commit.

## Wave E Invariants

Veterans and flat-base heroes play bit-for-bit like today (zero deltas); the
name rng pick order in create() never moves; scores never leave [classBase,
18]; martial level-2 drafts stay all-boon (milestones are 3/6/9); every
magnitude lives in STAT_TUNING; generator untouched; no new metric keys.

## Wave E Review (2026-07-13)

**Wave E shipped.** type-check ✅ · lint ✅ (DungeonCrawlGame back under the
1500 guardrail via the E1 DraftFlow extraction) · dungeon-crawl suites
135/135 (11 suites; +stats.test.ts 22) · full dev suite 462/462 (47 suites) ·
release suite 10/10.

**The Six Scores:** every hero now carries STR/DEX/CON/INT/WIS/CHA. New
heroes forge from a 2e-flavored class base array (each sums 72) + 2 points of
seeded variance — every SIR ROWAN is a little different. Veterans (saves
without the field) sanitize to the flat base and play EXACTLY as before: all
gameplay folds read the modifier DELTA vs the class base (floor((score−10)/2)
— one formula, no dice on screen). Folds: STR→sword/dagger damage +
knockback, DEX→speed + dash recovery, CON→hearts, INT→spell damage + spell
cooldowns, WIS→heals (hearts/cure/bless) + XP earned, CHA→dungeon-merchant
prices + quest reward gold. Milestone levels 3/6/9 lead the level-up draft
with the class's favored-stat cards (fighter STR/CON, thief DEX/CHA, cleric
WIS/CON, mage INT/DEX — martial drafts finally grow), a third DraftPick kind
beside boons/spells; favored bases are deliberately odd so the first bump
always crosses a modifier boundary. The Tab sheet gains a six-cell score
strip (score + modifier, favored pair in class color).

**Guardrail valve:** class-select + level-up draft flow extracted to
`progression/DraftFlow.ts` (proven pure: all 113 pre-wave tests green with
zero edits before any feature landed).

**Conscious test changes:** hero fixtures gain `scores` (TS-forced); the
town victory test derives expected reward gold from the forged hero's CHA
delta (the forge roll is live rng there); the maxHp===18 legacy pin is
UNCHANGED and commented as the zero-delta contract. No new metric keys — the
characterization contract and monkey list are untouched.

**Awaiting playtest:** forge variance feel (two forges differing), milestone
card appeal vs boons/spells, CON heart swing (CON_HP=2 — drop to 1 if loud),
CHA discount/reward visibility, WIS XP pace at L5+, sheet strip readability.

**Next (Wave F):** Vaults & Reliquaries — findable items/magic items, three
equip slots beside blacksmith gear, run finds banked on VICTORY only,
KeyI inventory. Then Wave G: NPCs + DM narration + the villain meta-arc.
