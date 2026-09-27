// Mini Breakout — do the rules add up?
//
// The rules suite checks each rule alone. These put a reflex bot on the
// keyboard (see testing/bot.ts: it sees the ball late, never predicts, and
// meets it off-centre like a person) and check the run as a whole:
//
//   * doing nothing ends the run, but not at once — every lost serve plays
//     its beat, and a still paddle cannot rally forever (MIN_OFF_VERTICAL)
//   * a player who tracks the ball can keep it in play and make progress
//   * the coin flow per cleared wall stays in the band the brief set
//
// If a tuning change makes the ball unreturnable, the bot's floor drops and
// these fail; if it makes idling profitable, the first one fails.

import { boot, seedRandom } from '../testing/rig';
import { playBot } from '../testing/bot';
import { LOST_BEAT, START_LIVES } from '../constants';

afterEach(() => jest.restoreAllMocks());

describe('playability', () => {
  it('ends an idle run by itself, one beat per lost serve', () => {
    seedRandom(1);
    const r = boot();
    const states: string[] = [];
    let t = 0;
    for (; t < 120 && !r.h.game.isGameOver?.(); t += 1 / 60) {
      r.h.game.update(1 / 60);
      if (states[states.length - 1] !== r.g.gameState) {
        states.push(r.g.gameState);
      }
    }
    expect(r.h.game.isGameOver?.()).toBe(true);
    // Not immediately: three auto-serves, three flights, three beats.
    expect(t).toBeGreaterThan(START_LIVES * (3 + LOST_BEAT));
    expect(states.filter(s => s === 'lost')).toHaveLength(START_LIVES - 1);
    expect(states[states.length - 1]).toBe('gameover');
  });

  it('lets a tracking player keep the ball in play and work through the wall', () => {
    const results = [1, 2, 3, 4].map(seed => {
      seedRandom(seed);
      const res = playBot(boot(), 180, 0.1);
      jest.restoreAllMocks();
      return res;
    });
    const avgBricks =
      results.reduce((s, r) => s + r.bricks, 0) / results.length;
    const avgTime = results.reduce((s, r) => s + r.seconds, 0) / results.length;
    // Half the first wall, at least, and most of three minutes survived.
    expect(avgBricks).toBeGreaterThanOrEqual(35);
    expect(avgTime).toBeGreaterThanOrEqual(120);
  });

  it('pays within the brief band for a three-minute run', () => {
    const results = [1, 2, 3, 4].map(seed => {
      seedRandom(seed);
      const res = playBot(boot(), 180, 0.1);
      jest.restoreAllMocks();
      return res;
    });
    for (const r of results) {
      // One pickup per two bricks: the coin flow is halved, not per brick.
      expect(r.pickups).toBe(Math.floor(r.bricks / 2));
      // A cleared first wall is ~280 coins; three minutes never pays twice that.
      expect(r.coins).toBeLessThan(560);
    }
  });
});
