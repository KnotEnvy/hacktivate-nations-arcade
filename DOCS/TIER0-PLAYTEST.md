# Tier 0 Playtest Guide

Last updated: September 27, 2026

Five tier-0 games got their polish round in one session, each as the work of
its own imagined studio: Snake (Mosslight), Minesweeper (Fieldmark), Mini
Breakout (Floodlight), Memory Match (Lamplit Parlour) and Tap Dodge (highway
signage). Endless Runner had its round on September 19 and is not covered
here. Each game's `RECAP.md` in `src/games/<id>/` has the full account; this
guide is the short version for a human playtest before the tier is promoted.

Budget: about 30 minutes for all five, on two inputs.

## Setup (5 minutes)
1. `git fetch origin && git checkout claude/eloquent-ramanujan-qhd02z && npm ci`
2. `npm run dev`, open http://localhost:3000, sign in, open the library.
3. Test on two inputs: a desktop browser with a mouse + keyboard, and a phone
   (or Chrome DevTools device mode with touch emulation).
4. Sound on. Note frame drops (DevTools → Performance, or just feel).

## For every game (2 minutes each)
- Start: is there a READY card that names the controls? Does the game wait for you?
- Pause from the run bar mid-action, resume: nothing jumped or double-fired?
- Lose on purpose: does the death beat play out, THEN the summary appear over the board (not black)?
- Play again from the summary: fresh board, READY card, score 0?
- Back to hub: coins credited match the summary?
- Does the game feel like it was made by its own studio, not a clone of another tier-0 game?

## Per game

### Snake (Mosslight) — 4 minutes
Controls: arrows/WASD, or swipe anywhere (a continuous drag can turn twice). Any turn or tap starts.
1. On the READY card, wait: the snake must not move until you turn or 2s pass.
2. Tap up then left FAST (inside one step). Both turns should happen in order. Try a 180 (right then left): it must be ignored, not kill you.
3. Eat 5 apples: watch the bulge travel down the body, the FEAST ring fill, the "5 apples to RACER" hint count down, then the SPEED UP · RACER swallowtail banner.
4. Grab a coin (amber) and a seed pod (ring icon): the chip appears in the bottom band with its rail; in the last 2s it should blink and tick.
5. Run into a wall on purpose: freeze + shake, then HATCHED · 2 LIVES LEFT at the centre, snake waits for your turn, 1.5s of flashing where walls steer you and your own body is passable.
6. Lose all three eggs: body dissolves, then the summary appears over the dimmed board with the shed skin.
7. Phone: swipe controls only; confirm the READY card's swipe hint and that a swipe during the respawn wait releases it.
Red flags: the snake jumping cell to cell instead of gliding; an input eaten while turning; a coin sitting inside the body; anything drawn over the board other than in-board effects.

### Minesweeper (Fieldmark) — 5 minutes
Controls: tap/click opens, right-click or hold 0.45s flags, tap a number to chord; FLAG MODE switch in the footer; arrows + Space/F on keyboard; 1/2/3 pick a board before the first click.
1. Easy: first click anywhere. It must open at least a 9-tile cascade and never a mine. Timer starts now, not before.
2. Hold a finger/mouse on a tile: a pink ring grows, the flag plants at 0.45s, and releasing must NOT open the tile.
3. Flag the mines around a number, then tap the number: the rest of its neighbours open together. Put a WRONG flag next to a number and chord: that should detonate (it is the rule).
4. Win an easy board: flags plant on the remaining mines in a wave, sunglasses face, CLEARED tag with time and NEW BEST, ~2s, then the summary over the board. Coins should be roughly 10 per flag you placed yourself.
5. Lose on medium: freeze, shockwave, mines go off outward from the hit, wrong flags get a red cross, BOOM tag with "N of M tiles cleared".
6. Hard: the whole 20x14 instrument fits with a margin; switch to MEDIUM and back with the keys.
7. Phone: flag mode switch reachable; long-press flags; the face button restarts.
Red flags: a win not being detected (the old bug); numbers blurry; a mine going off from a long press; the board overlapping the footer.

### Mini Breakout (Floodlight) — 4 minutes
Controls: ← →/A D (accelerates), mouse follows over the canvas, finger drag; Space/click/tap serves or releases a caught ball.
1. SERVE card: move the paddle left/right before serving — the chevron aim guide should lean with the ball's position on the paddle and with paddle motion; the ring counts down to a 3s auto-serve.
2. Rally: rails flare where the ball hits; cracked tiles show cracks and a darker tint; every second brick sends a coin into the scorebug.
3. Chain 3+ bricks without a paddle return: STREAK x2 then x3 on the scorebug and a longer, colour-shifted comet.
4. Catch a capsule: the tag appears in the scorebug with a drain rail. Try CATCH (ball sticks; RELEASE prompt) and BLAST (3x3 burst).
5. Clear set 1: last brick slow-mo + flash, SET 1 CLEAR lower-third, next set drops in row by row, SERVE again.
6. Lose a ball: BALL OUT · N SERVES LEFT, red vignette, ~1.2s, then serve again. Lose all: MATCH OVER beat, then the summary over the dimmed court.
7. Phone: drag to move; tap to serve; confirm a drag never serves.
Red flags: the ball passing through a brick or the paddle at high speed; a serve from a still paddle going perfectly vertical; HUD text over the bricks.

### Memory Match (Lamplit Parlour) — 6 minutes
Controls: tap/click a card (turns on release); arrows + Space on keyboard; P peek, H hint; mode card first.
1. Mode card: pick CLASSIC with a tap, then TIMED on a second run (arrow keys + Space on desktop). Last mode should be pre-selected next time.
2. Deal: cards fly in from the stack with clicks; "YOUR TURN" waits ≤1s.
3. Press on one card, drag onto another, release: nothing should turn (release must be on the card you pressed). Tap two cards: match pops emerald with "+100"; a miss shakes with a red edge and turns back after ~0.7s.
4. Build a streak of 3: the candle-flame streak chip lights; "+140 · STREAK 3".
5. Use PEEK once (all cards up for 1s) and HINT (one pair, 8s cooldown): neither should be usable while cards are comparing.
6. Clear table 1: placard with moves vs par, time, bonuses; cards sweep away; table 2 (4x4) deals.
7. TIMED: let the clock run out on a table: OUT OF TIME, remaining cards turn up in a wave, then the summary over the dimmed table.
8. If you have time: clear all five tables (about 6 minutes) for the ALL FIVE TABLES finale; PERFECT RUN only if every table was at par.
Red flags: a card turning on press instead of release; a hint turning your card back; the HUD over the cards; icons that look alike at 6x6.

### Tap Dodge (highway signage) — 4 minutes
Controls: ← →/A D hop one lane per press (buffered), ↑/W jump, ↓/S duck; on touch tap the left/right third to hop, drag to steer (snaps to lanes), swipe up to jump, swipe down to duck. Any key or tap starts.
1. READY card: it should wait for you (≤2s), then the road starts; you begin on a lane centre.
2. Mash left twice quickly: two hops, not one. Hold a key: still one hop.
3. First HIGH beam (pink beam with "HIGH" tags and down-chevrons): duck under it; first LOW beam: jump. Hold ↑: you must not chain jumps — one dodge per press. On the phone, use swipes.
4. Walls with a gap: the coin/gem sits in the gap; the gap is never more than two lanes from the previous safe lane.
5. Skim past a crate by one lane: "CLOSE +75", brief slow-mo, a chain count on the fever plate. Passing a lane away should NOT count.
6. Survive 10s clean: fever WARM x1.5; 30s: FEVER x3.0; a hit resets it and freezes for a blink with a red edge.
7. Around 45s: RUSH warning, then pink rails and HOLD THE LINE for 10s; surviving pays CLEAR +300.
8. Zone changes at 30/60/90s: the name is painted across the lanes and the shoulders change (clouds → rooftops → canyon → storm); after 120s speed keeps rising to a cap.
9. Die: ship shatters, 1.4s, then RUN REPORT with a letter grade and eight tiles; it auto-continues after 4s or on tap; then the summary over the dimmed report.
Red flags: a row with no safe lane; two rows too close to switch lanes between; the ship resting between lanes; a HIGH beam drawn under a ducking ship; any emoji.

## What to report back

For each game: pass / fail per numbered step, the red flags you saw, how the
game *felt* in one sentence, and whether it reads as its own studio next to
the other four. Frame drops, sound oddities and anything the READY card did
not explain are worth a line each. Coins credited per run are worth noting
too, so the tier's economy can be balanced as a set (the per-game estimates
are in each RECAP).
