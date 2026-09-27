import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Tier 0 — the eye.
//
// Drives the dev-only generic capture harness (src/dev/game-capture) and
// writes one PNG per named scene to .captures/tier0/<game>/. These frames are
// for grading how a game LOOKS; they are NOT assertions about pixels, and this
// spec is deliberately NOT in the CI gate (DOCS/START-HERE.md — the lean gate
// is a deliberate choice, not an oversight).
//
// Run:  npx playwright test tier0-capture --project=chromium
//       CAPTURE_GAMES=snake,memory npx playwright test tier0-capture --project=chromium
//
// Each scene script runs inside the page against window.__gc (see
// GameCaptureControl). Scene scripts reach into a game's private fields to
// jump straight to a moment (a boss, a death, a power-up), so when a game's
// internals change, its scenes here change with it.

const OUT = path.resolve(process.cwd(), '.captures', 'tier0');
const SEED = process.env.CAPTURE_SEED ?? '1337';
const ONLY = (process.env.CAPTURE_GAMES ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

declare global {
  interface Window {
    __gc?: { ready: boolean };
  }
}

type Scene = (page: Page) => Promise<void>;

interface GameScript {
  id: string;
  scenes: Record<string, Scene>;
}

async function boot(page: Page, id: string): Promise<void> {
  await page.goto(`/dev/game?game=${id}&seed=${SEED}`);
  await page.waitForFunction(() => window.__gc?.ready === true, undefined, {
    timeout: 60_000,
  });
  await expect(
    page.locator('[data-testid="game-capture-canvas"]')
  ).toBeVisible();
}

async function capture(page: Page, script: GameScript): Promise<void> {
  const dir = path.join(OUT, script.id);
  fs.mkdirSync(dir, { recursive: true });
  const canvas = page.locator('[data-testid="game-capture-canvas"]');

  await boot(page, script.id);
  for (const [name, scene] of Object.entries(script.scenes)) {
    await scene(page);
    await canvas.screenshot({ path: path.join(dir, `${name}.png`) });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The control surface the harness exposes, as scene scripts see it. */
interface GC {
  step(n: number, dt?: number): void;
  press(code: string, frames?: number): void;
  hold(code: string): void;
  release(code: string): void;
  mouseMove(x: number, y: number): void;
  click(x: number, y: number, button?: number, frames?: number): void;
  tap(x: number, y: number, frames?: number): void;
  longPress(x: number, y: number, frames?: number): void;
  swipe(x: number, y: number, dx: number, dy: number, frames?: number): void;
  game(): any;
  state(): string;
  restart(): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Run `fn` INSIDE the page with the harness control as its argument. The
 * function is serialised, so it must not close over anything from this file.
 */
function drive(page: Page, fn: (gc: GC) => void): Promise<void> {
  return page.evaluate(`(${fn.toString()})(window.__gc)`) as Promise<void>;
}

const SCRIPTS: GameScript[] = [
  {
    id: 'snake',
    scenes: {
      '01-start': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-play': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.spawnCoin?.();
          g.spawnPowerUp?.();
          gc.step(30);
          gc.press('ArrowUp', 3);
          gc.step(30);
          gc.press('ArrowLeft', 3);
          gc.step(40);
          gc.press('ArrowDown', 3);
          gc.step(20);
        });
      },
      '03-powerups-combo': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.activePowerUps?.push(
            { type: 'ghost', duration: 5, maxDuration: 5 },
            { type: 'magnet', duration: 8, maxDuration: 8 }
          );
          for (let i = 0; i < 4; i++) g.comboSystem?.addHit?.();
          gc.step(5);
        });
      },
      '04-hit': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.handleCollision?.();
          gc.step(8);
        });
      },
      '05-death': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.isInvulnerable = false;
          g.lives = 1;
          g.handleCollision?.();
          gc.step(30);
        });
      },
    },
  },
  {
    id: 'minesweeper',
    scenes: {
      '01-board': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-reveal': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const x = g.offsetX + g.cellSize * (Math.floor(g.cols / 2) + 0.5);
          const y = g.offsetY + g.cellSize * (Math.floor(g.rows / 2) + 0.5);
          gc.mouseMove(x, y);
          gc.click(x, y);
          gc.step(45);
        });
      },
      '03-flag': async page => {
        await drive(page, gc => {
          const g = gc.game();
          for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
              const cell = g.board[r][c];
              if (!cell.revealed) {
                const x = g.offsetX + g.cellSize * (c + 0.5);
                const y = g.offsetY + g.cellSize * (r + 0.5);
                gc.click(x, y, 2);
                gc.step(20);
                return;
              }
            }
          }
        });
      },
      '04-boom': async page => {
        await drive(page, gc => {
          const g = gc.game();
          for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
              const cell = g.board[r][c];
              if (cell.mine && !cell.flagged) {
                const x = g.offsetX + g.cellSize * (c + 0.5);
                const y = g.offsetY + g.cellSize * (r + 0.5);
                gc.click(x, y);
                gc.step(40);
                return;
              }
            }
          }
        });
      },
      '05-lost': async page => {
        await drive(page, gc => gc.step(130));
      },
      '06-medium': async page => {
        await drive(page, gc => {
          gc.restart();
          gc.game().setDifficulty?.('medium');
          gc.step(2);
        });
      },
      '07-hard': async page => {
        await drive(page, gc => {
          gc.game().setDifficulty?.('hard');
          gc.step(2);
        });
      },
    },
  },
  {
    id: 'breakout',
    scenes: {
      '01-ready': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-play': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(90);
          for (let i = 0; i < 240; i++) {
            const b = g.balls?.[0];
            if (b && g.paddle) g.paddle.x = b.x - g.paddle.w / 2;
            gc.step(1);
          }
        });
      },
      '03-powerup': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.powerups?.push({
            x: 380,
            y: 300,
            w: 18,
            h: 18,
            vy: 120,
            type: 'multi',
          });
          g.powerups?.push({
            x: 480,
            y: 340,
            w: 18,
            h: 18,
            vy: 120,
            type: 'life',
          });
          gc.step(10);
        });
      },
      '04-ball-lost': async page => {
        await drive(page, gc => {
          const g = gc.game();
          for (const b of g.balls ?? []) {
            b.y = 640;
          }
          gc.step(12);
        });
      },
      '05-level-up': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(100);
          for (const b of g.bricks ?? []) b.alive = false;
          gc.step(6);
        });
      },
    },
  },
  {
    id: 'memory',
    scenes: {
      '01-board': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-flip': async page => {
        await drive(page, gc => {
          const c = gc.game().cards[0];
          gc.click(c.x + c.w / 2, c.y + c.h / 2);
          gc.step(20);
        });
      },
      '03-match': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const a = g.cards[0];
          const b = g.cards.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.step(50);
        });
      },
      '04-mismatch': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[0];
          const b = free.find((c: { value: number }) => c.value !== a.value);
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(15);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.step(12);
        });
      },
      '05-win': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(60);
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[0];
          const b = free.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          for (const c of free) if (c !== a && c !== b) c.matched = true;
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(10);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.step(30);
        });
      },
    },
  },
  {
    id: 'tapdodge',
    scenes: {
      '01-ready': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-play': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('ArrowLeft', 3);
          for (let i = 0; i < 240; i++) {
            g.lives = 3;
            gc.step(1);
          }
        });
      },
      '03-laser': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.spawnLaser?.();
          for (let i = 0; i < 90; i++) {
            g.lives = 3;
            gc.step(1);
          }
        });
      },
      '04-zone3-fever': async page => {
        await drive(page, gc => {
          const g = gc.game();
          if (g.waveSystem) g.waveSystem.gameTime = 61;
          if (g.feverSystem) g.feverSystem.cleanSurvivalTime = 31;
          for (let i = 0; i < 60; i++) {
            g.lives = 3;
            gc.step(1);
          }
        });
      },
      '05-powerups': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.activatePowerUp?.('shield');
          g.activatePowerUp?.('magnet');
          for (let i = 0; i < 10; i++) {
            g.lives = 3;
            gc.step(1);
          }
        });
      },
      '06-recap': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.triggerGameOver?.();
          gc.step(150);
        });
      },
    },
  },
];

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

for (const script of SCRIPTS) {
  if (ONLY.length > 0 && !ONLY.includes(script.id)) continue;
  test(`capture ${script.id}`, async ({ page }) => {
    test.setTimeout(180_000);
    await capture(page, script);
  });
}
