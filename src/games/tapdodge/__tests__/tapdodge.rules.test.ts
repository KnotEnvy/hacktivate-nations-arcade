// Tap Dodge rules. Each block names the bug from the polish brief that it
// pins; every one of these failed (or could not be written) against the
// game as it was.

import fs from 'fs';
import path from 'path';
import {
  COIN_POINTS,
  DEATH_BEAT,
  GEM_POINTS,
  HIT_FREEZE,
  NEAR_MISS_SCALE,
  READY_MIN_INPUT,
  READY_SECONDS,
  RECAP_SECONDS,
  RUSH_POINTS,
  SURVIVAL_POINTS,
  TapDodgeGame,
} from '../TapDodgeGame';
import { Coin } from '../entities/Coin';
import { Gem } from '../entities/Gem';
import { NEAR_MISS_PX, Obstacle } from '../entities/Obstacle';
import { DODGE_COOLDOWN, DODGE_TIME, Player } from '../entities/Player';
import type { PowerUpType } from '../entities/PowerUp';
import type { ComboSystem } from '../systems/ComboSystem';
import { NEAR_MISS_POINTS } from '../systems/ComboSystem';
import type { FeverSystem } from '../systems/FeverSystem';
import type { PatternSpawner } from '../systems/PatternSpawner';
import type { Progression } from '../systems/Progression';
import { RUSH_LENGTH, RUSH_WARNING } from '../systems/Progression';
import { SHIP_Y, laneCenter } from '../systems/layout';
import { gradeRun } from '../systems/RecapRenderer';
import { initGame, Harness } from '@/games/shared/gameTestHarness';

interface Internals {
  gameState: string;
  phaseTime: number;
  lives: number;
  runTime: number;
  score: number;
  pickups: number;
  isPaused: boolean;
  renderBaseHud: boolean;
  freeze: number;
  slowMo: number;
  extendedGameData: Record<string, unknown> | null;
  player: Player;
  obstacles: Obstacle[];
  coins: Coin[];
  gems: Gem[];
  progression: Progression;
  spawner: PatternSpawner;
  combo: ComboSystem;
  fever: FeverSystem;
  takeHit(): void;
  timeScale(): number;
  activatePowerUp(type: PowerUpType): void;
}

interface Input {
  isKeyPressed: jest.Mock;
  getTouches: jest.Mock;
}

const DT = 1 / 60;

function rig() {
  const h: Harness = initGame(new TapDodgeGame());
  const g = h.game as unknown as Internals;
  const input = h.services.input as unknown as Input;
  const keys = new Set<string>();
  let touches: Array<{ id: number; x: number; y: number }> = [];
  input.isKeyPressed.mockImplementation((c: string) => keys.has(c));
  input.getTouches.mockImplementation(() => touches);

  const frame = (n = 1, dt = DT) => {
    for (let i = 0; i < n; i++) h.game.update(dt);
  };
  const seconds = (s: number) => frame(Math.round(s / DT));
  const press = (code: string) => {
    keys.add(code);
    frame();
    keys.delete(code);
    frame();
  };
  const touch = (x: number, y: number) => {
    touches = [{ id: 1, x, y }];
    frame();
  };
  const lift = () => {
    touches = [];
    frame();
  };
  /** Start the run, with no rows spawning unless a test adds them. */
  const play = () => {
    g.spawner.advance = () => [];
    seconds(READY_MIN_INPUT);
    press('Space');
    expect(g.gameState).toBe('play');
  };
  return { h, g, keys, frame, seconds, press, touch, lift, play };
}

/** A crate whose hitbox sits `gap` px right of the settled ship's hitbox. */
function crateBeside(gap: number, bottomY: number): Obstacle {
  const o = new Obstacle('crate', 3, 900, bottomY);
  const shipRight = laneCenter(2) + 15;
  o.x = shipRight + gap - 4; // the crate's hitbox is inset 4px
  return o;
}

describe('bug 4: the base HUD is off', () => {
  it('never draws the platform Score/Coins overlay', () => {
    const { h, g } = rig();
    expect(g.renderBaseHud).toBe(false);
    const fillText = h.ctx.fillText as jest.Mock;
    fillText.mockClear();
    h.game.render(h.ctx);
    const texts = fillText.mock.calls.map(c => String(c[0]));
    expect(texts.some(t => /^(Score|Coins):/.test(t))).toBe(false);
  });
});

describe('the READY beat', () => {
  it('ignores a key still held from the shell Start button', () => {
    const r = rig();
    r.keys.add('Enter');
    r.frame(3);
    expect(r.g.gameState).toBe('ready');
    r.keys.delete('Enter');
    r.seconds(READY_MIN_INPUT);
    r.press('Enter');
    expect(r.g.gameState).toBe('play');
  });

  it('opens on READY and ends on the first key, which does not also hop', () => {
    const r = rig();
    r.frame(30);
    expect(r.g.gameState).toBe('ready');
    expect(r.g.obstacles).toHaveLength(0);
    r.press('ArrowLeft');
    expect(r.g.gameState).toBe('play');
    expect(r.g.player.lane).toBe(2);
  });

  it(`ends by itself within ${READY_SECONDS}s`, () => {
    const r = rig();
    r.seconds(READY_SECONDS - 0.05);
    expect(r.g.gameState).toBe('ready');
    r.seconds(0.1);
    expect(r.g.gameState).toBe('play');
  });

  it('a tap starts the run without also hopping on release', () => {
    const r = rig();
    r.seconds(READY_MIN_INPUT);
    r.touch(90, 300);
    expect(r.g.gameState).toBe('play');
    r.lift();
    r.frame(5);
    expect(r.g.player.lane).toBe(2);
  });
});

describe('bug 1: touch can dodge lasers, and dodges are edges', () => {
  it('swipe up jumps and swipe down ducks', () => {
    const r = rig();
    r.play();
    r.touch(400, 420);
    r.touch(400, 400);
    r.touch(400, 370);
    expect(r.g.player.dodge).toBe('jump');
    r.lift();
    r.seconds(DODGE_TIME + DODGE_COOLDOWN + 0.05);
    expect(r.g.player.dodge).toBeNull();
    r.touch(400, 300);
    r.touch(400, 322);
    r.touch(400, 350);
    expect(r.g.player.dodge).toBe('duck');
    // Neither swipe was also a tap or a drag.
    expect(r.g.player.lane).toBe(2);
  });

  it('re-arms after each swipe: one hold can flick up, then down', () => {
    const r = rig();
    r.play();
    r.touch(400, 400);
    r.touch(400, 350);
    expect(r.g.player.dodge).toBe('jump');
    r.seconds(DODGE_TIME + DODGE_COOLDOWN + 0.05); // finger still down
    r.touch(400, 380);
    r.touch(400, 400);
    expect(r.g.player.dodge).toBe('duck');
    expect(r.g.player.dodgesStarted).toBe(2);
  });

  it('a held key does not chain dodges', () => {
    const r = rig();
    r.play();
    r.keys.add('ArrowUp');
    r.seconds(3);
    expect(r.g.player.dodgesStarted).toBe(1);
    r.keys.delete('ArrowUp');
    r.keys.add('KeyS');
    r.seconds(3);
    expect(r.g.player.dodgesStarted).toBe(2);
  });

  it(`a dodge lasts ${DODGE_TIME}s and cools down for ${DODGE_COOLDOWN}s`, () => {
    const r = rig();
    r.play();
    r.press('ArrowUp'); // two frames
    r.seconds(DODGE_TIME - 0.06);
    expect(r.g.player.isJumping()).toBe(true);
    r.seconds(0.05);
    expect(r.g.player.isJumping()).toBe(false);
    // Too early: this press expires before the cooldown ends.
    r.press('ArrowDown');
    r.seconds(0.4);
    expect(r.g.player.dodgesStarted).toBe(1);
  });

  it('a press just before the cooldown ends is buffered, not dropped', () => {
    const r = rig();
    r.play();
    r.press('ArrowUp');
    r.seconds(DODGE_TIME + DODGE_COOLDOWN - 0.12);
    r.press('ArrowDown');
    r.seconds(0.2);
    expect(r.g.player.dodgesStarted).toBe(2);
  });

  it('a jump clears a LOW beam, a duck a HIGH one, and the wrong move is a hit', () => {
    for (const [band, key, ok] of [
      ['low', 'ArrowUp', true],
      ['high', 'ArrowDown', true],
      ['high', 'ArrowUp', false],
    ] as const) {
      const r = rig();
      r.play();
      const laser = new Obstacle('laser', -1, 901, SHIP_Y - 40, band);
      r.g.obstacles.push(laser);
      while (laser.y + laser.h < SHIP_Y - 15 - 10) r.frame();
      r.press(key);
      r.seconds(1);
      expect(r.g.lives).toBe(ok ? 3 : 2);
      expect(r.g.combo.getClears()).toBe(ok ? 1 : 0);
    }
  });
});

describe('bug 2: the ship lives on lanes', () => {
  it('keyboard hops are edge-triggered: holding a key hops once', () => {
    const r = rig();
    r.play();
    r.keys.add('ArrowLeft');
    r.seconds(1);
    expect(r.g.player.lane).toBe(1);
  });

  it('two quick presses hop twice', () => {
    const r = rig();
    r.play();
    r.press('ArrowRight');
    r.press('KeyD');
    expect(r.g.player.lane).toBe(4);
  });

  it('presses during a freeze are buffered, three deep', () => {
    const r = rig();
    r.play();
    r.g.player.lane = 4;
    r.g.freeze = 1;
    for (let i = 0; i < 5; i++) r.press('ArrowLeft');
    expect(r.g.player.lane).toBe(4);
    r.seconds(1);
    expect(r.g.player.lane).toBe(1);
  });

  it('a tap on the left or right third hops one lane; the middle does not', () => {
    const r = rig();
    r.play();
    r.touch(90, 300);
    r.lift();
    expect(r.g.player.lane).toBe(1);
    r.touch(720, 300);
    r.lift();
    expect(r.g.player.lane).toBe(2);
    r.touch(400, 300);
    r.lift();
    expect(r.g.player.lane).toBe(2);
  });

  it('a drag steers to the lane under the finger, snapped', () => {
    const r = rig();
    r.play();
    r.touch(400, 300);
    r.touch(370, 300);
    r.touch(250, 300);
    r.touch(131, 300);
    expect(r.g.player.lane).toBe(0);
    r.touch(335, 300);
    expect(r.g.player.lane).toBe(1);
    r.lift();
    r.seconds(0.5);
    expect(r.g.player.x).toBe(laneCenter(1));
  });

  it('always settles exactly on a lane centre, whatever the input', () => {
    const r = rig();
    r.play();
    const rnd = (() => {
      let a = 7;
      return () => (a = (a * 16807) % 2147483647) / 2147483647;
    })();
    for (let round = 0; round < 40; round++) {
      const kind = rnd();
      if (kind < 0.35) r.press(rnd() < 0.5 ? 'ArrowLeft' : 'ArrowRight');
      else if (kind < 0.6) {
        r.touch(120 + rnd() * 560, 300);
        r.touch(120 + rnd() * 560, 300);
        r.touch(120 + rnd() * 560, 300);
        r.lift();
      } else if (kind < 0.8) {
        r.touch(rnd() * 800, 300);
        r.lift();
      } else {
        r.press('ArrowRight');
        r.press('ArrowRight');
      }
      r.seconds(0.4);
      expect(r.g.player.settled()).toBe(true);
      expect(r.g.player.x).toBe(laneCenter(r.g.player.lane));
    }
  });
});

describe('bug 9: a near miss is a real skill read', () => {
  function pass(gap: number) {
    const r = rig();
    r.play();
    const o = crateBeside(gap, SHIP_Y - 120);
    r.g.obstacles.push(o);
    r.seconds(2.5);
    return { r, o };
  }

  it(`fires within ${NEAR_MISS_PX}px of the hitbox edge`, () => {
    const { r } = pass(10);
    expect(r.g.combo.getNearMisses()).toBe(1);
    expect(pass(NEAR_MISS_PX).r.g.combo.getNearMisses()).toBe(1);
  });

  it('does not fire on an ordinary pass a little further out', () => {
    expect(pass(NEAR_MISS_PX + 1).r.g.combo.getNearMisses()).toBe(0);
    expect(pass(35).r.g.combo.getNearMisses()).toBe(0);
  });

  it('fires once per obstacle, however long it lingers', () => {
    const { r, o } = pass(8);
    expect(o.nearMissed).toBe(true);
    r.seconds(2);
    expect(r.g.combo.getNearMisses()).toBe(1);
  });

  it('is earned by leaving a lane at the last moment', () => {
    const r = rig();
    r.play();
    const o = new Obstacle('crate', 2, 902, SHIP_Y - 200);
    r.g.obstacles.push(o);
    const shipTop = SHIP_Y - 15;
    while (o.hitbox().y + o.hitbox().h < shipTop - 7) r.frame();
    r.press('ArrowRight');
    r.seconds(1);
    expect(r.g.lives).toBe(3);
    expect(r.g.combo.getNearMisses()).toBe(1);
  });

  it('is not paid for an early, safe dodge', () => {
    const r = rig();
    r.play();
    const o = new Obstacle('crate', 2, 903, SHIP_Y - 260);
    r.g.obstacles.push(o);
    r.frame(10);
    r.press('ArrowRight');
    r.seconds(2);
    expect(r.g.combo.getNearMisses()).toBe(0);
  });

  it(`slows the world to ${NEAR_MISS_SCALE}x for 0.4s and pays ${NEAR_MISS_POINTS} a chain link`, () => {
    const r = rig();
    r.play();
    const before = r.g.score;
    let slowSeen = false;
    r.g.obstacles.push(crateBeside(6, SHIP_Y - 120));
    r.g.obstacles.push(crateBeside(6, SHIP_Y - 420));
    for (let i = 0; i < 180; i++) {
      r.frame();
      if (r.g.slowMo > 0) {
        slowSeen = true;
        expect(r.g.timeScale()).toBeCloseTo(NEAR_MISS_SCALE, 6);
      }
    }
    expect(slowSeen).toBe(true);
    expect(r.g.combo.getNearMisses()).toBe(2);
    expect(r.g.combo.getMaxChain()).toBe(2);
    const survival = r.g.score - before - NEAR_MISS_POINTS * (1 + 2);
    expect(survival).toBeLessThan(SURVIVAL_POINTS * 3.2);
  });

  it('a touch is a hit, never a near miss', () => {
    const r = rig();
    r.play();
    r.g.obstacles.push(new Obstacle('crate', 2, 904, SHIP_Y - 60));
    r.seconds(1.5);
    expect(r.g.lives).toBe(2);
    expect(r.g.combo.getNearMisses()).toBe(0);
  });
});

describe('bugs 5 and 6: time is game time', () => {
  it('survival time excludes a pause', () => {
    const r = rig();
    r.play();
    r.seconds(2);
    const before = r.g.runTime;
    r.h.game.pause?.();
    r.seconds(10);
    expect(r.g.runTime).toBe(before);
    r.h.game.resume?.();
    r.seconds(1);
    expect(r.g.runTime).toBeCloseTo(before + 1, 1);
  });

  it('survival time excludes the READY card and the death beat', () => {
    const r = rig();
    // No rows: a random early hit would add a 90ms freeze to the sums.
    r.g.spawner.advance = () => [];
    r.seconds(1);
    r.press('Space');
    expect(r.g.gameState).toBe('play');
    r.seconds(3);
    const lived = r.g.runTime;
    expect(lived).toBeCloseTo(3, 1);
    r.g.lives = 1;
    r.g.takeHit();
    r.seconds(3);
    expect(r.g.runTime).toBe(lived);
  });

  it('the source uses no wall clock, no timers, no hard-coded frame step', () => {
    const root = path.join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (f === '__tests__') continue;
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect([f, /Date\.now|performance\.now/.test(src)]).toEqual([f, false]);
      expect([f, /setTimeout|setInterval/.test(src)]).toEqual([f, false]);
      expect([f, /\b1\s*\/\s*60\b/.test(src)]).toEqual([f, false]);
      // Platform type only, no emoji, no in-game pause keys, no boss.
      expect([f, /\bArial\b|\bmonospace\b/.test(src)]).toEqual([f, false]);
      expect([f, /\p{Extended_Pictographic}/u.test(src)]).toEqual([f, false]);
      expect([f, /'Escape'|'KeyP'/.test(src)]).toEqual([f, false]);
      expect([f, /['"`][^'"`\n]*BOSS/i.test(src)]).toEqual([f, false]);
    }
  });
});

describe('bug 7: the lane warning system is gone', () => {
  it('no longer exists', () => {
    const p = path.join(__dirname, '..', 'systems', 'LaneWarningSystem.ts');
    expect(fs.existsSync(p)).toBe(false);
  });
});

describe('bug 8: the RUSH', () => {
  it('warns, runs faster for its length, and pays on survival', () => {
    const r = rig();
    r.play();
    const p = r.g.progression;
    p.nextRushAt = p.worldTime + 0.01;
    r.frame(2);
    expect(p.rushPhase).toBe('warning');
    const cruising = p.speed();
    r.seconds(RUSH_WARNING + 1);
    expect(p.rushPhase).toBe('active');
    expect(p.speed()).toBeGreaterThan(cruising * 1.1);
    const before = r.g.score;
    r.seconds(RUSH_LENGTH);
    expect(p.rushPhase).toBe('idle');
    expect(p.rushesCleared).toBe(1);
    expect(r.g.score - before).toBeGreaterThanOrEqual(RUSH_POINTS);
  });

  it('a run that ends mid-rush does not clear it', () => {
    const r = rig();
    r.play();
    r.g.progression.nextRushAt = r.g.progression.worldTime;
    r.seconds(RUSH_WARNING + 2);
    r.g.lives = 1;
    r.g.takeHit();
    r.seconds(RUSH_LENGTH);
    expect(r.g.progression.rushesCleared).toBe(0);
  });
});

describe('bug 10: the shell owns pause', () => {
  it('Escape and P do nothing in-game', () => {
    const r = rig();
    r.play();
    r.press('Escape');
    r.press('KeyP');
    expect(r.g.isPaused).toBe(false);
    expect(r.g.gameState).toBe('play');
  });
});

describe('hits', () => {
  it('freeze the sim for 90ms, cost a life, reset fever and break the chain', () => {
    const r = rig();
    r.play();
    r.g.fever.cleanTime = 25;
    r.frame();
    expect(r.g.fever.level).toBe(2);
    r.g.combo.addNearMiss();
    const o = new Obstacle('crate', 0, 905, 200);
    r.g.obstacles.push(o);
    r.g.takeHit();
    expect(r.g.freeze).toBeCloseTo(HIT_FREEZE, 6);
    const y = o.y;
    r.frame(4);
    expect(o.y).toBe(y);
    r.frame(3);
    expect(o.y).toBeGreaterThan(y);
    expect(r.g.lives).toBe(2);
    expect(r.g.fever.level).toBe(0);
    expect(r.g.combo.getChain()).toBe(0);
    expect(r.g.player.isInvulnerable()).toBe(true);
  });

  it('a shield soaks exactly one', () => {
    const r = rig();
    r.play();
    r.g.activatePowerUp('shield');
    r.g.takeHit();
    expect(r.g.lives).toBe(3);
    r.seconds(1);
    r.g.takeHit();
    expect(r.g.lives).toBe(2);
  });
});

describe('the end of a run', () => {
  function kill(r: ReturnType<typeof rig>) {
    r.play();
    r.seconds(2);
    r.g.lives = 1;
    r.g.takeHit();
    expect(r.g.gameState).toBe('dying');
  }

  it('runs a 1.2-2.0s death beat, then the recap, then endGame after 4s', () => {
    const r = rig();
    kill(r);
    let beat = 0;
    while (r.g.gameState === 'dying') {
      r.frame();
      beat += DT;
    }
    expect(beat).toBeGreaterThanOrEqual(1.2);
    expect(beat).toBeLessThanOrEqual(2.0);
    expect(beat).toBeCloseTo(DEATH_BEAT, 1);
    expect(r.g.gameState).toBe('recap');
    expect(r.h.game.isGameOver?.()).toBe(false);

    r.seconds(RECAP_SECONDS - 0.1);
    expect(r.h.game.isGameOver?.()).toBe(false);
    r.seconds(0.2);
    expect(r.h.game.isGameOver?.()).toBe(true);
    expect(r.h.services.currency.addCoins).toHaveBeenCalled();
  });

  it('a press skips the recap, but not in its first half-second', () => {
    const r = rig();
    kill(r);
    r.seconds(DEATH_BEAT + 0.05);
    expect(r.g.gameState).toBe('recap');
    r.press('Space');
    expect(r.g.gameState).toBe('recap');
    r.seconds(0.6);
    r.press('Space');
    expect(r.h.game.isGameOver?.()).toBe(true);
  });

  it('reports every achievement key, and survival in game seconds', () => {
    const r = rig();
    kill(r);
    r.seconds(DEATH_BEAT + RECAP_SECONDS + 0.2);
    const score = r.h.game.getScore?.() as unknown as Record<string, unknown>;
    for (const key of [
      'survival_time',
      'near_misses',
      'max_near_chain',
      'coins_collected',
      'gems_collected',
      'max_combo',
      'zone_reached',
      'max_fever_level',
    ]) {
      expect(score).toHaveProperty(key);
    }
    expect(score.survival_time as number).toBeCloseTo(2, 1);
    const track = r.h.services.analytics.trackGameSpecificStat as jest.Mock;
    const keys = track.mock.calls.map(c => c[1]);
    expect(keys).toEqual(
      expect.arrayContaining([
        'survival_time',
        'near_misses',
        'coins_collected',
        'gems_collected',
        'max_combo',
        'max_fever',
      ])
    );
    expect(localStorage.getItem('tapdodge_best')).toBe(String(r.g.score));
  });

  it('draws a still, dimmed final frame once ended', () => {
    const r = rig();
    kill(r);
    r.seconds(DEATH_BEAT + RECAP_SECONDS + 0.2);
    const fillRect = r.h.ctx.fillRect as jest.Mock;
    // jsdom shares one mock context between every canvas, so the first
    // frame also paints the scenery caches through it; warm them first.
    r.h.game.render(r.h.ctx);
    fillRect.mockClear();
    r.h.game.render(r.h.ctx);
    const calls = fillRect.mock.calls.length;
    expect(calls).toBeGreaterThan(5);
    r.h.game.render(r.h.ctx);
    expect(fillRect.mock.calls.length).toBe(calls * 2);
  });

  it('restart returns to READY with everything reset', () => {
    const r = rig();
    kill(r);
    r.seconds(DEATH_BEAT + RECAP_SECONDS + 0.2);
    r.h.game.restart?.();
    expect(r.g.gameState).toBe('ready');
    expect(r.g.lives).toBe(3);
    expect(r.g.runTime).toBe(0);
    expect(r.g.score).toBe(0);
    expect(r.g.pickups).toBe(0);
    expect(r.g.obstacles).toHaveLength(0);
    expect(r.g.progression.worldTime).toBe(0);
    expect(r.g.progression.rushesCleared).toBe(0);
    expect(r.g.fever.level).toBe(0);
    expect(r.g.combo.getNearMisses()).toBe(0);
    expect(r.g.player.lane).toBe(2);
    expect(r.g.extendedGameData).toBeNull();
    expect(r.h.game.isGameOver?.()).toBe(false);
  });
});

describe('rendering', () => {
  it('never changes the game', () => {
    const r = rig();
    r.play();
    r.g.obstacles.push(new Obstacle('drifter', 1, 906, 300));
    r.seconds(1);
    const snap = () =>
      JSON.stringify([
        r.g.score,
        r.g.runTime,
        r.g.phaseTime,
        r.g.player.x,
        r.g.obstacles.map(o => [o.x, o.y]),
      ]);
    const before = snap();
    for (let i = 0; i < 5; i++) r.h.game.render(r.h.ctx);
    expect(snap()).toBe(before);
  });
});

describe('the economy', () => {
  it(`pays ${SURVIVAL_POINTS}/s times fever, ${COIN_POINTS} a coin and ${GEM_POINTS} a gem`, () => {
    const r = rig();
    r.play();
    let before = r.g.score;
    r.seconds(1);
    expect(r.g.score - before).toBeGreaterThanOrEqual(SURVIVAL_POINTS - 1);
    expect(r.g.score - before).toBeLessThanOrEqual(SURVIVAL_POINTS + 1);

    r.g.fever.cleanTime = 20; // HOT: x2
    r.frame();
    before = r.g.score;
    r.seconds(1);
    expect(r.g.score - before).toBeGreaterThanOrEqual(2 * SURVIVAL_POINTS - 1);
    expect(r.g.score - before).toBeLessThanOrEqual(2 * SURVIVAL_POINTS + 1);

    before = r.g.score;
    r.g.coins.push(new Coin(laneCenter(2), SHIP_Y));
    r.frame();
    expect(r.g.pickups).toBe(1);
    expect(r.g.score - before).toBeGreaterThanOrEqual(COIN_POINTS);
    expect(r.g.score - before).toBeLessThan(COIN_POINTS + 3);

    before = r.g.score;
    r.g.gems.push(new Gem(laneCenter(2), SHIP_Y));
    r.frame();
    expect(r.g.pickups).toBe(2);
    expect(r.g.score - before).toBeGreaterThanOrEqual(GEM_POINTS);
    expect(r.g.score - before).toBeLessThan(GEM_POINTS + 3);
  });

  it('grades a run from survival, near misses and fever', () => {
    const base = {
      score: 0,
      best: 0,
      newBest: false,
      coins: 0,
      gems: 0,
      maxFeverName: '',
      zone: 0,
      zoneName: '',
      rushes: 0,
      maxChain: 0,
    };
    expect(
      gradeRun({ ...base, survival: 12, nearMisses: 0, maxFever: 1 }).letter
    ).toBe('D');
    expect(
      gradeRun({ ...base, survival: 180, nearMisses: 12, maxFever: 4 }).letter
    ).toBe('S');
    const mid = gradeRun({
      ...base,
      survival: 70,
      nearMisses: 3,
      maxFever: 3,
    }).letter;
    expect(['A', 'B']).toContain(mid);
  });
});
