// ===== src/games/registry.ts =====
import { GameLoader } from '@/services/GameLoader';

export const gameLoader = new GameLoader();

// Register games here
gameLoader.registerGame('runner', async () => {
  const { RunnerGame } = await import('./runner/RunnerGame');
  return new RunnerGame();
});
// Register Block Puzzle game
gameLoader.registerGame('puzzle', async () => {
  const { BlockPuzzleGame } = await import('./block/BlockPuzzleGame');
  return new BlockPuzzleGame();
});

// Tier 0 placeholder games
gameLoader.registerGame('snake', async () => {
  const { SnakeGame } = await import('./snake/SnakeGame');
  return new SnakeGame();
});
gameLoader.registerGame('breakout', async () => {
  const { BreakoutGame } = await import('./breakout/BreakoutGame');
  return new BreakoutGame();
});
gameLoader.registerGame('memory', async () => {
  const { MemoryMatchGame } = await import('./memory/MemoryMatchGame');
  return new MemoryMatchGame();
});
gameLoader.registerGame('tapdodge', async () => {
  const { TapDodgeGame } = await import('./tapdodge/TapDodgeGame');
  return new TapDodgeGame();
});
gameLoader.registerGame('minesweeper', async () => {
  const { MinesweeperGame } = await import('./minesweeper/MinesweeperGame');
  return new MinesweeperGame();
});

// Future games will be registered here
// gameLoader.registerGame('puzzle', async () => {
//   const { PuzzleGame } = await import('./puzzle/PuzzleGame');
//   return new PuzzleGame();
// });
