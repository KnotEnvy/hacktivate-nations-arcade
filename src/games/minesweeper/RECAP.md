# Minesweeper — Development Recap

Last updated: September 27, 2026

Tier 0, free. Before this pass it was a competent Windows-95 homage, but it
**could not be won**: every board ended in a loss or a shrug. This file records
what the game is now, why each choice was made, and where the edges still are.

---

## The studio: Fieldmark

I imagined this game coming from **Fieldmark**, a two-person studio that makes
quiet desk-toy puzzles styled as survey instruments. Their games look like
equipment you would find in a field geologist's case: slate housings with corner
screws and a debossed maker's mark ("FIELDMARK · SURVEYOR"), numerals in
recessed readout windows, ruler ticks along the edge of the well, and the hot pink
of real surveyors' flagging tape for every flag. The whole desk is printed with
faint topographic contours. The motion is mechanical: keys press down, latch,
pop off and seat with a small overshoot, and nothing floats or glows. The copy
is terse and reads like a field log ("SURVEY THE FIELD", "17 of 220 tiles
cleared", "CLEARED · 42.3s · NEW BEST"). Results arrive as a **survey tag**: a
chamfered card with a punched eyelet, tied with two tails of pink tape. You see
this on screen as one instrument sitting on a desk, not as a HUD laid over a
game.

---

## The polish pass (September 27, 2026)

### Bugs this pass fixed

| Bug | Effect on the player |
| --- | --- |
| `revealAt()` queued the cascade, called `checkWin()` before any reveal had happened, then the queue revealed with win-checking **off** | **The game could not be won.** Opening the last safe tile did nothing |
| A win called `endGame()` on the same frame | Had the win fired, the shell's summary would have covered the board before any celebration was visible |
| Mines revealed on `setTimeout`, in array index order | They kept exploding through pause and after the game was destroyed, and the "shockwave" swept the board row by row, top-left first |
| Flagging needed right-click or F; the manifest lists `touch` first | On a phone you could not flag at all |
| No chording | Clicking a satisfied number did nothing, which is the core speed technique of the genre |
| Medium (16x16) and hard (20x14) used a centre-plus-30px layout | The boards ran under the difficulty buttons and the footer text |
| Hover was per-cell `isHovered` flags that were set but never cleared on restart; the face's pressed state called `isSmileyClick` with the smiley's own centre | Stale hover highlights, and the face looked pressed on **any** mouse-down anywhere |
| Every mouse/touch edge was polled from level state (`prevLeft` etc.) | A press that slid across tiles opened the first one on press, not the one released on |
| Numbers were `Arial` with `shadowBlur` 8 | Soft, blurry digits at 28px, and a blur per number per frame |
| The LED counters were red and the face was amber | Red read as a problem and amber read as currency |

### How the rules work now

**Reveals are logical and immediate.** `systems/Board.ts` opens a tile and floods
at once, so the win is decided on the move that earns it. The staggered cascade
the player watches is animation laid over a field that has already opened. Each
tile carries a `revealT` in the game's animation clock and pops at
`depth × 28ms`. That is what fixed the unwinnable board: the win check no
longer has to wait for a queue to drain. `onUpdate` also re-checks
`board.isCleared()` every playing frame as a backstop.

**Chording** is the standard rule. Tapping a revealed number whose flagged
neighbours equal its value opens every other hidden neighbour: they go down
together for 80ms, then open together. With the wrong flag count, the tiles it
*would* open are pushed down for 0.26s (the peek) and nothing opens. If a flag
is wrong, the chord opens the mine and the run is lost. That is the rule.

**First reveal.** The pressed tile and its eight neighbours are always clear. The
placer then re-rolls (up to 60 times, keeping the best) until the first opening is
at least 9 tiles, so a corner press never opens a lonely 2x2. This was a
nice-to-have in the brief, and it holds on every seed the test tries.

**States.** `ready` (board visible, timer still, a 2s instruction card that the
first input dismisses) → `playing` → `dying` (2.0s) → `ended`, or `playing` →
`won` (1.8s) → `ended`. The face button deals a new board at the same
difficulty while you are in READY or PLAYING. Difficulty changes only in READY.

### The death beat (2.0s)

0.1s hit-stop: the animation clock stops, the hit tile strobes white and red,
and the face goes dead. Then comes a shake and a big burst, and a red shockwave
ring leaves the hit mine. Every other unflagged mine goes off **in order of its
distance** from the hit, as the ring reaches it. Each gets a red bloom with a
white-hot core, sparks and soot, and settles on a sooted plate. Each wrong flag
is crossed out in red as the wave passes. Correct flags stay standing. The
`explosion` sound plays at most 6 times (a shared budget with a 90ms gap), then
the rest go off silently. The field dims from 1.2s, and the BOOM tag drops in
with "N of M tiles cleared". It all runs on a dt-driven schedule (`wave[]`
with beat times), so pause freezes it.

### The victory beat (1.8s)

The timer stops on the winning move, the face puts on survey shades, and
`success` (a single chord) plays. Flags plant on every remaining mine in a wave from the last move, each
with pink survey ticks and a rate-limited `click`. The wave waits for the final
cascade to finish popping. A diagonal sheen sweeps the field, and flagging-tape
ribbons (pink, teal and bone, clipped to the well) fall from the top edge. The
CLEARED tag drops in at 0.55s with "42.3s · NEW BEST" (or "· best 38.1s").
`endGame()` is called at 1.8s. The beat sets `endGameSound = 'win'` and
`endGameOutcome = 'completed'` first, so the full fanfare closes the clear and
the session reports as completed. Every new field resets both to
`game_over` / `died`.

### The ended frame

`onRenderEnded` blits the cached desk, housing and tile layers, with every
animation read as settled: mines shown, flags planted, wrong flags crossed out.
The well is dimmed 55%, and the final header and footer state and the tag are
drawn on top at full strength. It is static and costs three blits plus the
chrome.

---

## Art direction

Kept, because players look for them: the bevelled raised tile, the sunken
opened tile, the counter and timer pair, and the face button. Modernised:

- **Keys** (unrevealed): cool teal-green enamel with a vertical gradient, a
  1px light top-left bevel, a 1px dark bottom-right bevel, a 2px lip, and a
  deterministic five-speck noise per tile. Hover lightens the key. A press
  pushes it into the plate: darker, with the bevel inverted.
- **Plate** (revealed): warm charcoal with a 1px inner shadow top-left and
  hairline grid lines. The plate also shows through the 1px gaps between keys,
  so opening a key reveals the plate it was sitting on.
- **Numbers**: JetBrains Mono 800 at 62% of the tile, with no blur. Classic hues
  are lifted to read on charcoal: 1 sky blue, 2 green, 3 red, 4 periwinkle (navy
  cannot survive a dark ground), 5 raspberry (for maroon), 6 cyan, 7 bone, 8
  grey. The 3 stays red because players read the colour as the number.
- **Pennant**: a steel pole on a stake foot, carrying a swallowtail of pink tape
  with a fold line. It plants with an `outBack` overshoot.
- **Mines**: iron spheres with eight spikes, a hard specular highlight and a cool
  rim, so dark iron still reads on the dark plate. The hit mine sits on a
  scorched, cracked plate with a red glow. Mines set off by the wave sit on a
  sooted plate.
- **Face**: a bone enamel disc in a slate bezel, drawn in four moods: idle,
  tense (open eyes and an "o" mouth while a board press is held), dead (X eyes)
  and cool (survey shades).
- **Colour discipline**: red is only ever a problem (the hit, wrong flags,
  over-flagging, the BOOM tag, sparks). Amber never appears.

**Caching (measured, not guessed).** There are three offscreen layers. The desk
is built once. The housing (slab, baked soft shadow, readout recesses, well,
ruler ticks, screws, maker's mark) is rebuilt only when the layout changes. The
tiles use **one image of the field with a dirty signature per cell**: each frame
computes every cell's settled signature (cheap integer compares) and redraws
only the cells whose signature changed. A cell that is mid-animation parks a
neutral signature in the cache and is drawn live on top. I measured this in the
capture harness (scene `24-perf`, a mid-game hard board, headless Chromium):
about **1.0ms per frame cached against 17.8ms with every tile redrawn**, and a
settled frame redraws **0** tiles. That is why I chose per-cell dirty
signatures over "full redraw during animations": cascades and waves animate a
handful of cells at a time, not the whole field. The one `shadowBlur` in the
game is baked into the housing layer.

---

## Controls

| Input | Action |
| --- | --- |
| Mouse left (on release, where released) | Open a tile; on a number, chord |
| Mouse right | Plant or pull a flag |
| Hold 0.45s (mouse or finger), with a pink ring growing from 0.12s | Plant or pull a flag. The press that flagged never also opens |
| Tap | Open or chord, like a left click |
| FLAG MODE switch (footer) | Taps plant flags instead of opening; tapping a number still chords |
| Arrows / WASD | Move the reticle cursor (auto-repeat after 0.3s). The first press wakes it where it sits |
| Space / Enter | Open or chord under the cursor (the first press wakes the cursor) |
| F | Flag the tile you are pointing at (keyboard cursor, or the mouse over the field). Pointing at nothing, F throws the flag-mode switch |
| 1 / 2 / 3 | Easy / medium / hard (READY only) |
| Face button | New board at this difficulty (READY or PLAYING) |

The first tap always opens, even in flag mode, because there is nothing to flag
yet. A mouse press dragged off the field and released does nothing, and the
depressed key follows the pointer, so what is pushed down is what opens.

## HUD layout

Everything comes from `systems/Layout.ts`, which both the renderers and the
input path read. What is drawn is exactly what is clickable.

- **Instrument** (centred in the space above the desk strip): a 46px readout
  strip with MINES (mono, faint leading zeros; negative and red when
  over-flagged; a teal pulse when every flag is placed but the field is not
  clear), the face button, and TIME (mono, whole seconds). Below it sits the
  well, with the tiles at the largest size that fits with at least 12px clear of
  every band. The housing keeps 12px clear of the canvas top and of the desk
  strip, so its screws and shadow are never cut off. Easy is 36px, medium 28px,
  hard 32px (640x448).
- **Desk strip** (bottom 54px, never shakes): three physical keys (EASY 9×9,
  MEDIUM 16×16, HARD 20×14) with their shortcut on a mini keycap. The selected
  key latches down and lights teal. Keys dim once the first tile opens, and a
  locked key wobbles if pressed. Next come the FLAG MODE toggle switch (pink
  track when on), a recessed BEST readout for this difficulty, and a hint line
  that changes with state and input. READY shows "Tap to reveal · hold to flag ·
  first tap is always safe", or the mouse or keyboard version once you use one.
  PLAYING shows "Tap a number to chord · …", the flag-mode version, or, on
  keyboard, the cursor's grid reference ("J7 · Space opens or chords · F flags ·
  arrows move").
- The READY card and the result tags are the only things drawn over the field,
  and both are beat cards. Particles and rings are clipped to the well, so no
  effect crosses a readout.

## Sound vocabulary

`click` (a key opening; one per 40ms across a whole cascade), `land` (a flag's
stake seating), `click` (a flag pulled, a key or face pressed), `switch_click`
(the flag-mode switch), `bounce` (the peek, quiet), `whoosh` (cascades of 12 or
more, with a teal ripple ring), `explosion` (at most 6 per loss), `success` at
the clear, and `win` when the victory beat ends (through `endGameSound`). No
music is started or stopped.

---

## Scoring and payout

- +10 per safe tile opened (unchanged).
- A clear adds a flat bonus (easy 300, medium 1000, hard 2000) plus
  `round(max(0, par − time) × 10)`, with par 60 / 200 / 300s.
- `pickups` = the flags the player planted, counted at the win. Every flag
  standing at a clear is on a mine, because a flagged safe tile cannot be opened,
  so a field with one cannot clear. The victory wave's flags are decoration and
  do not count. A loss pays pickups 0, so it pays only the tiles.
- `extendedGameData` keeps `cells_cleared`, `games_won`, `fast_win`,
  `flags_used` and `difficulty` exactly as before. `trackGameSpecificStat` keeps
  `cells_cleared` and `games_won`, and the localStorage keys
  (`minesweeper_difficulty`, `minesweeper_best_<difficulty>`) are unchanged.

**Estimated payout** (coins = `floor(score/100) + pickups × 10`):

| Run | Score | Pickups | Coins |
| --- | --- | --- | --- |
| Easy loss, ~30 tiles | 300 | 0 | 3 |
| Easy win in 75s, 7 flags | 1,010 | 7 | ~80 |
| Medium loss, ~100 tiles | 1,000 | 0 | 10 |
| Medium win in 180s, 30 flags | 3,360 | 30 | ~333 |
| Hard win in 280s, 50 flags | 4,400 | 50 | ~544 |

A **typical three-minute session for an average player** is about **80–125
coins**: two easy boards (one win, one loss) is about 83, and one medium attempt
with a ~35% win rate is about 125 on average. Flags dominate a win's payout. If
the tier needs this lower, the knob is one line in `startVictory`
(`this.pickups = this.playerFlags`). Capping it, or paying flags at a lower rate
per difficulty, would not touch the score.

---

## Verifying it

`npx jest --config jest.dev.config.js --runInBand src/games/minesweeper` runs
39 rules tests (`__tests__/minesweeper.rules.test.ts`). They are built on
`gameTestHarness`, drive the real pointer, touch and keyboard path through a
fake input, and reach private state through a typed `internals()`-style cast:

- **(bug)** a full board is won by clicking every safe tile through the pointer;
  a win opened by a cascade is caught on the same move
- **(bug)** the victory beat runs 1.8s, plants the remaining flags and holds
  `addCoins` until `endGame`, then ends on `win` and reports `completed`; a
  later loss still ends on `game_over` and reports `died`; scoring is tiles,
  clear bonus and pace, with pickups = the player's flags; a new best is saved
  and shown
- the death beat holds 2s and pays only the tiles; **(bug)** mines go off in
  non-decreasing distance order, nothing goes off during the hit-stop or while
  paused, `setTimeout` and `setInterval` are never called, and `explosion`
  plays at most 6 times; wrong flags are crossed out and right ones stand
- **(bug)** chording peeks without opening on a wrong count, opens on a match,
  sets off the mine on a wrong flag, and works from the keyboard
- **(bug)** long-press flags with a growing ring and never also reveals; a short
  tap reveals; the flag-mode switch turns taps into flags and back; the first
  tap opens safely even in flag mode
- the first reveal is safe and opens at least a 3x3 on every difficulty, from
  corners, edges and the centre, over 25 seeds (≥9 tiles on easy)
- mines-left follows the flags and goes negative; the timer waits for the first
  reveal and stops at a loss and at a win
- **(bug)** every difficulty fits in bands inside 800x600: 12px of clearance from
  the header and the desk strip, the housing 12px clear of the canvas top and
  the desk, controls apart and above the hint; hard is exactly 32px
- **(bug)** hover comes from the pointer and does not survive a restart; a held
  tile is pushed down and the face goes tense; release opens it; a press
  dragged off the field does nothing; the face shows pressed only under a held
  pointer, and a release on it deals a new field
- keyboard: arrows move the cursor, Space opens, F flags under the cursor, F
  with nothing targeted throws flag mode, and 1/2/3 work only in READY
- `restart()` returns to READY with every timer, system and entity reset; the
  READY card leaves on first input or within 2s
- the ended frame draws dimmed and does not advance the clock; a settled frame
  redraws 0 tiles

### Looking at it

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium PLAYWRIGHT_PORT=3102 \
CAPTURE_GAMES=minesweeper npx playwright test tier0-capture --project=chromium
```

This writes 25 scenes to `.captures/tier0/minesweeper/`: the READY card, READY at
each difficulty, hover, a held key, mid-cascade, the settled opening, flags
mid-plant, the long-press ring and its planted flag, flag mode with a ghost
pennant, the chord peek, the keyboard reticle, the hit-stop, mid-shockwave, the
BOOM tag, the lost ended frame, the won beat, the CLEARED tag, the won ended
frame, a medium board in play, and two loupes (`22z-loupe.png` for a number
tile, `23z-loupe.png` for a planted flag). The `24-perf` scene writes
`perf.json`.

---

## Still open

- No "no-guess" generator. The first opening is guaranteed, but later 50/50s
  can still happen, as in the classic.
- The desk strip hides the difficulty name inside the keys. A player who resets
  with the face and wants a different size has to notice the keys have unlocked.

## Requested shared changes

The lead has since handled 1, 2, 3, 5 and 6 and reported 4 as handled. With the
`PressTracker` fix in, the game's own mouse-position workaround was removed as
dead code. With `endGameSound` / `endGameOutcome` in, a clear ends on `win`
and reports `completed` (see the victory beat). My capture block still uses
casts for `mouseDown`, `touchStart`, `loupe` and the rest, because the `GC`
interface in the spec I last read did not declare them yet. The original
requests are kept below for the record.

1. **`PressTracker` returns a stale position on the first frame of a mouse press
   that follows touch input.** `update()` refreshes `pointerPos` only
   `if (!this.usingTouch)` and clears `usingTouch` afterwards, so that press is
   aimed at the last touch point. Minesweeper works around it by reading the
   mouse directly for mouse presses (`pointerPos()` in the game). The fix is to
   clear `usingTouch` before reading the mouse on a mouse-down frame.
2. **`InputManager` listens for `mouseup` on the canvas only.** A press released
   outside the canvas stays "down" until the next `mouseup` on it. Listening on
   `window` would make press-drag-off-cancel reliable in every game.
3. **`BaseGame.endGame()` always plays `game_over` and reports `'died'`**, even
   after a win. The CLEARED beat ends on a game-over sting. An outcome argument
   (`endGame('won')`) would let wins sound and report as wins.
4. **The capture spec's `GC` interface** omits `mouseDown`, `mouseUp`,
   `touchStart`, `touchEnd` and `loupe`, which the harness already provides. My
   block casts to reach them.
5. **The Next.js dev indicator** (the round "N" badge) sits over the bottom-left
   of the loupe canvas in captures.
6. **`gameTestHarness.makeStubServices().calculateGameReward`** pays
   `pickups × 1`, while the real `CurrencyService` and the capture harness pay
   `pickups × 10`. Coin assertions written against the stub would be off by 10x.
