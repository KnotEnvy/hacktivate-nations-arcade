// Mini Breakout — the rules, pinned.
//
// Each block names the bug from the polish brief it guards against; every
// one of these would have failed on the pre-polish game:
//
//   1. the HUD was drawn over the brick field (bricks started at y=60)
//   2. the banner timer was decremented by 1/60 inside render
//   3. the ball moved 26px a step at the dt clamp and could tunnel the paddle
//   4. the serve auto-launched after 1.2s in a random direction
//   5. a damaged brick looked exactly like a fresh one
//   6. no mouse control; the keyboard paddle snapped to a constant speed
//   7. Escape / P opened a second pause overlay on top of the shell's
//   8. a lost ball played `game_over` and an extra life played `success`
//
// They pin rules, not tuning: angles, beats and ordering, not exact speeds.

import {
  ARENA,
  BALL_R,
  BRICK_H,
  BRICK_W,
  BUILD_START,
  CLEAR_BEAT,
  GAMEOVER_BEAT,
  HUD_BAND,
  LOST_BEAT,
  MAX_BALL_SPEED,
  MAX_BOUNCE_ANGLE,
  MIN_OFF_VERTICAL,
  MIN_VY_FRACTION,
  PADDLE_MAX_SPEED,
  PADDLE_WIDE_W,
  RETURN_ENGLISH,
  SERVE_ENGLISH,
  SERVE_TIMEOUT,
  SLOWMO_TIME,
  START_LIVES,
} from '../constants';
import { makeBall, type Ball, type PowerType } from '../entities/types';
import {
  ensureMinAngle,
  launchAngle,
  moveBall,
  type CollisionHandlers,
} from '../systems/physics';
import { buildLayout, makeBricks, requiredLeft } from '../systems/levels';
import { pickPower } from '../systems/powerups';
import { BrickRenderer, tileTint } from '../systems/BrickRenderer';
import {
  boot,
  overlaps,
  press,
  run,
  seedRandom,
  serve,
  testBrick,
  type Rig,
} from '../testing/rig';

afterEach(() => jest.restoreAllMocks());

const OPEN = { left: -1e4, right: 1e4, top: -1e4 };
const quiet = (over: Partial<CollisionHandlers> = {}): CollisionHandlers => ({
  wall: () => {},
  paddle: () => {},
  brick: () => {},
  ...over,
});

function angleOf(b: Ball): number {
  return Math.atan2(b.vx, -b.vy);
}

/** Put the live ball somewhere, moving somewhere. */
function place(r: Rig, x: number, y: number, vx: number, vy: number): Ball {
  const b = r.g.balls[0];
  b.stuck = false;
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  return b;
}

function brightness(hex: string): number {
  const p = parseInt(hex.slice(1), 16);
  return ((p >> 16) & 255) + ((p >> 8) & 255) + (p & 255);
}

// ------------------------------------------------------------------ 3 ----
describe('the ball never tunnels at the loop dt clamp (0.05s) and top speed', () => {
  const DT = 0.05;

  it('always hits a brick it is flying at, from any phase of the frame', () => {
    for (const deg of [0, 25, 45, 60]) {
      const a = (deg * Math.PI) / 180;
      for (let gap = 0; gap < MAX_BALL_SPEED * DT; gap += 0.5) {
        const brick = testBrick(300, 200);
        // Start below the brick's underside, aimed at its middle.
        const ball = makeBall(
          brick.x + brick.w / 2 - Math.tan(a) * (gap + BALL_R),
          brick.y + brick.h + BALL_R + gap
        );
        ball.vx = Math.sin(a) * MAX_BALL_SPEED;
        ball.vy = -Math.cos(a) * MAX_BALL_SPEED;
        let hit = false;
        moveBall(
          ball,
          DT,
          OPEN,
          null,
          [brick],
          quiet({ brick: () => (hit = true) })
        );
        const passed = ball.y + ball.r < brick.y;
        expect(passed && !hit).toBe(false);
        expect(overlaps(ball, brick)).toBe(false);
      }
    }
  });

  it('always returns off the paddle, from any phase of the frame', () => {
    const paddle = { cx: 400, y: 552, w: 104, h: 14 };
    for (let gap = 0; gap < MAX_BALL_SPEED * DT; gap += 0.5) {
      const ball = makeBall(400, paddle.y - BALL_R - gap);
      ball.vy = MAX_BALL_SPEED;
      let returned = false;
      moveBall(
        ball,
        DT,
        OPEN,
        paddle,
        [],
        quiet({
          paddle: b => {
            returned = true;
            b.vy = -Math.abs(b.vy);
            b.y = paddle.y - b.r;
          },
        })
      );
      expect(returned).toBe(true);
      expect(ball.y).toBeLessThan(paddle.y);
    }
  });

  it.each([7, 21, 42])(
    'in a live game (seed %i), never ends a frame inside a brick or in the band, and a tracked ball is never lost',
    seed => {
      seedRandom(seed);
      const r = boot();
      const { g, h } = r;
      // Level 11: speed cap reached, and the shuttle row slides.
      g.level = 11;
      g.bricks = makeBricks(11, false);
      serve(r);
      const b = g.balls[0];
      const k = (MAX_BALL_SPEED * 0.98) / Math.hypot(b.vx, b.vy);
      b.vx *= k;
      b.vy *= k;

      for (let frame = 0; frame < 1500; frame++) {
        const lead = g.balls[0];
        if (lead) g.paddle.cx = lead.x;
        h.game.update(DT);
        if (g.gameState === 'ready') {
          g.releaseStuck();
          g.gameState = 'playing';
        }
        for (const ball of g.balls) {
          expect(ball.y - ball.r).toBeGreaterThanOrEqual(ARENA.top - 1e-6);
          for (const brick of g.bricks) {
            if (brick.alive) expect(overlaps(ball, brick)).toBe(false);
          }
        }
        const tracked = g.balls[0];
        if (tracked && !tracked.stuck) {
          expect(tracked.y).toBeLessThanOrEqual(g.paddle.y + g.paddle.h);
        }
        expect(g.lives).toBe(START_LIVES);
      }
      expect(g.bricksDestroyedThisGame).toBeGreaterThan(10);
    }
  );
});

// ------------------------------------------------------------------ 4 ----
describe('the serve waits for the player and aims from the paddle', () => {
  it('rides the paddle until the serve timeout (not the old 1.2s), then serves', () => {
    const r = boot();
    const { g } = r;
    run(r, 1.3);
    expect(g.gameState).toBe('ready');
    run(r, SERVE_TIMEOUT - 1.3 - 0.1);
    expect(g.gameState).toBe('ready');
    const b = g.balls[0];
    expect(b.stuck).toBe(true);
    expect(b.x).toBeCloseTo(g.paddle.cx, 5);
    expect(b.y).toBeLessThan(g.paddle.y);
    run(r, 0.2);
    expect(g.gameState).toBe('playing');
    expect(g.balls[0].vy).toBeLessThan(0);
  });

  it('serves on Space, on a mouse click and on a finger tap', () => {
    const key = boot();
    press(key, 'Space');
    expect(key.g.gameState).toBe('playing');

    const mouse = boot();
    mouse.buttons.add(0);
    mouse.h.game.update(1 / 60);
    expect(mouse.g.gameState).toBe('playing');

    const touch = boot();
    touch.touches.push({ id: 1, x: 400, y: 400 });
    run(touch, 3 / 60);
    expect(touch.g.gameState).toBe('ready'); // a finger down is a drag…
    touch.touches.length = 0;
    touch.h.game.update(1 / 60);
    expect(touch.g.gameState).toBe('playing'); // …a short one released is a tap
  });

  it('launches along the paddle velocity when the paddle is moving', () => {
    const right = boot();
    right.held.add('ArrowRight');
    run(right, 0.2);
    press(right, 'Space');
    const aR = angleOf(right.g.balls[0]);
    expect(aR).toBeGreaterThan(SERVE_ENGLISH * 0.5);

    const left = boot();
    left.held.add('ArrowLeft');
    run(left, 0.2);
    press(left, 'Space');
    expect(angleOf(left.g.balls[0])).toBeLessThan(-SERVE_ENGLISH * 0.5);
  });

  it('launches from where the ball sits on the paddle', () => {
    const r = boot();
    r.g.balls[0].stuckOffset = 0.8;
    press(r, 'Space');
    expect(angleOf(r.g.balls[0])).toBeCloseTo(0.8 * MAX_BOUNCE_ANGLE, 5);
  });

  it('never serves dead vertical from a still paddle, and the aim shows which way', () => {
    for (const lean of [-1, 1]) {
      const r = boot();
      r.g.serveLean = lean;
      press(r, 'Space');
      expect(angleOf(r.g.balls[0])).toBeCloseTo(lean * MIN_OFF_VERTICAL, 5);
    }
  });
});

// ------------------------------------------------------------ angles ----
describe('reflection angles are bounded', () => {
  it('keeps every launch and return between the minimum lean and 60 degrees', () => {
    for (let o = -1; o <= 1.0001; o += 0.05) {
      for (
        let v = -PADDLE_MAX_SPEED * 1.5;
        v <= PADDLE_MAX_SPEED * 1.5;
        v += 60
      ) {
        for (const english of [RETURN_ENGLISH, SERVE_ENGLISH]) {
          const a = Math.abs(launchAngle(o, v, english));
          expect(a).toBeLessThanOrEqual(MAX_BOUNCE_ANGLE + 1e-9);
          expect(a).toBeGreaterThanOrEqual(MIN_OFF_VERTICAL - 1e-9);
        }
      }
    }
  });

  it('returns a ball struck on the paddle tip at full paddle speed at no more than 60 degrees', () => {
    const r = boot();
    serve(r);
    const p = r.g.paddle;
    p.vx = PADDLE_MAX_SPEED;
    const b = place(r, p.cx + p.w / 2 - 1, p.y - BALL_R - 1, 0, 400);
    r.h.game.update(1 / 60);
    expect(b.vy).toBeLessThan(0);
    expect(Math.abs(angleOf(b))).toBeLessThanOrEqual(MAX_BOUNCE_ANGLE + 1e-9);
  });

  it('ensureMinAngle lifts a flat ball without changing its speed', () => {
    const flat = makeBall(0, 0, 500, 4);
    ensureMinAngle(flat);
    expect(Math.hypot(flat.vx, flat.vy)).toBeCloseTo(Math.hypot(500, 4), 6);
    expect(Math.abs(flat.vy) / 500.016).toBeGreaterThanOrEqual(
      MIN_VY_FRACTION - 1e-6
    );
    expect(flat.vy).toBeGreaterThan(0);

    const dead = makeBall(0, 0, -300, 0);
    ensureMinAngle(dead);
    expect(dead.vy).toBeLessThan(0);
    expect(dead.vx).toBeLessThan(0);
  });

  it('no wall or brick contact leaves the ball flatter than the minimum', () => {
    seedRandom(3);
    const bricks = makeBricks(1, false);
    for (let i = 0; i < 400; i++) {
      const a = (Math.random() - 0.5) * 2 * MAX_BOUNCE_ANGLE;
      const b = makeBall(60 + Math.random() * 680, 320);
      b.vx = Math.sin(a) * 500;
      b.vy = -Math.cos(a) * 500;
      for (let s = 0; s < 40; s++) {
        moveBall(b, 1 / 60, ARENA, null, bricks, quiet());
        const speed = Math.hypot(b.vx, b.vy);
        expect(Math.abs(b.vy) / speed).toBeGreaterThanOrEqual(
          MIN_VY_FRACTION - 1e-9
        );
      }
    }
  });
});

// ------------------------------------------------------------ streak ----
describe('the streak (combo)', () => {
  it('pays x2 from the 3rd and x3 from the 6th brick hit, and resets on paddle contact', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    const wall = testBrick(300, 300, 99);
    const ball = g.balls[0];
    const mults: number[] = [];
    for (let i = 0; i < 7; i++) {
      g.onBrick(ball, wall);
      mults.push(g.streak.mult);
    }
    expect(mults).toEqual([1, 1, 2, 2, 2, 3, 3]);

    const before = g.score;
    const one = testBrick(100, 300, 1);
    g.onBrick(ball, one);
    expect(g.score - before).toBe(50 * 3);

    place(r, g.paddle.cx, g.paddle.y - BALL_R - 2, 0, 300);
    r.h.game.update(1 / 60);
    expect(g.balls[0].vy).toBeLessThan(0);
    expect(g.streak.count).toBe(0);
    expect(g.streak.mult).toBe(1);
  });
});

// ------------------------------------------------------------- beats ----
describe('beats run before the game moves on', () => {
  function clearDownToOne(r: Rig) {
    const live = r.g.bricks.filter(b => b.alive && !b.armored);
    for (const b of live.slice(1)) b.alive = false;
    live[0].hp = 1;
    return live[0];
  }

  it('runs the level-clear beat before the next layout, then serves on the new set', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    const level = g.level;
    const score = g.score;
    g.onBrick(g.balls[0], clearDownToOne(r));
    r.h.game.update(1 / 60);
    expect(g.gameState).toBe('clear');
    expect(g.score - score).toBe(50 + 200 + 50 * level);

    run(r, SLOWMO_TIME + BUILD_START - 0.1);
    expect(g.gameState).toBe('clear');
    expect(g.level).toBe(level);
    expect(g.balls).toHaveLength(0);
    expect(g.banner?.title).toContain('CLEAR');

    run(r, 0.2);
    expect(g.level).toBe(level + 1);
    expect(g.gameState).toBe('clear');

    // 0.1s short of the full beat it is still running…
    run(r, CLEAR_BEAT - BUILD_START - 0.2);
    expect(g.gameState).toBe('clear');
    // …and then the next serve is up, on a fully built set.
    run(r, 0.15);
    expect(g.gameState).toBe('ready');
    expect(requiredLeft(g.bricks)).toBe(
      buildLayout(level + 1).specs.filter(s => !s.armored).length
    );
    expect(g.bricks.every(b => b.enter === 1)).toBe(true);
    expect(g.balls[0].stuck).toBe(true);
  });

  it('slows time for the last brick', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    g.onBrick(g.balls[0], clearDownToOne(r));
    const b = g.balls[0];
    b.vx = 0;
    b.vy = -400;
    b.y = 400;
    r.h.game.update(1 / 60);
    const y0 = b.y;
    r.h.game.update(0.05);
    expect(y0 - b.y).toBeLessThan(400 * 0.05 * 0.5);
  });

  it('runs the ball-lost beat before the next serve', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    run(r, 0.2);
    for (const b of g.balls) b.y = 700;
    r.h.game.update(1 / 60);
    expect(g.gameState).toBe('lost');
    expect(g.lives).toBe(START_LIVES - 1);
    expect(g.banner?.sub).toContain('2');

    run(r, LOST_BEAT - 0.1);
    expect(g.gameState).toBe('lost');
    expect(g.balls).toHaveLength(0);
    run(r, 0.15);
    expect(g.gameState).toBe('ready');
    expect(g.balls[0].stuck).toBe(true);
  });

  it('runs the game-over beat before endGame', () => {
    const r = boot();
    const { g, h } = r;
    g.lives = 1;
    serve(r);
    for (const b of g.balls) b.y = 700;
    h.game.update(1 / 60);
    expect(g.gameState).toBe('gameover');
    expect(h.game.isGameOver?.()).toBe(false);

    run(r, GAMEOVER_BEAT - 0.1);
    expect(h.game.isGameOver?.()).toBe(false);
    expect(h.services.currency.addCoins).not.toHaveBeenCalled();
    expect(r.sounds).not.toContain('game_over');

    run(r, 0.15);
    expect(h.game.isGameOver?.()).toBe(true);
    expect(r.sounds.filter(s => s === 'game_over')).toHaveLength(1);
    expect(h.services.currency.addCoins).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------ 1 ----
describe('the HUD band belongs to the HUD', () => {
  it('keeps every brick of every level, shuttles included, below the band and inside the rails', () => {
    for (let level = 1; level <= 16; level++) {
      for (const b of makeBricks(level, false)) {
        expect(b.y).toBeGreaterThanOrEqual(ARENA.top + BALL_R * 2);
        expect(ARENA.top).toBeGreaterThan(HUD_BAND);
        expect(b.baseX - b.drift).toBeGreaterThanOrEqual(ARENA.left);
        expect(b.baseX + b.w + b.drift).toBeLessThanOrEqual(ARENA.right);
      }
    }
  });

  it('clips the brick layer to the court, so a set dropping in never crosses the band', () => {
    const r = boot();
    const rect = r.h.ctx.rect as unknown as jest.Mock;
    rect.mockClear();
    r.h.game.render(r.h.ctx);
    expect(rect).toHaveBeenCalledWith(
      ARENA.left,
      ARENA.top,
      ARENA.right - ARENA.left,
      expect.any(Number)
    );
  });

  it('turns the base HUD off and never draws in Arial or a bare monospace', () => {
    const r = boot();
    expect(r.g.renderBaseHud).toBe(false);
    const fonts: string[] = [];
    const ctx = r.h.ctx as unknown as Record<string, unknown>;
    Object.defineProperty(ctx, 'font', {
      configurable: true,
      get: () => fonts[fonts.length - 1] ?? '',
      set: (v: string) => fonts.push(v),
    });
    const fillText = r.h.ctx.fillText as unknown as jest.Mock;
    fillText.mockClear();
    serve(r);
    run(r, 0.5);
    r.h.game.render(r.h.ctx);
    delete ctx.font;
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.some(f => /arial/i.test(f))).toBe(false);
    expect(fonts.some(f => /^\S+ \d+px monospace$/.test(f))).toBe(false);
    const texts = fillText.mock.calls.map(c => String(c[0]));
    expect(texts.some(t => t.startsWith('Score:'))).toBe(false);
  });
});

// ------------------------------------------------------------------ 2 ----
describe('drawing never changes the game', () => {
  it('leaves every timer and state alone however many frames are rendered', () => {
    const r = boot();
    const { g, h } = r;
    serve(r);
    run(r, 0.3);
    g.onBrick(g.balls[0], g.bricks[0]);
    for (const b of g.balls) b.y = 700;
    h.game.update(1 / 60); // lost beat: banner, vignette, particles all live

    const snap = () =>
      JSON.stringify({
        s: g.gameState,
        t: g.stateTime,
        banner: g.banner,
        hurt: g.hurt,
        flash: g.flash,
        card: g.cardAlpha,
        rails: g.railFlashes,
        bricks: g.bricks.map(b => [b.hp, b.shake, b.flash, b.enter]),
        particles: g.particles.count(),
        paddle: g.paddle,
        streak: g.streak.pulse,
      });
    const before = snap();
    for (let i = 0; i < 120; i++) h.game.render(h.ctx);
    expect(snap()).toBe(before);
  });
});

// ------------------------------------------------------------------ 5 ----
describe('damage shows', () => {
  it('steps the tile colour darker with every hit', () => {
    const c = '#9a3fe9';
    const steps = [4, 3, 2, 1].map(hp => brightness(tileTint(c, hp, 4)));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeLessThan(steps[i - 1]);
    }
  });

  it('cracks the tile, empties a cell, and plays `hit` on a crack', () => {
    const r = boot();
    serve(r);
    const tough = r.g.bricks.find(b => b.maxHp >= 2)!;
    const score = r.g.score;
    r.g.onBrick(r.g.balls[0], tough);
    expect(tough.alive).toBe(true);
    expect(tough.hp).toBe(tough.maxHp - 1);
    expect(r.g.score - score).toBe(10);
    expect(r.sounds).toContain('hit');

    // One crack stroke pair per point of damage, none on a fresh tile.
    const art = new BrickRenderer();
    const fresh = { ...tough, hp: tough.maxHp, cracks: tough.cracks };
    art.draw(r.h.ctx, [fresh, tough], false); // warm the sprite cache
    const stroke = r.h.ctx.stroke as unknown as jest.Mock;
    stroke.mockClear();
    art.draw(r.h.ctx, [fresh], false);
    expect(stroke).not.toHaveBeenCalled();
    art.draw(r.h.ctx, [tough], false);
    expect(stroke).toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ 6 ----
describe('the paddle answers keys, mouse and finger', () => {
  it('follows the mouse once it moves, and the keys still work after', () => {
    const r = boot();
    const { g } = r;
    r.mouse.x = 400;
    r.h.game.update(1 / 60);
    r.mouse.x = 620;
    run(r, 0.3);
    expect(g.paddle.cx).toBeCloseTo(620, 0);
    r.held.add('ArrowLeft');
    run(r, 0.3);
    expect(g.paddle.cx).toBeLessThan(560);
  });

  it('follows a dragging finger', () => {
    const r = boot();
    r.touches.push({ id: 1, x: 180, y: 500 });
    run(r, 0.4);
    expect(r.g.paddle.cx).toBeCloseTo(180, 0);
  });

  it('accelerates and decelerates on the keyboard instead of snapping', () => {
    const r = boot();
    const p = r.g.paddle;
    r.held.add('ArrowRight');
    r.h.game.update(1 / 60);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThan(PADDLE_MAX_SPEED * 0.25);
    run(r, 0.3);
    expect(p.vx).toBeCloseTo(PADDLE_MAX_SPEED, 5);
    r.held.delete('ArrowRight');
    r.held.add('ArrowLeft');
    r.h.game.update(1 / 60);
    expect(p.vx).toBeGreaterThan(0); // still turning around
    r.held.delete('ArrowLeft');
    run(r, 0.4);
    expect(p.vx).toBe(0);
  });
});

// ------------------------------------------------------------------ 7 ----
describe('pause belongs to the run shell', () => {
  it('ignores Escape and P', () => {
    const r = boot();
    serve(r);
    const t0 = r.g.gameTime;
    for (const code of ['Escape', 'KeyP']) {
      press(r, code);
      run(r, 0.2);
    }
    expect(r.g.isPaused).toBe(false);
    expect(r.g.gameTime).toBeGreaterThan(t0 + 0.4);
  });
});

// ------------------------------------------------------------------ 8 ----
describe('sound cues', () => {
  it('rings the paddle and rails with bounce, cracks with hit, breaks with success', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    r.sounds.length = 0;
    place(r, g.paddle.cx, g.paddle.y - BALL_R - 2, 0, 300);
    r.h.game.update(1 / 60);
    expect(r.sounds).toContain('bounce');

    run(r, 0.1); // past the bounce cue's rate limit
    r.sounds.length = 0;
    place(r, ARENA.left + BALL_R + 1, 400, -300, -300);
    r.h.game.update(1 / 60);
    expect(r.sounds).toContain('bounce');

    r.sounds.length = 0;
    g.onBrick(g.balls[0], testBrick(300, 300, 1));
    expect(r.sounds).toContain('success');
  });

  it('plays explosion for a lost ball and powerup for an extra serve', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    g.collect({ x: 400, y: 552, vy: 0, type: 'life', age: 0 });
    expect(r.sounds).toContain('powerup');
    expect(r.sounds).not.toContain('success');
    expect(g.lives).toBe(START_LIVES + 1);

    for (const b of g.balls) b.y = 700;
    r.h.game.update(1 / 60);
    expect(r.sounds).toContain('explosion');
    expect(r.sounds).not.toContain('game_over');
  });

  it('plays win for a cleared set', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    for (const b of g.bricks) b.alive = false;
    run(r, SLOWMO_TIME + 0.05);
    expect(r.sounds).toContain('win');
  });
});

// ---------------------------------------------------------- power-ups ----
describe('power-ups', () => {
  it('never drops the same type twice in a row', () => {
    let last: PowerType | null = null;
    for (let i = 0; i < 50; i++) {
      const t = pickPower(last, () => 0);
      expect(t).not.toBe(last);
      last = t;
    }
    seedRandom(11);
    last = null;
    for (let i = 0; i < 3000; i++) {
      const t = pickPower(last, Math.random);
      expect(t).not.toBe(last);
      last = t;
    }
  });

  it('never drops the same type twice in a row in play, even when every roll wants to', () => {
    const r = boot();
    serve(r);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const types: PowerType[] = [];
    for (let i = 0; i < 12; i++) {
      r.g.onBrick(r.g.balls[0], r.g.bricks.find(b => b.alive && b.hp === 1)!);
      types.push(...r.g.capsules.map(c => c.type));
      r.g.capsules.length = 0;
    }
    expect(types.length).toBeGreaterThan(8);
    for (let i = 1; i < types.length; i++)
      expect(types[i]).not.toBe(types[i - 1]);
  });

  it('CATCH holds the ball on contact and lets it go on Space', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    g.powers.catch = 5;
    place(r, g.paddle.cx + 20, g.paddle.y - BALL_R - 2, 0, 300);
    r.h.game.update(1 / 60);
    expect(g.balls[0].stuck).toBe(true);
    run(r, 0.5);
    expect(g.balls[0].stuck).toBe(true);
    press(r, 'Space');
    expect(g.balls[0].stuck).toBe(false);
    expect(g.balls[0].vy).toBeLessThan(0);
    expect(g.balls[0].vx).toBeGreaterThan(0); // it sat right of centre
  });

  it('BLAST breaks the 3x3 block around the next brick it touches', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    g.powers.blast = true;
    const center = g.bricks.find(b => b.row === 2 && b.col === 4)!;
    const before = g.bricks.filter(b => b.alive).length;
    g.onBrick(g.balls[0], center);
    expect(g.bricks.filter(b => b.alive).length).toBe(before - 9);
    expect(g.powers.blast).toBe(false);
  });

  it('MULTI adds two balls, WIDEN widens, SLOW slows, all timed out', () => {
    const r = boot();
    serve(r);
    const { g } = r;
    g.collect({ x: 400, y: 552, vy: 0, type: 'multi', age: 0 });
    expect(g.balls).toHaveLength(3);
    g.collect({ x: 400, y: 552, vy: 0, type: 'widen', age: 0 });
    run(r, 0.5);
    expect(g.paddle.w).toBeCloseTo(PADDLE_WIDE_W, 0);
    g.collect({ x: 400, y: 552, vy: 0, type: 'slow', age: 0 });
    expect(g.powers.slow).toBeGreaterThan(0);
    for (const b of g.balls) {
      b.x = 400;
      b.y = 300;
      b.vx = 0;
      b.vy = -400;
    }
    const y0 = g.balls[0].y;
    r.h.game.update(0.05);
    expect(y0 - g.balls[0].y).toBeLessThan(400 * 0.05 * 0.8);
  });
});

// ---------------------------------------------------------- run flow ----
describe('the run', () => {
  it('pays one pickup for every second brick broken', () => {
    const r = boot();
    serve(r);
    for (let i = 0; i < 10; i++) {
      r.g.onBrick(r.g.balls[0], r.g.bricks.find(b => b.alive && b.hp === 1)!);
    }
    expect(r.g.bricksDestroyedThisGame).toBe(10);
    expect(r.g.pickups).toBe(5);
  });

  it('opens on the serve card, which closes on the first input or after 2s', () => {
    const idle = boot();
    expect(idle.g.cardOpen).toBe(true);
    run(idle, 1.9);
    expect(idle.g.cardOpen).toBe(true);
    run(idle, 0.15);
    expect(idle.g.cardOpen).toBe(false);

    const mover = boot();
    mover.held.add('KeyD');
    mover.h.game.update(1 / 60);
    expect(mover.g.cardOpen).toBe(false);
    expect(mover.g.gameState).toBe('ready');
  });

  it('restart returns to the first serve with every system reset', () => {
    const r = boot();
    const { g, h } = r;
    serve(r);
    g.collect({ x: 400, y: 552, vy: 0, type: 'multi', age: 0 });
    g.powers.widen = 4;
    g.onBrick(g.balls[0], g.bricks[3]);
    g.lives = 1;
    for (const b of g.balls) b.y = 700;
    run(r, GAMEOVER_BEAT + 0.2);
    expect(h.game.isGameOver?.()).toBe(true);

    h.game.restart?.();
    expect(g.gameState).toBe('ready');
    expect(g.level).toBe(1);
    expect(g.lives).toBe(START_LIVES);
    expect(g.score).toBe(0);
    expect(g.pickups).toBe(0);
    expect(g.capsules).toHaveLength(0);
    expect(g.powers).toEqual({ widen: 0, slow: 0, catch: 0, blast: false });
    expect(g.streak.count).toBe(0);
    expect(g.particles.count()).toBe(0);
    expect(g.banner).toBeNull();
    expect(g.dim).toBe(0);
    expect(g.cardOpen).toBe(true);
    expect(g.balls).toHaveLength(1);
    expect(g.balls[0].stuck).toBe(true);
    expect(requiredLeft(g.bricks)).toBe(buildLayout(1).specs.length);
    expect(h.game.isGameOver?.()).toBe(false);
  });

  it('draws the ended frame without touching the game', () => {
    const r = boot();
    const { g, h } = r;
    g.lives = 1;
    serve(r);
    for (const b of g.balls) b.y = 700;
    run(r, GAMEOVER_BEAT + 0.2);
    const fillText = h.ctx.fillText as unknown as jest.Mock;
    fillText.mockClear();
    const before = JSON.stringify({
      s: g.score,
      b: g.bricks.map(b => b.alive),
    });
    h.game.render(h.ctx);
    expect(fillText).toHaveBeenCalled();
    expect(JSON.stringify({ s: g.score, b: g.bricks.map(b => b.alive) })).toBe(
      before
    );
  });

  it('keeps the achievement keys', () => {
    const r = boot();
    const { g, h } = r;
    g.lives = 1;
    serve(r);
    for (const b of g.balls) b.y = 700;
    run(r, GAMEOVER_BEAT + 0.2);
    expect(Object.keys(h.game.getScore?.() ?? {})).toEqual(
      expect.arrayContaining([
        'bricks_broken',
        'levels_cleared',
        'powerups_collected',
        'total_bricks_broken',
        'max_level',
        'final_lives',
      ])
    );
    const stat = h.services.analytics
      .trackGameSpecificStat as unknown as jest.Mock;
    expect(stat.mock.calls.map(c => c[1])).toEqual([
      'bricks_broken',
      'levels_cleared',
      'powerups_collected',
      'total_bricks_broken',
      'max_level',
    ]);
  });
});

// Keep the imported geometry honest: a brick is shorter than two frames of
// top-speed travel, which is exactly why the substepping matters.
it('sizes a brick smaller than one clamped frame of top-speed travel', () => {
  expect(BRICK_H + 2 * BALL_R).toBeLessThan(MAX_BALL_SPEED * 0.05 + 2 * BALL_R);
  expect(BRICK_W).toBeGreaterThan(0);
});
