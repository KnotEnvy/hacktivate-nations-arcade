// ===== src/services/GameLoader.ts =====
import { GameModule } from '@/games/shared/GameModule';

export class GameLoader {
  private loadedGames: Map<string, () => Promise<GameModule>> = new Map();
  private preloadPromises: Map<string, Promise<void>> = new Map();

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

  preloadGame(id: string): Promise<void> {
    const loader = this.loadedGames.get(id);
    if (!loader) {
      return Promise.resolve();
    }

    const existing = this.preloadPromises.get(id);
    if (existing) {
      return existing;
    }

    const promise = loader()
      .then(() => undefined)
      .catch(error => {
        this.preloadPromises.delete(id);
        console.warn(`Failed to preload game ${id}:`, error);
      });

    this.preloadPromises.set(id, promise);
    return promise;
  }

  preloadGames(ids: string[]): Promise<void[]> {
    return Promise.all(ids.map(id => this.preloadGame(id)));
  }

  getAvailableGames(): string[] {
    return Array.from(this.loadedGames.keys());
  }
}
