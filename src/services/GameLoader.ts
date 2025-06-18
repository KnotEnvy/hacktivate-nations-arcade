// ===== src/services/GameLoader.ts =====
import { GameModule } from '@/games/shared/GameModule';

export class GameLoader {
  private loadedGames: Map<string, () => Promise<GameModule>> = new Map();

  registerGame(id: string, loader: () => Promise<GameModule>): void {
    this.loadedGames.set(id, loader);
  }

  async loadGame(id: string): Promise<GameModule | null> {
    const loader = this.loadedGames.get(id);
    if (!loader) {
      console.error(`Game ${id} not found in registry`);
      return null;
    }

    try {
      const game = await loader();
      return game;
    } catch (error) {
      console.error(`Failed to load game ${id}:`, error);
      return null;
    }
  }

  getAvailableGames(): string[] {
    return Array.from(this.loadedGames.keys());
  }
}
