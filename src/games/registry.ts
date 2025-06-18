// ===== src/games/registry.ts =====
import { GameLoader } from '@/services/GameLoader';

export const gameLoader = new GameLoader();

// Register games here
gameLoader.registerGame('runner', async () => {
  const { RunnerGame } = await import('./runner/RunnerGame');
  return new RunnerGame();
});

// Future games will be registered here
// gameLoader.registerGame('puzzle', async () => {
//   const { PuzzleGame } = await import('./puzzle/PuzzleGame');
//   return new PuzzleGame();
// });