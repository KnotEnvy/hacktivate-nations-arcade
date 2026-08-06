# THE TUNING FINALE — the visual & feel rubric

The standard every critic grades against. **Grade the captured frames in
`.captures/`, not the code.** Regenerate them with `npm run capture`.

## The bar

2D, top-down, pixel-art dungeon crawler at 800×600. The comparison class is
**Darkest Dungeon, Hades, Enter the Gungeon, Children of Morta** — games that
are unmistakably 2D and unmistakably triple-A. We are not chasing 3D. We are
chasing *deliberateness*: every pixel on screen looks chosen.

**There is no reference build to A/B against.** Do not claim to have compared
this to another game's screenshots. Grade against the written criteria below
and say precisely which criterion fails and where.

## How to grade

For each criterion: **PASS**, or **FAIL + the specific frame + what you see +
the smallest change that would fix it.** A finding without a frame name and a
concrete fix is not a finding. Vague praise is worse than useless.

Terminates at **3 rounds per area**. If a criterion still fails at round 3,
write it up and escalate — do not loop forever.

---

## R1 · Silhouette & readability

- R1.1 Every enemy is identifiable by **silhouette alone** at 100% zoom. A
  flat filled rectangle is an automatic FAIL.
- R1.2 The player is findable in under half a second in a crowded frame.
- R1.3 Threat reads before it lands: wind-ups, telegraphs and ranged bolts are
  visually distinct from decoration.
- R1.4 Interactables (chest, urn, stairs, pickup) are distinguishable from
  scenery at a glance.

## R2 · Surface & material

- R2.1 No large area of flat, untextured single-colour fill. Floors and walls
  carry grain, wear, or variation.
- R2.2 Tile seams do not read as a hard grid. Edges between surfaces are
  deliberate, not accidental hard rectangles.
- R2.3 Palette coherence per biome/plane: nothing on screen looks imported
  from a different world (e.g. warm dungeon browns inside a cold plane).
- R2.4 Black areas read as *depth or void*, never as a missing tile.

## R3 · Light

- R3.1 Torch and light pools have shape and falloff, not visible banding rings.
- R3.2 Darkness hides without making the floor unplayable — the player can
  always read the tile they stand on and the one ahead.
- R3.3 Fog/haze reads as atmosphere, never as a grey smudge over the art.
- R3.4 Per-plane darkness is characterful and still readable (silver-void 0.14
  is the one to check hardest).

## R4 · The frame furniture (HUD, banners, overlays)

- R4.1 No hard-edged translucent letterbox bands across the play area. Banners
  are composed — feathered, framed, or fully committed panels.
- R4.2 The HUD reads as one designed object, not a stack of rectangles and
  bars that accreted over thirteen waves.
- R4.3 Every overlay (board, smith, alchemist, inn, temple, waydoor, sheet)
  shares one panel grammar: same corners, same border weight, same padding,
  same type scale.
- R4.4 Type hierarchy is deliberate — a clear primary, secondary and tertiary
  size, consistent across every screen.
- R4.5 Nothing important is clipped, colliding, or hard against a screen edge.

## R5 · Motion & feel *(graded from the game, not stills)*

- R5.1 Hit feedback is legible at a glance: the hit, the kill, and the miss
  are three distinct readings.
- R5.2 Hit-stop punctuates without feeling sticky in a crowd (JUICE.KILL 45ms,
  BOSS_KILL 220ms).
- R5.3 Vignettes communicate state without fatiguing — the low-HP breathe runs
  for whole floors at 2 HP.
- R5.4 Particles read as a deliberate effect, never as confetti at the cap.

## R6 · Voice *(prose)*

- R6.1 One voice across every string — terse, mythic, second person. Thirteen
  waves of authors must sound like one.
- R6.2 Short beats: the house rule is ≤65 words for an interlude beat.
- R6.3 No string collides with, overflows, or is truncated by its panel.
- R6.4 Original text only; generic archetypes; no product-identity names.

---

## Known failures at round 0 (from the first capture, 2026-08-05)

Seeded from the owner's kickoff frames so no critic has to rediscover them:

1. **R1.1 — enemies render as flat filled squares.** `biome-ember-settled.png`
   shows green, red and teal blocks. This is the single largest gap to the bar.
2. **R4.1 — the floor banner is a hard-edged letterbox band** cutting the
   screen horizontally. Visible in every expedition frame and in
   `town-square.png` behind "WELCOME TO LASTLIGHT".
3. **R2.3 — palette leak into the planes.** `plane-silver-void-settled.png`
   has warm brown crates and a brown-tiled minimap against cold slate.
4. **R3.3 — ember's fog reads as a grey smudge**, flattening contrast across
   the middle of `biome-ember-settled.png`.
5. **R2.1 — the planes' floors are large flat untextured fills.**
6. **R2.4 — pure-black rectangles read as missing tiles**, bottom-left of
   `biome-ember-settled.png`.
