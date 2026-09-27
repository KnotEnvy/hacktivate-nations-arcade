// The row rules, pinned on the spawner itself and then measured on the
// live road. These are RULES, not tuning: change the pattern weights or the
// gaps as much as you like, and these must still hold.

import { TapDodgeGame } from '../TapDodgeGame';
import { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import {
  HAZARD_SIZE,
  LASER_CLEARANCE,
  MAX_SAFE_STEP,
  MIN_ROW_GAP,
  PatternSpawner,
  ROW_FLOOR_SECONDS,
  RowSpec,
  SpawnContext,
} from '../systems/PatternSpawner';
import {
  BASE_SPEED,
  MAX_SPEED,
  Progression,
  speedFactorAt,
} from '../systems/Progression';
import { LANE_W, ROAD_X, SPAWN_Y, mulberry32 } from '../systems/layout';
import { initGame } from '@/games/shared/gameTestHarness';

const ALL = [0, 1, 2, 3, 4];

/** Drive the spawner the way the game does, across every zone and rushes. */
function generate(
  seed: number,
  count: number
): Array<{ row: RowSpec; ctx: SpawnContext }> {
  const spawner = new PatternSpawner(seed);
  const rnd = mulberry32(seed + 99);
  const out: Array<{ row: RowSpec; ctx: SpawnContext }> = [];
  for (let i = 0; i < count; i++) {
    const worldTime = rnd() * 300;
    const rush = rnd() < 0.25;
    const ctx: SpawnContext = {
      zone: Math.min(3, Math.floor(worldTime / 30)),
      worldTime,
      speed: BASE_SPEED * speedFactorAt(worldTime) * (rush ? 1.15 : 1),
      rush,
    };
    out.push({ row: spawner.next(ctx), ctx });
  }
  return out;
}

describe('every pattern row', () => {
  const rows = [1, 2, 3, 4, 5].flatMap(seed => generate(seed, 1200));

  it('leaves at least one safe lane, and a blocked lane is never "safe"', () => {
    for (const { row } of rows) {
      expect(row.safe.length).toBeGreaterThan(0);
      for (const lane of row.safe) expect(row.blocked).not.toContain(lane);
      for (const h of row.hazards) {
        if (h.kind === 'laser') expect(h.lane).toBe(-1);
        else expect(row.blocked).toContain(h.lane);
      }
      expect(row.blocked.length).toBeLessThan(5);
    }
  });

  it('keeps consecutive safe lanes within two hops of each other', () => {
    for (const seed of [11, 12, 13]) {
      const seq = generate(seed, 2000).map(r => r.row);
      for (let i = 1; i < seq.length; i++) {
        const prev = seq[i - 1].safe;
        const free = ALL.filter(l => !seq[i].blocked.includes(l));
        for (const s of prev) {
          const step = Math.min(...free.map(t => Math.abs(s - t)));
          expect(step).toBeLessThanOrEqual(MAX_SAFE_STEP);
        }
      }
    }
  });

  it('never stacks a laser with anything else', () => {
    for (const { row } of rows) {
      if (row.hazards.some(h => h.kind === 'laser')) {
        expect(row.hazards).toHaveLength(1);
        expect(row.pickups).toHaveLength(0);
        expect(row.blocked).toHaveLength(0);
      }
    }
  });

  it('never schedules less than the floor of clear road, at any speed', () => {
    // The floor is stated in seconds at the fastest the road can ever go,
    // so it holds at every speed at or under that.
    expect(MIN_ROW_GAP / MAX_SPEED).toBeCloseTo(ROW_FLOOR_SECONDS, 6);
    for (const { row, ctx } of rows) {
      expect(row.gapAfter).toBeGreaterThanOrEqual(MIN_ROW_GAP);
      expect(row.gapAfter / ctx.speed).toBeGreaterThanOrEqual(
        ROW_FLOOR_SECONDS
      );
      expect(row.gapAfter / MAX_SPEED).toBeGreaterThanOrEqual(
        ROW_FLOOR_SECONDS
      );
    }
  });

  it('gives a laser a full dodge-and-cooldown of road on either side', () => {
    const seq = generate(21, 4000);
    for (let i = 1; i < seq.length; i++) {
      const laserHere = seq[i].row.pattern === 'laser';
      const laserBefore = seq[i - 1].row.pattern === 'laser';
      if (laserHere || laserBefore) {
        const gap = seq[i - 1].row.gapAfter;
        expect(gap / seq[i - 1].ctx.speed).toBeGreaterThanOrEqual(
          LASER_CLEARANCE - 1e-9
        );
      }
    }
  });
});

describe('the road speed', () => {
  it('ramps to a stated cap and never passes MAX_SPEED, rushes included', () => {
    const p = new Progression();
    let top = 0;
    for (let i = 0; i < 60 * 600; i++) {
      p.update(1 / 60);
      top = Math.max(top, p.speed());
    }
    expect(top).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
    expect(speedFactorAt(240)).toBeCloseTo(2.1, 6);
    expect(speedFactorAt(600)).toBeCloseTo(2.1, 6);
    // 120s+ still means something: it is faster at 200s than at 120s.
    expect(speedFactorAt(200)).toBeGreaterThan(speedFactorAt(120));
  });
});

interface Live {
  gameState: string;
  lives: number;
  player: Player;
  obstacles: Obstacle[];
  progression: Progression;
}

describe('on the live road', () => {
  it('rows share one speed and keep their scheduled spacing', () => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(mulberry32(5));
    const h = initGame(new TapDodgeGame());
    const g = h.game as unknown as Live;
    g.gameState = 'play';
    g.progression.worldTime = 100;

    let checkedPairs = 0;
    for (let i = 0; i < 60 * 120; i++) {
      // Keep the ship alive and out of the way: this test watches the road.
      g.lives = 3;
      g.player.setInvulnerable(10);
      const before = new Map(g.obstacles.map(o => [o, o.y] as const));
      h.game.update(1 / 60);
      if (g.gameState !== 'play') break;

      // One speed: every hazard that existed before the frame moved by the
      // same amount (the ship takes no hit-freeze while invulnerable).
      const moves = g.obstacles
        .filter(o => before.has(o))
        .map(o => o.y - (before.get(o) ?? 0));
      for (const m of moves) expect(m).toBeCloseTo(moves[0], 6);

      // Spacing: clear road between each row's back edge and the next
      // row's front edge never drops under the floor distance.
      const rows = new Map<number, { top: number; bottom: number }>();
      for (const o of g.obstacles) {
        const r = rows.get(o.rowId) ?? { top: Infinity, bottom: -Infinity };
        r.top = Math.min(r.top, o.y);
        r.bottom = Math.max(r.bottom, o.y + o.h);
        rows.set(o.rowId, r);
      }
      const ids = [...rows.keys()].sort((a, b) => a - b);
      for (let k = 1; k < ids.length; k++) {
        if (ids[k] !== ids[k - 1] + 1) continue; // a coin line sat between
        const ahead = rows.get(ids[k - 1])!;
        const behind = rows.get(ids[k])!;
        expect(ahead.top - behind.bottom).toBeGreaterThanOrEqual(
          MIN_ROW_GAP - 0.5
        );
        checkedPairs++;
      }
    }
    expect(checkedPairs).toBeGreaterThan(500);
    spy.mockRestore();
  });

  it('a new row is born behind the gantry and slides in from under it', () => {
    const o = new Obstacle('crate', 2, 1, SPAWN_Y);
    expect(o.y + o.h).toBe(SPAWN_Y);
  });
});

describe('the drifter', () => {
  it('patrols inside its own lane and never reaches the next one', () => {
    for (let lane = 0; lane < 5; lane++) {
      const d = new Obstacle('drifter', lane, 1, 100, null, lane * 1.3);
      const left = ROAD_X + lane * LANE_W;
      const right = left + LANE_W;
      for (let i = 0; i < 600; i++) {
        d.update(0, 1 / 60);
        const b = d.hitbox();
        expect(b.x).toBeGreaterThanOrEqual(left);
        expect(b.x + b.w).toBeLessThanOrEqual(right);
        expect(d.x).toBeGreaterThanOrEqual(left);
        expect(d.x + HAZARD_SIZE.drifter.w).toBeLessThanOrEqual(right);
      }
    }
  });
});
