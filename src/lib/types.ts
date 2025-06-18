// ===== src/lib/types.ts =====
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