// ===== src/lib/types.ts =====
import { InputManager } from '@/services/InputManager';
import { AudioManager } from '@/services/AudioManager';
import { Analytics } from '@/services/Analytics';
import { CurrencyService } from '@/services/CurrencyService';
import { AchievementService } from '@/services/AchievementService';

export type InputType = 'keyboard' | 'touch' | 'gamepad';

export interface GameManifest {
  id: string;           // unique kebab-case
  title: string;
  thumbnail: string;    // 512×512 png path
  inputSchema: InputType[];
  assetBudgetKB: number; // ≤ 300
  tier: number;         // unlock tier (0 = default)
  description?: string;
}

export interface Services {
  input: InputManager;
  audio: AudioManager;
  analytics: Analytics;
  currency: CurrencyService;
  achievements: AchievementService;
}

export interface GameModule {
  init(canvas: HTMLCanvasElement, services: Services): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  
  // Lifecycle hooks
  pause?(): void;
  resume?(): void;
  resize?(width: number, height: number): void;
  destroy?(): void;
  isGameOver?: () => boolean;
  getScore?: () => GameScore;
  restart?: () => void;
    
  
  // Metadata
  manifest: GameManifest;
}

export interface GameScore {
  score: number;
  pickups: number;
  timePlayedMs: number;
  coinsEarned: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  gameId?: string; // null for cross-game challenges
  target: number;
  progress: number;
  reward: number;
  expiresAt: Date;
}

export interface UserProgress {
  level: number;
  totalCoins: number;
  unlockedTiers: number[];
  achievements: string[];
  lastPlayedAt: Date;
}