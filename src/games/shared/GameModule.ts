// ===== src/games/shared/GameModule.ts =====
import { GameManifest, Services, GameScore } from '@/lib/types';

export interface GameModule {
  init(canvas: HTMLCanvasElement, services: Services): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  
  // Lifecycle hooks
  pause?(): void;
  resume?(): void;
  resize?(width: number, height: number): void;
  destroy?(): void;
  
  // Game state
  isGameOver?(): boolean;
  getScore?(): GameScore;
  restart?: () => void;
  
  
  // Metadata
  manifest: GameManifest;
}
