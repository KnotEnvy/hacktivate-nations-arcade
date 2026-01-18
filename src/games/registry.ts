// ===== src/games/registry.ts =====
import { GameLoader } from '@/services/GameLoader';

export const gameLoader = new GameLoader();
// Register games here
gameLoader.registerGame('runner', async () => {
  const { RunnerGame } = await import('./runner/RunnerGame');
  return new RunnerGame();
});
gameLoader.registerGame('snake', async () => {
  const { SnakeGame } = await import('./snake/SnakeGame');
  return new SnakeGame();
});
gameLoader.registerGame('puzzle', async () => {
  const { BlockPuzzleGame } = await import('./block/BlockPuzzleGame');
  return new BlockPuzzleGame();
});
gameLoader.registerGame('space', async () => {
  const { SpaceShooterGame } = await import('./space/SpaceShooterGame');
  return new SpaceShooterGame();
});
gameLoader.registerGame('asteroids', async () => {
  const { AsteroidsGame } = await import('./asteroids/AsteroidsGame');
  return new AsteroidsGame();
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
gameLoader.registerGame('mini-golf', async () => {
  const { MiniGolfGame } = await import('./mini-golf/MiniGolfGame');
  return new MiniGolfGame();
});
gameLoader.registerGame('color-drop', async () => {
  const { ColorDropGame } = await import('./color-drop/ColorDropGame');
  return new ColorDropGame();
});
gameLoader.registerGame('tower-builder', async () => {
  const { TowerBuilderGame } = await import('./tower-builder/TowerBuilderGame');
  return new TowerBuilderGame();
});
gameLoader.registerGame('frog-hop', async () => {
  const { FrogHopGame } = await import('./frog-hop/FrogHopGame');
  return new FrogHopGame();
});
gameLoader.registerGame('bubble', async () => {
  const { BubblePopGame } = await import('./bubble/BubblePopGame');
  return new BubblePopGame();
});
gameLoader.registerGame('bowling', async () => {
  const { BowlingGame } = await import('./bowling/BowlingGame');
  return new BowlingGame();
});

// Future games will be registered here
// gameLoader.registerGame('puzzle', async () => {
//   const { PuzzleGame } = await import('./puzzle/PuzzleGame');
//   return new PuzzleGame();
// });
