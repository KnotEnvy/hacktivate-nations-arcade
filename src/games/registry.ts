// ===== src/games/registry.ts =====
import { GameLoader } from '@/services/GameLoader';

export const gameLoader = new GameLoader();

// Register games here
gameLoader.registerGame('runner', async () => {
  const { RunnerGame } = await import('./runner/RunnerGame');
  return new RunnerGame();
});
// Register Snake game
gameLoader.registerGame('snake', async () => {
  const { SnakeGame } = await import('./snake/SnakeGame');
  return new SnakeGame();
});
// Register Block Puzzle game
gameLoader.registerGame('puzzle', async () => {
  const { BlockPuzzleGame } = await import('./block/BlockPuzzleGame');
  return new BlockPuzzleGame();
});

// Register Space Shooter game
gameLoader.registerGame('space', async () => {
  const { SpaceShooterGame } = await import('./space/SpaceShooterGame');
  return new SpaceShooterGame();
});

// Future games will be registered here
// gameLoader.registerGame('puzzle', async () => {
//   const { PuzzleGame } = await import('./puzzle/PuzzleGame');
//   return new PuzzleGame();
// });
