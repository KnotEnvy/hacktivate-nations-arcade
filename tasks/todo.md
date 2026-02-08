# Level Design Finalization — Task List

## Context

The item progression system is fully implemented. Players now discover 4 key items across levels 1-4 that fundamentally change gameplay. Levels need to be redesigned from scratch to make these mechanics the centerpiece — not afterthoughts bolted onto existing layouts.

**Level Editor:** `/dev/level-editor` (all item tiles available in the "Items" palette group)

---

## Reference: Mechanics Available Per Level

| Level | Player Has | New This Level | Guard Type | Boss |
|-------|-----------|----------------|------------|------|
| L1 | Punch only | Ancient Blade (W) | recruit | — |
| L2 | Blade, Punch | Iron Armor (A) | soldier | — |
| L3 | Blade, Armor | Dash Boots (V) | veteran | Captain |
| L4 | Blade, Armor, Boots | Crystal Heart (K) | veteran | — |
| L5 | Blade, Armor, Boots, Heart | (all items) | veteran | Shadow |

## Reference: Tile Palette

```
Terrain:  # wall  = floor  - platform  | pillar  _ ledge  ~ loose
Hazards:  ^ spikes  X chomper
Gates:    G gray  R red  B blue  Y gold
Switches: * gray  r red  b blue  y gold
Pickups:  g gem  t time  h health  H max health  O owl
Items:    W sword  A armor  V boots  K heart
Entities: P player  E guard  D door  T torch
Story:    S skeleton  I inscription  C spectral crystal  J journal  F fallen seeker
```

## Reference: Guard Behavior

- **recruit** (L1): Low HP, slow attack, no blocking, short detection range
- **soldier** (L2): Medium HP, moderate attack, occasional block
- **veteran** (L3-L5): High HP, fast attack, frequent blocking, longer detection
- **captain** (L3 boss): Closest guard to door becomes captain — locks door until defeated
- **shadow** (L5 boss): Closest guard to owl becomes shadow — multi-phase fight

## Reference: Item Spawning Rules

- Items only spawn if the player doesn't already have them (replay-safe)
- Items persist across levels via localStorage
- "New Game" resets all items
- Death keeps items
- Crystal Heart doubles sword damage (1 → 2 per hit)
- Dash Boots: Ctrl (sword sheathed) = dash with i-frames, 0.8s cooldown

---

## Tasks

### L1: The Forgotten Threshold (50x15)

**Theme:** Tutorial. Teach punch, teach switches/gates, reward with sword.

- [ ] Redesign opening area: safe space for player to read first inscription (punch tutorial)
- [ ] Place a recruit guard BEFORE the sword — force the player to defeat it with fists
- [ ] Sword (W) must be behind a gate (G) requiring a switch (*) to open
- [ ] Switch should require light platforming to reach (not just walking to it)
- [ ] After getting sword, place a second guard encounter to teach sword combat
- [ ] Add an inscription (I) near the sword explaining blade controls (Shift to draw, Z to attack, Ctrl to block)
- [ ] Place gems (g) to reward exploration of the platforming side path
- [ ] Keep the journal (J) and skeletons (S) for atmosphere
- [ ] Door (D) at the far right, guarded by one final recruit
- [ ] Verify: playable start-to-finish with punch → switch → gate → sword → door flow
- [ ] Verify: level is completable without taking damage (skill ceiling)

**Design Notes:**
- The level should feel like a proving ground, not a gauntlet
- First inscription at col ~4-6 so player reads it immediately
- Sword should be visible from a distance but clearly gated
- Keep spike (^) hazards minimal — this is about combat discovery

---

### L2: Hall of Whispers (55x16)

**Theme:** Vertical exploration. Spectral crystals. Armor reward for thorough explorers.

- [ ] Redesign to emphasize vertical platforming with multiple tiers
- [ ] Iron Armor (A) placed in an optional alcove — reward for exploring off the main path
- [ ] Consider placing armor behind a colored gate (R/B/Y) with a hidden switch
- [ ] Soldier guards should challenge players to use their new sword skills
- [ ] At least one area that FEELS dangerous without armor (spike runs, multi-guard room)
- [ ] Spectral crystals (C) should light atmospheric areas and trigger story
- [ ] Loose floors (~) for tension in the exploration path
- [ ] Chomper traps (X) to teach trap timing
- [ ] Clear main path to door for speed runners, with armor as optional side content
- [ ] Verify: level completable without armor (just harder)

**Design Notes:**
- Armor is the first "optional" item — it should feel like a discovery, not a roadblock
- The main path should be tight enough that armor FEELS necessary but isn't
- Spectral crystal lore should hint at what's coming in deeper levels

---

### L3: Gauntlet of the Fallen (60x18)

**Theme:** Combat gauntlet. Captain boss. Dash Boots as reward for defeating him.

- [ ] Redesign as a combat-focused level with multiple guard encounters escalating in difficulty
- [ ] Veteran guards should require blocking and attack timing to defeat
- [ ] Dash Boots (V) placed near the Captain's arena — thematically, his equipment
- [ ] Captain should be positioned near the door (game auto-assigns closest guard to door)
- [ ] Door locks until Captain is defeated — boots should be accessible before or after the fight
- [ ] Create a proper "arena" area for the Captain fight (flat floor, some room to maneuver)
- [ ] Skeleton (S) formations tell stories of previous seekers who failed here
- [ ] At least one section where dash would be useful (long spike gap, timed trap sequence)
- [ ] Health potion (h) and max health (H) placement for the boss fight
- [ ] Verify: Captain fight is fair but challenging without dash boots
- [ ] Verify: Dash boots feel immediately useful after pickup

**Design Notes:**
- The Captain is the first real skill check — the level should build to him
- Guard encounters should escalate: 1 guard → 2 guards → Captain
- Boots near the boss make thematic sense ("The Captain once wore these...")

---

### L4: Labyrinth of Choices (70x20)

**Theme:** Puzzle labyrinth with colored gates. Crystal Heart from the Fallen Seeker.

- [ ] Redesign around the colored gate/switch puzzle system (R/B/Y gates)
- [ ] Crystal Heart (K) placed near the Fallen Seeker (F) — she gives it to you
- [ ] Fallen Seeker should be in a memorable location, not hidden in a corner
- [ ] Multiple paths through the labyrinth — wrong paths cost time, not death
- [ ] Veteran guards stationed at key junctions as path defenders
- [ ] At least one section that rewards dash boots (long gap, trap bypass)
- [ ] Loose floors and chomper traps in the labyrinth corridors
- [ ] Final inscription (I) before the door — "The Final Gate" lore
- [ ] Time crystals (t) placed to help with the longer level
- [ ] Verify: colored switch puzzles are solvable without backtracking
- [ ] Verify: Crystal Heart damage bonus is testable against guards after pickup

**Design Notes:**
- This is the emotional peak of the item arc — the Fallen Seeker sacrifices for you
- The labyrinth should feel like a test of wisdom, not just platforming skill
- Player should have blade + armor + boots by now, so the level can assume all 3
- Crystal Heart should feel like a significant power upgrade for L5

---

### L5: Heart of Crystal (80x22)

**Theme:** Final gauntlet. Shadow boss. Everything the player has learned, tested.

- [ ] Redesign as a crescendo — every mechanic should be tested
- [ ] Section 1: Platforming gauntlet requiring dash boots to survive (timed gaps, moving hazards)
- [ ] Section 2: Combat gauntlet with veteran guards, requiring sword + block mastery
- [ ] Section 3: Puzzle section with colored gates, testing L4 skills
- [ ] Section 4: Shadow boss arena — open space, dramatic
- [ ] Owl (O) placed above the Shadow's arena, visible as motivation
- [ ] Shadow auto-assigned to closest guard to owl — position guard accordingly
- [ ] Place spectral crystals and torches for dramatic lighting in the boss arena
- [ ] Fallen seeker (F) and inscription (I) for final lore moments
- [ ] Health pickups strategically placed before the Shadow fight
- [ ] Verify: Shadow fight uses Crystal Heart damage bonus (2x sword damage)
- [ ] Verify: All 4 items are essential to feel powerful enough for L5
- [ ] Verify: Level is completable — the difficulty ceiling is the Shadow, not the platforming

**Design Notes:**
- This level should feel like a finale, not a slog
- The Shadow fight is the climax — everything before it builds tension
- Player has ALL items — let them feel powerful in the gauntlet, then humbled by the Shadow
- Spectral crystals and skeletons everywhere — this place is a graveyard of seekers

---

## General Level Design Principles

1. **Teach, Test, Reward** — Each level introduces a concept, tests the player on it, then rewards mastery with a new item
2. **Items change playstyle** — Levels after an item pickup should have sections that FEEL different because of the item
3. **Multiple valid paths** — Speed runners can rush the main path; completionists explore for gems and lore
4. **Fair difficulty curve** — L1 is forgiving, L5 is punishing, the curve is smooth between them
5. **Story through environment** — Skeletons, inscriptions, and journals tell the story without cutscenes
6. **Breathing room** — After every hard section, give the player a safe space to recover
7. **Visual landmarks** — Torches and crystals should guide the player's eye toward objectives

## Verification Checklist (After All Levels Done)

- [ ] Play through L1-L5 in order as "New Game" — full item progression feels natural
- [ ] Replay L1 with all items — items don't spawn again, level still plays fine
- [ ] Die in L3, respawn — confirm items are kept
- [ ] `npx tsc --noEmit` — zero platform-adventure errors
- [ ] Level editor loads all 5 levels correctly at `/dev/level-editor`
- [ ] Each level's width matches tile row lengths (no misaligned rows)
- [ ] Time bonuses feel balanced (enough time to explore, not so much that timer is irrelevant)
