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
  mouseDown(x: number, y: number, button?: number): void;
  mouseUp(button?: number): void;
  click(x: number, y: number, button?: number, frames?: number): void;
  touchStart(x: number, y: number): void;
  touchMove(x: number, y: number): void;
  touchEnd(): void;
  tap(x: number, y: number, frames?: number): void;
  longPress(x: number, y: number, frames?: number): void;
  swipe(x: number, y: number, dx: number, dy: number, frames?: number): void;
  game(): any;
  state(): string;
  score(): number;
  isOver(): boolean;
  restart(): void;
  setAuto(on: boolean): void;
  loupe(x: number, y: number, w: number, h: number): void;
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
      '01-ready': async page => {
        await drive(page, gc => gc.step(24));
      },
      '02-play-turn': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('ArrowRight', 1);
          const cells = [];
          for (let x = 14; x >= 6; x--) cells.push({ x, y: 5 });
          for (let y = 6; y <= 12; y++) cells.push({ x: 6, y });
          for (let x = 7; x <= 17; x++) cells.push({ x, y: 12 });
          g.snake = cells;
          g.prevTail = { x: 18, y: 12 };
          g.turns.force('right');
          g.nextLengthMilestone = 40;
          g.food.setPosition(22, 3);
          g.spawnCoin();
          g.coins[0].moveTo(25, 15);
          g.stepProgress = 0;
          gc.step(3);
          gc.press('ArrowDown', 1);
          gc.step(7);
          const h = g.snake[0];
          const x = 28 + (h.x + 0.5) * 24;
          const y = 82 + (h.y + 0.5) * 24;
          (
            gc as unknown as {
              loupe(x: number, y: number, w: number, h: number): void;
            }
          ).loupe(x - 64, y - 60, 128, 96);
        });
        await page.locator('[data-testid="game-capture-loupe"]').screenshot({
          path: path.join(OUT, 'snake', '02b-head-loupe.png'),
        });
      },
      '03-eating': async page => {
        await drive(page, gc => {
          const g = gc.game();
          for (let bite = 0; bite < 2; bite++) {
            const h = g.snake[0];
            g.food.setPosition(h.x, h.y + 1);
            g.stepProgress = 0.98;
            gc.step(bite === 0 ? 10 : 8);
          }
        });
      },
      '04-feast-powerups': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('ArrowRight', 1);
          g.activePowerUps.push(
            { type: 'ghost', duration: 4.2, maxDuration: 5 },
            { type: 'magnet', duration: 7.1, maxDuration: 8 },
            { type: 'wrap', duration: 1.6, maxDuration: 8 }
          );
          for (let i = 0; i < 3; i++) g.comboSystem.addHit();
          gc.step(6);
        });
      },
      '05-tokens': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.activePowerUps.length = 0;
          g.powerUps.length = 0;
          ['wrap', 'slow', 'double', 'magnet', 'ghost'].forEach((t, i) => {
            g.spawnPowerUp(t);
            const p = g.powerUps[g.powerUps.length - 1];
            p.x = 4 + i * 2;
            p.y = 16;
          });
          g.coins.length = 0;
          g.spawnCoin();
          g.coins[0].moveTo(15, 16);
          gc.step(20);
          (
            gc as unknown as {
              loupe(x: number, y: number, w: number, h: number): void;
            }
          ).loupe(28 + 3 * 24, 82 + 15 * 24, 14 * 24, 3 * 24);
        });
        await page.locator('[data-testid="game-capture-loupe"]').screenshot({
          path: path.join(OUT, 'snake', '05b-tokens-loupe.png'),
        });
      },
      '06-speed-banner': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.powerUps.length = 0;
          g.coins.length = 0;
          g.foodEaten = 4;
          const h = g.snake[0];
          g.food.setPosition(h.x + 1, h.y);
          g.stepProgress = 0.98;
          gc.step(22);
        });
      },
      '07-wrap': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const cells = [];
          for (let x = 30; x >= 17; x--) cells.push({ x, y: 13 });
          g.snake = cells;
          g.prevTail = { x: 16, y: 13 };
          g.turns.force('right');
          g.activePowerUps.length = 0;
          g.activePowerUps.push({ type: 'wrap', duration: 6, maxDuration: 8 });
          g.food.setPosition(12, 4);
          g.stepProgress = 0;
          gc.step(31);
        });
      },
      '08-hit': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const cells = [];
          for (let x = 30; x >= 19; x--) cells.push({ x, y: 4 });
          g.snake = cells;
          g.prevTail = { x: 18, y: 4 };
          g.turns.force('right');
          g.activePowerUps.length = 0;
          g.wrapGrace = 0;
          g.invulnerableFor = 0;
          g.stepProgress = 0.99;
          gc.step(10);
        });
      },
      '09-respawn': async page => {
        await drive(page, gc => gc.step(42));
      },
      '09b-invulnerable': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('ArrowUp', 1);
          gc.step(12);
          for (let i = 0; i < 8; i++) {
            if (Math.floor(g.gameTime * 16) % 2 === 0) break;
            gc.step(1);
          }
        });
      },
      '10-dying': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('ArrowUp', 1);
          gc.step(10);
          g.invulnerableFor = 0;
          g.lives = 1;
          const cells = [];
          for (let x = 30; x >= 14; x--) cells.push({ x, y: 7 });
          for (let x = 14; x <= 26; x++) cells.push({ x, y: 8 });
          g.snake = cells;
          g.prevTail = { x: 27, y: 8 };
          g.turns.force('right');
          g.stepProgress = 0.99;
          gc.step(40);
        });
      },
      '11-ended': async page => {
        await drive(page, gc => gc.step(90));
      },
      '12-restart': async page => {
        await drive(page, gc => {
          gc.restart();
          gc.step(24);
        });
      },
    },
  },
  {
    id: 'minesweeper',
    scenes: {
      // READY: the card, then the bare board, at each size.
      '01-ready-card': async page => {
        await drive(page, gc => gc.step(1));
      },
      '02-ready-easy': async page => {
        await drive(page, gc => gc.step(130));
      },
      '03-ready-medium': async page => {
        await drive(page, gc => {
          gc.game().setDifficulty('medium');
          gc.step(2);
        });
      },
      '04-ready-hard': async page => {
        await drive(page, gc => {
          gc.game().setDifficulty('hard');
          gc.step(2);
        });
      },
      // Mouse over a key, then held down on it (tense face), then released
      // into the first cascade.
      '05-hover': async page => {
        await drive(page, gc => {
          const L = gc.game().layout;
          gc.mouseMove(L.board.x + L.cell * 9.5, L.board.y + L.cell * 6.5);
          gc.step(2);
        });
      },
      '06-pressed': async page => {
        await drive(page, gc => {
          const L = gc.game().layout;
          const m = gc as unknown as {
            mouseDown(x: number, y: number): void;
          };
          m.mouseDown(L.board.x + L.cell * 10.5, L.board.y + L.cell * 6.5);
          gc.step(3);
        });
      },
      '07-mid-cascade': async page => {
        await drive(page, gc => {
          (gc as unknown as { mouseUp(): void }).mouseUp();
          gc.step(4);
        });
      },
      '08-opened': async page => {
        await drive(page, gc => {
          gc.mouseMove(4, 4);
          gc.step(60);
        });
      },
      // Right-click three mines on the frontier; the last is mid-plant.
      '09-flags': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          let n = 0;
          for (let r = 0; r < B.rows && n < 3; r++) {
            for (let c = 0; c < B.cols && n < 3; c++) {
              const cell = B.cells[r][c];
              if (!cell.mine || cell.flagged) continue;
              const near = B.neighbours(r, c).some(
                (p: { row: number; col: number }) =>
                  B.cells[p.row][p.col].revealed
              );
              if (!near) continue;
              gc.click(
                L.board.x + L.cell * (c + 0.5),
                L.board.y + L.cell * (r + 0.5),
                2,
                1
              );
              n++;
            }
          }
          gc.step(3);
        });
      },
      // A finger held on a mine: the ring grows, then the flag plants.
      '10-long-press-ring': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          for (let r = B.rows - 1; r >= 0; r--) {
            for (let c = B.cols - 1; c >= 0; c--) {
              const cell = B.cells[r][c];
              if (!cell.mine || cell.flagged) continue;
              const near = B.neighbours(r, c).some(
                (p: { row: number; col: number }) =>
                  B.cells[p.row][p.col].revealed
              );
              if (!near) continue;
              const t = gc as unknown as {
                touchStart(x: number, y: number): void;
              };
              t.touchStart(
                L.board.x + L.cell * (c + 0.5),
                L.board.y + L.cell * (r + 0.5)
              );
              gc.step(20);
              return;
            }
          }
        });
      },
      '11-long-press-planted': async page => {
        await drive(page, gc => {
          gc.step(12);
          (gc as unknown as { touchEnd(): void }).touchEnd();
          gc.step(12);
        });
      },
      // Throw the flag-mode switch, then hold a finger on a key: the ghost
      // pennant previews what the tap will do.
      '12-flag-mode': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          const s = L.flagSwitch;
          gc.tap(s.x + s.w / 2, s.y + s.h / 2);
          gc.step(4);
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              const cell = B.cells[r][c];
              if (cell.revealed || cell.flagged || !cell.mine) continue;
              const t = gc as unknown as {
                touchStart(x: number, y: number): void;
              };
              t.touchStart(
                L.board.x + L.cell * (c + 0.5),
                L.board.y + L.cell * (r + 0.5)
              );
              gc.step(3);
              return;
            }
          }
        });
      },
      // Mode off again; hold on a number whose flags do not match: the
      // tiles it would open go down together (the peek).
      '13-chord-peek': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          (gc as unknown as { touchEnd(): void }).touchEnd();
          gc.step(20);
          const s = L.flagSwitch;
          gc.tap(s.x + s.w / 2, s.y + s.h / 2);
          gc.step(4);
          let best: { r: number; c: number; n: number } | null = null;
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              const st = B.chordState(r, c);
              if (st.kind !== 'peek') continue;
              if (!best || st.cells.length > best.n) {
                best = { r, c, n: st.cells.length };
              }
            }
          }
          if (!best) return;
          const m = gc as unknown as {
            mouseDown(x: number, y: number): void;
          };
          m.mouseDown(
            L.board.x + L.cell * (best.c + 0.5),
            L.board.y + L.cell * (best.r + 0.5)
          );
          gc.step(2);
        });
      },
      '14-keyboard': async page => {
        await drive(page, gc => {
          (gc as unknown as { mouseUp(): void }).mouseUp();
          gc.step(20);
          gc.press('ArrowLeft');
          gc.press('ArrowLeft');
          gc.press('ArrowUp');
          gc.step(4);
        });
      },
      // The loss: the hit-stop, the shockwave, BOOM, and the ended frame.
      '15-boom-hitstop': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          let pick: { r: number; c: number } | null = null;
          for (let r = 0; r < B.rows && !pick; r++) {
            for (let c = 0; c < B.cols && !pick; c++) {
              const cell = B.cells[r][c];
              const mid = Math.abs(c - B.cols / 2) < 4;
              if (cell.mine && !cell.flagged && mid) pick = { r, c };
            }
          }
          if (!pick) return;
          gc.click(
            L.board.x + L.cell * (pick.c + 0.5),
            L.board.y + L.cell * (pick.r + 0.5),
            0,
            1
          );
        });
      },
      '16-boom-shockwave': async page => {
        await drive(page, gc => gc.step(28));
      },
      '17-boom-banner': async page => {
        await drive(page, gc => gc.step(64));
      },
      '18-lost-ended': async page => {
        await drive(page, gc => gc.step(40));
      },
      // The clear: a fresh easy board opened tile by tile, three flags
      // planted by hand, the rest planted by the victory wave.
      '19-won-beat': async page => {
        await drive(page, gc => {
          gc.restart();
          const g = gc.game();
          g.setDifficulty('easy');
          gc.step(2);
          const L = g.layout;
          const at = (r: number, c: number, b = 0) =>
            gc.click(
              L.board.x + L.cell * (c + 0.5),
              L.board.y + L.cell * (r + 0.5),
              b,
              1
            );
          at(4, 4);
          gc.step(20);
          const B = g.board;
          let flags = 0;
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              if (B.cells[r][c].mine && flags < 3) {
                at(r, c, 2);
                flags++;
              }
            }
          }
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              const cell = B.cells[r][c];
              if (!cell.mine && !cell.revealed) {
                at(r, c);
                gc.step(2);
              }
            }
          }
          gc.step(40);
        });
      },
      '20-won-banner': async page => {
        await drive(page, gc => gc.step(40));
      },
      '21-won-ended': async page => {
        await drive(page, gc => gc.step(30));
      },
      // Loupes: one number tile and one planted flag, magnified.
      '22-loupe-number': async page => {
        await drive(page, gc => {
          gc.restart();
          const g = gc.game();
          g.setDifficulty('hard');
          gc.step(2);
          const L = g.layout;
          gc.click(L.board.x + L.cell * 9.5, L.board.y + L.cell * 6.5, 0, 1);
          gc.step(60);
          const B = g.board;
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              const cell = B.cells[r][c];
              if (cell.revealed && cell.neighbors >= 2) {
                const lp = gc as unknown as {
                  loupe(x: number, y: number, w: number, h: number): void;
                };
                lp.loupe(
                  L.board.x + L.cell * (c - 1),
                  L.board.y + L.cell * (r - 1),
                  L.cell * 3,
                  L.cell * 3
                );
                return;
              }
            }
          }
        });
        await page
          .locator('[data-testid="game-capture-loupe"]')
          .screenshot({ path: path.join(OUT, 'minesweeper', '22z-loupe.png') });
      },
      '23-loupe-flag': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const L = g.layout;
          const B = g.board;
          for (let r = 0; r < B.rows; r++) {
            for (let c = 0; c < B.cols; c++) {
              const cell = B.cells[r][c];
              if (!cell.mine || cell.flagged) continue;
              const near = B.neighbours(r, c).some(
                (p: { row: number; col: number }) =>
                  B.cells[p.row][p.col].revealed
              );
              if (!near) continue;
              const x = L.board.x + L.cell * (c + 0.5);
              const y = L.board.y + L.cell * (r + 0.5);
              gc.click(x, y, 2, 1);
              gc.mouseMove(4, 4);
              gc.step(30);
              const lp = gc as unknown as {
                loupe(x: number, y: number, w: number, h: number): void;
              };
              lp.loupe(
                x - L.cell * 1.5,
                y - L.cell * 1.5,
                L.cell * 3,
                L.cell * 3
              );
              return;
            }
          }
        });
        await page
          .locator('[data-testid="game-capture-loupe"]')
          .screenshot({ path: path.join(OUT, 'minesweeper', '23z-loupe.png') });
      },
      // Render cost of a mid-game hard board, tile cache on and off.
      '24-perf': async page => {
        const result = await page.evaluate(() => {
          const gc = window.__gc as unknown as {
            game(): {
              render(ctx: CanvasRenderingContext2D): void;
              boardRenderer: { cacheEnabled: boolean; lastRedraws: number };
            };
          };
          const g = gc.game();
          const canvas = document.querySelector(
            '[data-testid="game-capture-canvas"]'
          ) as HTMLCanvasElement;
          const ctx = canvas.getContext('2d')!;
          const time = (n: number): number => {
            const t0 = performance.now();
            for (let i = 0; i < n; i++) g.render(ctx);
            ctx.getImageData(0, 0, 1, 1);
            return (performance.now() - t0) / n;
          };
          g.boardRenderer.cacheEnabled = true;
          g.render(ctx);
          time(20);
          const cachedMs = time(300);
          const settledRedraws = g.boardRenderer.lastRedraws;
          g.boardRenderer.cacheEnabled = false;
          time(20);
          const uncachedMs = time(300);
          g.boardRenderer.cacheEnabled = true;
          g.render(ctx);
          return { cachedMs, uncachedMs, settledRedraws };
        });
        fs.writeFileSync(
          path.join(OUT, 'minesweeper', 'perf.json'),
          JSON.stringify(result, null, 2)
        );
      },
      // Medium in play: 29px tiles, a frontier of flags.
      '25-medium-play': async page => {
        await drive(page, gc => {
          gc.restart();
          const g = gc.game();
          g.setDifficulty('medium');
          gc.step(2);
          const L = g.layout;
          gc.click(L.board.x + L.cell * 8.5, L.board.y + L.cell * 8.5, 0, 1);
          gc.step(40);
          const B = g.board;
          let n = 0;
          for (let r = 0; r < B.rows && n < 6; r++) {
            for (let c = 0; c < B.cols && n < 6; c++) {
              const cell = B.cells[r][c];
              if (!cell.mine || cell.flagged) continue;
              const near = B.neighbours(r, c).some(
                (p: { row: number; col: number }) =>
                  B.cells[p.row][p.col].revealed
              );
              if (!near) continue;
              gc.click(
                L.board.x + L.cell * (c + 0.5),
                L.board.y + L.cell * (r + 0.5),
                2,
                1
              );
              n++;
            }
          }
          gc.mouseMove(4, 4);
          gc.step(30);
        });
      },
    },
  },
  {
    id: 'breakout',
    scenes: {
      // Floodlight court. Scenes reach into BreakoutGame's private fields
      // (gameState, balls, bricks, powers, streak, …) to jump to a moment.
      '01-ready-card': async page => {
        await drive(page, gc => gc.step(50));
      },
      '02-aim-moving': async page => {
        await drive(page, gc => {
          gc.hold('ArrowRight');
          gc.step(9);
        });
      },
      '03-rally-rail': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.release('ArrowRight');
          gc.press('Space');
          // Keep the paddle under the ball; stop on a lit rail.
          for (let i = 0; i < 600; i++) {
            const b = g.balls[0];
            if (b) g.paddle.cx = b.x;
            gc.step(1);
            if (i > 150 && g.railFlashes.length > 0 && b && b.y > 330) break;
          }
        });
      },
      '04-crack-ramp': async page => {
        await drive(page, gc => {
          const g = gc.game();
          // Four neighbours on the top row at 4/4, 3/4, 2/4 and 1/4.
          const row = g.bricks.filter(
            (b: { row: number; alive: boolean }) => b.row === 0 && b.alive
          );
          for (let i = 0; i < 4 && i < row.length; i++) {
            row[i].maxHp = 4;
            row[i].hp = 4 - i;
          }
          row[2].shake = 0.1;
          gc.step(1);
          const a = row[0];
          (
            gc as unknown as {
              loupe(x: number, y: number, w: number, h: number): void;
            }
          ).loupe(a.x - 12, a.y - 14, a.w * 4 + 18 + 24, a.h + 28);
        });
        await page.locator('[data-testid="game-capture-loupe"]').screenshot({
          path: path.join(OUT, 'breakout', '04b-crack-loupe.png'),
        });
      },
      '05-streak-x3': async page => {
        await drive(page, gc => {
          const g = gc.game();
          // Mid-flight toward the wall, seven brick hits since the paddle.
          const b = g.balls[0];
          b.x = 400;
          b.y = 430;
          b.vx = 140;
          b.vy = -380;
          b.trail = [];
          for (let i = 0; i < 7; i++) g.streak.hit();
          gc.step(12);
        });
      },
      '06-capsules-chips': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.capsules.push(
            { x: 250, y: 360, vy: 140, type: 'catch', age: 0.2 },
            { x: 420, y: 420, vy: 140, type: 'blast', age: 0.9 },
            { x: 600, y: 330, vy: 140, type: 'life', age: 1.4 }
          );
          g.powers.widen = 6.2;
          g.powers.slow = 1.4;
          g.powers.blast = true;
          gc.step(6);
        });
      },
      '07-catch-aim': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.capsules.length = 0;
          g.powers.catch = 7.5;
          g.balls.length = 1;
          const b = g.balls[0];
          b.stuck = true;
          b.stuckOffset = 0.55;
          b.stuckTime = 0.8;
          b.speed = 420;
          gc.step(4);
        });
      },
      '08-multi': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('Space');
          gc.step(20);
          g.collect({
            x: g.paddle.cx,
            y: g.paddle.y,
            vy: 0,
            type: 'multi',
            age: 0,
          });
          for (let i = 0; i < 30; i++) {
            const b = g.balls[0];
            if (b) g.paddle.cx = b.x;
            gc.step(1);
          }
        });
      },
      '09-blast': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.powers.blast = true;
          const target = g.bricks.find(
            (b: { row: number; col: number; alive: boolean }) =>
              b.alive && b.row === 2 && b.col === 4
          );
          if (target) g.onBrick(g.balls[0], target);
          gc.step(5);
        });
      },
      '09b-match-point': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const live = g.bricks.filter(
            (b: { alive: boolean; armored: boolean }) => b.alive && !b.armored
          );
          // Leave three: the beacon should find them.
          for (let i = 3; i < live.length; i++) live[i].alive = false;
          gc.step(8);
        });
      },
      '10-last-brick-slowmo': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const live = g.bricks.filter(
            (b: { alive: boolean; armored: boolean }) => b.alive && !b.armored
          );
          for (let i = 1; i < live.length; i++) live[i].alive = false;
          live[0].hp = 1;
          g.balls.length = 1;
          g.onBrick(g.balls[0], live[0]);
          gc.step(4);
        });
      },
      '11-clear-banner': async page => {
        await drive(page, gc => gc.step(40));
      },
      '12-clear-build': async page => {
        await drive(page, gc => gc.step(34));
      },
      '13-next-serve': async page => {
        await drive(page, gc => {
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          gc.step(12);
        });
      },
      '14-ball-lost': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('Space');
          gc.step(30);
          for (const b of g.balls) b.y = 640;
          gc.step(10);
        });
      },
      '15-gameover-beat': async page => {
        await drive(page, gc => {
          const g = gc.game();
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          g.lives = 1;
          gc.press('Space');
          gc.step(20);
          for (const b of g.balls) b.y = 640;
          gc.step(60);
        });
      },
      '16-ended': async page => {
        await drive(page, gc => gc.step(60));
      },
      '17-level-3-pyramid': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.restart();
          g.level = 2;
          gc.press('Space');
          for (const b of g.bricks) b.alive = false;
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          gc.step(30);
        });
      },
      '18-level-4-columns': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('Space');
          for (const b of g.bricks) b.alive = false;
          gc.step(10);
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          gc.step(30);
        });
      },
      '19-level-5-fortress': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('Space');
          for (const b of g.bricks) b.alive = false;
          gc.step(10);
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          gc.step(30);
        });
      },
      '20-level-6-shuttle': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.press('Space');
          for (const b of g.bricks) b.alive = false;
          gc.step(10);
          for (let i = 0; i < 200 && gc.state() !== 'ready'; i++) gc.step(1);
          gc.step(70);
        });
      },
    },
  },
  {
    id: 'memory',
    scenes: {
      '01-mode-card': async page => {
        await drive(page, gc => gc.step(2));
      },
      '02-dealing': async page => {
        await drive(page, gc => {
          const t = gc.game().hud.modeTickets();
          gc.click(t.classic.x + 60, t.classic.y + 50);
          gc.mouseMove(796, 300);
          gc.step(18);
        });
      },
      '03-your-turn': async page => {
        await drive(page, gc => gc.step(46));
      },
      '04-fresh-table': async page => {
        await drive(page, gc => gc.step(70));
      },
      '05-hover-lift': async page => {
        await drive(page, gc => {
          const c = gc.game().cards[5];
          gc.mouseMove(c.x + c.w / 2, c.y + c.h / 2);
          gc.step(12);
        });
      },
      '06-mid-flip': async page => {
        await drive(page, gc => {
          const c = gc.game().cards[0];
          gc.click(c.x + c.w / 2, c.y + c.h / 2);
          gc.mouseMove(796, 300);
          gc.step(1);
        });
      },
      '06b-one-flipped': async page => {
        await drive(page, gc => gc.step(20));
      },
      '07-match-pop': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const a = g.cards[0];
          const b = g.cards.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.mouseMove(796, 300);
          gc.step(14);
        });
      },
      '08-mismatch-shake': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(40);
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[0];
          const b = free.find((c: { value: number }) => c.value !== a.value);
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(15);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.mouseMove(796, 300);
          gc.step(15);
        });
      },
      '09-streak-3': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(50);
          g.streak = 2;
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[free.length - 1];
          const b = free.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(15);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.mouseMove(796, 300);
          gc.step(20);
        });
      },
      '10-peek': async page => {
        await drive(page, gc => {
          gc.step(40);
          gc.press('KeyP');
          gc.step(30);
        });
      },
      '11-hint': async page => {
        await drive(page, gc => {
          gc.step(70);
          gc.press('KeyH');
          gc.step(16);
        });
      },
      '12-table-clear': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(50);
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[0];
          const b = free.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          for (const c of free) if (c !== a && c !== b) c.matched = true;
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(15);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.mouseMove(796, 300);
          gc.step(40);
        });
      },
      '13-table-4': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.startTable(3);
          gc.step(130);
          const solved = new Set<number>();
          for (const c of g.cards) {
            if (solved.size < 5 || solved.has(c.value)) solved.add(c.value);
          }
          for (const c of g.cards) {
            if (solved.has(c.value)) {
              c.matched = true;
              c.shown = 1;
            }
          }
          const c = g.cards.find((x: { matched: boolean }) => !x.matched);
          gc.click(c.x + c.w / 2, c.y + c.h / 2);
          gc.mouseMove(796, 300);
          gc.press('ArrowRight');
          gc.press('ArrowDown');
          gc.step(24);
        });
      },
      '14-table-5-peek': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.startTable(4);
          gc.step(150);
          gc.press('KeyP');
          gc.step(30);
        });
      },
      '15-timed-low': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.restart();
          gc.press('ArrowRight');
          gc.press('Space');
          gc.step(130);
          const c = g.cards[2];
          gc.click(c.x + c.w / 2, c.y + c.h / 2);
          gc.mouseMove(796, 300);
          g.timeLeft = 8.4;
          gc.step(20);
        });
      },
      '16-time-out': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.step(40);
          g.timeLeft = 0.05;
          gc.step(40);
        });
      },
      '17-ended-time': async page => {
        await drive(page, gc => gc.step(80));
      },
      '18-perfect-run': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.restart();
          const t = g.hud.modeTickets();
          gc.click(t.classic.x + 60, t.classic.y + 50);
          gc.mouseMove(796, 300);
          g.startTable(4);
          gc.step(150);
          g.results = [1, 2, 3, 4].map(n => ({
            table: n,
            moves: n * 4 + 5,
            par: n * 4 + 6,
            seconds: 20 + n * 9,
            atPar: true,
            parBonus: 150 * n,
            timeBonus: 20,
            newBest: false,
          }));
          g.totalMoves = 70;
          g.score = 9640;
          const free = g.cards.filter((c: { matched: boolean }) => !c.matched);
          const a = free[0];
          const b = free.find(
            (c: { id: number; value: number }) =>
              c.id !== a.id && c.value === a.value
          );
          for (const c of free) {
            if (c !== a && c !== b) {
              c.matched = true;
              c.shown = 1;
            }
          }
          g.tableMoves = 18;
          gc.click(a.x + a.w / 2, a.y + a.h / 2);
          gc.step(15);
          gc.click(b.x + b.w / 2, b.y + b.h / 2);
          gc.mouseMove(796, 300);
          gc.step(40);
        });
      },
      '19-ended-cleared': async page => {
        await drive(page, gc => gc.step(90));
      },
      '20-loupe': async page => {
        await drive(page, gc => {
          const g = gc.game();
          gc.restart();
          const t = g.hud.modeTickets();
          gc.click(t.classic.x + 60, t.classic.y + 50);
          gc.mouseMove(796, 300);
          gc.step(130);
          g.cards[0].peeked = true;
          g.cards[1].peeked = true;
          gc.step(20);
          const a = g.cards[0];
          const w = a.w * 3 + g.layout.gap * 2 + 16;
          const loupe = gc as unknown as {
            loupe(x: number, y: number, w: number, h: number): void;
          };
          loupe.loupe(a.x - 8, a.y - 8, w, a.h + 16);
        });
        await page
          .locator('[data-testid="game-capture-loupe"]')
          .screenshot({ path: path.join(OUT, 'memory', '20-loupe-zoom.png') });
      },
    },
  },
  {
    // Tap Dodge. Scenes run in order on one page, so state carries forward.
    // `tdPilot` (installed in 02) is a reflex autopilot that steps the sim a
    // frame at a time and steers around the nearest row, so play scenes show
    // real flying rather than a ship parked inside a hazard.
    id: 'tapdodge',
    scenes: {
      '01-ready': async page => {
        await drive(page, gc => gc.step(24));
      },
      '02-zone1-play': async page => {
        await drive(page, gc => {
          type Pilot = (frames: number) => void;
          interface Obs {
            rowId: number;
            lane: number;
            kind: string;
            band: string;
            destroyed: boolean;
            passed: boolean;
            hitbox(): { x: number; y: number; w: number; h: number };
          }
          const w = window as unknown as { tdPilot?: Pilot };
          w.tdPilot = (frames: number) => {
            const g = gc.game();
            for (let i = 0; i < frames; i++) {
              if (g.gameState !== 'play') {
                gc.step(1);
                continue;
              }
              const ship = g.player.hitbox();
              const bottom = ship.y + ship.h;
              const rows: Record<string, Obs[]> = {};
              for (const o of g.obstacles as Obs[]) {
                if (o.destroyed || o.passed || o.hitbox().y > bottom) continue;
                rows[o.rowId] = rows[o.rowId] || [];
                rows[o.rowId].push(o);
              }
              let nearest: Obs[] | null = null;
              let front = -1e9;
              for (const id of Object.keys(rows)) {
                const list = rows[id];
                const f = Math.max(
                  ...list.map(o => o.hitbox().y + o.hitbox().h)
                );
                if (f > front) {
                  front = f;
                  nearest = list;
                }
              }
              if (nearest) {
                const laser = nearest.find(o => o.kind === 'laser');
                if (laser) {
                  const lead = (ship.y - front) / g.progression.speed();
                  if (lead < 0.14 && g.player.canDodge()) {
                    g.player.startDodge(
                      laser.band === 'high' ? 'duck' : 'jump'
                    );
                  }
                } else {
                  const blocked = nearest.map(o => o.lane);
                  let best = g.player.lane;
                  let d = 9;
                  for (let l = 0; l < 5; l++) {
                    const dist = Math.abs(l - g.player.lane);
                    if (!blocked.includes(l) && dist < d) {
                      d = dist;
                      best = l;
                    }
                  }
                  g.player.lane = best;
                }
              }
              gc.step(1);
            }
          };
          gc.game().progression.nextRushAt = 1e9;
          gc.press('Space', 1);
          w.tdPilot(330);
        });
      },
      '03-wall-gap': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.obstacles = [];
          g.spawnPattern('wall');
          for (let i = 0; i < 200; i++) {
            const wall = g.obstacles.find(
              (o: { kind: string }) => o.kind === 'wall'
            );
            if (!wall || wall.y > 330) break;
            w.tdPilot(1);
          }
        });
      },
      '04-laser-high-duck': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(90);
          g.obstacles = [];
          g.spawnPattern('laser');
          const laser = g.obstacles.find(
            (o: { kind: string }) => o.kind === 'laser'
          );
          laser.band = 'high';
          while (laser.y < g.player.y - 40) gc.step(1);
          g.player.startDodge('duck');
          while (laser.y < g.player.y - 8) gc.step(1);
        });
      },
      '05-laser-low-jump': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(40);
          g.obstacles = [];
          g.spawnPattern('laser');
          const laser = g.obstacles.find(
            (o: { kind: string }) => o.kind === 'laser'
          );
          laser.band = 'low';
          while (laser.y < g.player.y - 40) gc.step(1);
          g.player.startDodge('jump');
          while (laser.y < g.player.y - 6) gc.step(1);
        });
      },
      '06-near-miss': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(40);
          g.obstacles = [];
          g.spawnPattern('single');
          const crate = g.obstacles[g.obstacles.length - 1];
          // Sit in the crate's lane, then leave it at the last moment.
          const lane = crate.lane;
          g.player.lane = lane;
          g.player.x = 100 + 120 * lane + 60;
          while (crate.hitbox().y + crate.hitbox().h < g.player.y - 24) {
            gc.step(1);
          }
          gc.press(lane < 4 ? 'ArrowRight' : 'ArrowLeft', 1);
          for (let i = 0; i < 40 && g.slowMo <= 0; i++) gc.step(1);
          gc.step(6);
        });
      },
      '07-loupe-ship': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(60);
          const loupe = gc as unknown as {
            loupe(x: number, y: number, w: number, h: number): void;
          };
          loupe.loupe(g.player.x - 60, g.player.y - 50, 120, 90);
        });
        await page.locator('[data-testid="game-capture-loupe"]').screenshot({
          path: path.join(OUT, 'tapdodge', '07b-loupe-ship.png'),
        });
      },
      '08-loupe-drifter': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.obstacles = [];
          g.spawnPattern('drifter');
          const d = g.obstacles.find(
            (o: { kind: string }) => o.kind === 'drifter'
          );
          d.passed = true; // the autopilot ignores it; keep it clear of the ship
          while (d.y < 220) gc.step(1);
          const loupe = gc as unknown as {
            loupe(x: number, y: number, w: number, h: number): void;
          };
          loupe.loupe(d.x - 34, d.y - 22, 120, 82);
        });
        await page.locator('[data-testid="game-capture-loupe"]').screenshot({
          path: path.join(OUT, 'tapdodge', '08b-loupe-drifter.png'),
        });
      },
      '09-fever-3': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.fever.cleanTime = 31;
          w.tdPilot(150);
        });
      },
      '10-rush-inbound': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.progression.nextRushAt = g.progression.worldTime + 0.05;
          w.tdPilot(70);
        });
      },
      '11-rush': async page => {
        await drive(page, () => {
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(170);
        });
      },
      '12-zone2': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(560); // let the rush run out
          g.progression.nextRushAt = 1e9;
          g.progression.worldTime = Math.max(g.progression.worldTime, 30.5);
          w.tdPilot(80);
        });
      },
      '13-zone3': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.progression.worldTime = 59.6;
          w.tdPilot(90);
        });
      },
      '14-zone4': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.progression.worldTime = 89.6;
          w.tdPilot(90);
        });
      },
      '15-powerups': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          g.lives = 3;
          g.activatePowerUp('shield');
          g.activatePowerUp('magnet');
          g.spawnPattern('coins');
          w.tdPilot(70);
        });
      },
      '16-hit-freeze': async page => {
        await drive(page, gc => {
          const g = gc.game();
          g.activePowerUps = [];
          g.lives = 3;
          g.player.invuln = 0;
          g.obstacles = [];
          g.spawnPattern('single');
          const crate = g.obstacles[g.obstacles.length - 1];
          crate.x = g.player.x - crate.w / 2;
          crate.y = g.player.y - crate.h - 4;
          gc.step(3);
        });
      },
      '17-death-beat': async page => {
        await drive(page, gc => {
          const g = gc.game();
          const w = window as unknown as { tdPilot: (n: number) => void };
          w.tdPilot(90);
          g.player.invuln = 0;
          g.lives = 1;
          g.obstacles = [];
          g.spawnPattern('single');
          const crate = g.obstacles[g.obstacles.length - 1];
          crate.x = g.player.x - crate.w / 2;
          crate.y = g.player.y - crate.h - 4;
          gc.step(24);
        });
      },
      '18-recap': async page => {
        await drive(page, gc => gc.step(150));
      },
      '19-ended': async page => {
        await drive(page, gc => gc.step(200));
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
