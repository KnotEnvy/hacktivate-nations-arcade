// BaseGame.render after a run ends.
//
// The optional onRenderEnded hook lets a game keep its final frame on screen
// under the run shell's summary. It must be strictly additive: a game that
// does not implement it gets the same black frame it always did, and onRender
// / onRenderUI are never called for a finished run either way.

import { BaseGame } from '../BaseGame';
import type { GameManifest } from '@/lib/types';
import { initGame } from '../gameTestHarness';

class PlainGame extends BaseGame {
  manifest: GameManifest = {
    id: 'plain',
    title: 'Plain',
    thumbnail: '',
    inputSchema: ['keyboard'],
    assetBudgetKB: 1,
    tier: 0,
  };
  renders = 0;
  uiRenders = 0;
  protected onInit(): void {}
  protected onUpdate(): void {}
  protected onRender(): void {
    this.renders++;
  }
  protected onRenderUI(): void {
    this.uiRenders++;
  }
  finish(): void {
    this.endGame();
  }
}

class EndedFrameGame extends PlainGame {
  endedRenders = 0;
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    this.endedRenders++;
    ctx.fillStyle = '#123456';
  }
}

describe('BaseGame.render once the run has ended', () => {
  it('still clears to black and draws nothing for a game without the hook', () => {
    const game = new PlainGame();
    const h = initGame(game);
    h.game.render(h.ctx);
    expect(game.renders).toBe(1);
    expect(game.uiRenders).toBe(1);

    game.finish();
    h.game.render(h.ctx);
    expect(game.renders).toBe(1);
    expect(game.uiRenders).toBe(1);
    // The last fill before the early return is the black clear.
    expect(h.ctx.fillStyle).toBe('#000000');
  });

  it('calls onRenderEnded instead of onRender for a game that opts in', () => {
    const game = new EndedFrameGame();
    const h = initGame(game);
    game.finish();
    h.game.render(h.ctx);
    expect(game.endedRenders).toBe(1);
    expect(game.renders).toBe(0);
    expect(game.uiRenders).toBe(0);
    expect(h.ctx.fillStyle).toBe('#123456');
  });

  it('goes back to the live frame after restart', () => {
    const game = new EndedFrameGame();
    const h = initGame(game);
    game.finish();
    h.game.render(h.ctx);
    h.game.restart?.();
    h.game.render(h.ctx);
    expect(game.endedRenders).toBe(1);
    expect(game.renders).toBe(1);
  });
});
