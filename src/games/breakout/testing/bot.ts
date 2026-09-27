// A reflex bot for the playability suite: keyboard only, sees the ball
// `delay` seconds late, no prediction. Like a person it does not meet the
// ball dead centre: each time a ball starts down it picks a contact point
// somewhere across the middle 60% of the paddle. Deliberately a floor on
// what a person can do, not a ceiling.

import type { Rig } from './rig';

export interface BotResult {
  seconds: number;
  score: number;
  pickups: number;
  coins: number;
  bricks: number;
  levelsCleared: number;
  livesLost: number;
  ended: boolean;
}

export function playBot(
  r: Rig,
  seconds: number,
  delay: number,
  dt = 1 / 60
): BotResult {
  const { g, h } = r;
  const seen: Array<{ x: number; vy: number } | null> = [];
  const lag = Math.max(0, Math.round(delay / dt));
  let aim = 0;
  let wasFalling = false;
  let livesLost = 0;
  let lastLives = g.lives;
  let t = 0;
  for (; t < seconds && !h.game.isGameOver?.(); t += dt) {
    // Pick the ball that matters: the lowest one on its way down.
    let target: { x: number; vy: number } | null = null;
    let lowest = -Infinity;
    for (const b of g.balls) {
      const score = (b.vy > 0 ? 1000 : 0) + b.y;
      if (score > lowest) {
        lowest = score;
        target = { x: b.x, vy: b.vy };
      }
    }
    seen.push(target);
    const view = seen.length > lag ? seen[seen.length - 1 - lag] : null;

    r.held.delete('ArrowLeft');
    r.held.delete('ArrowRight');
    r.held.delete('Space');
    if (g.gameState === 'ready' && g.serveWait > 0.4) r.held.add('Space');
    const falling = !!view && view.vy > 0;
    if (falling && !wasFalling) {
      aim = (Math.random() - 0.5) * 0.6 * g.paddle.w;
    }
    wasFalling = falling;
    if (view) {
      const dx = view.x + aim - g.paddle.cx;
      if (dx > 12) r.held.add('ArrowRight');
      else if (dx < -12) r.held.add('ArrowLeft');
    }
    h.game.update(dt);
    if (g.lives < lastLives) livesLost += lastLives - g.lives;
    lastLives = g.lives;
  }
  const coins = Math.floor(g.score / 100) + g.pickups * 10;
  return {
    seconds: t,
    score: g.score,
    pickups: g.pickups,
    coins,
    bricks: g.bricksDestroyedThisGame,
    levelsCleared: (g as unknown as { levelsCompletedThisGame: number })
      .levelsCompletedThisGame,
    livesLost,
    ended: !!h.game.isGameOver?.(),
  };
}
