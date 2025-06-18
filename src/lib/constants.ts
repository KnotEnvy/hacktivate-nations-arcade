// ===== src/lib/constants.ts =====
export const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  TARGET_FPS: 60,
  CURRENCY_RATE: 250, // coins per active minute
} as const;

export const UNLOCK_COSTS = {
  0: 0,     // Runner (default)
  1: 2000,  // +1 game
  2: 5000,  // +2 games
} as const;

export const ECONOMY = {
  SCORE_TO_COINS_RATIO: 100, // floor(score/100)
  PICKUP_COIN_VALUE: 10,
  DAILY_CHALLENGE_MULTIPLIER: 1.5,
} as const;

export const PERFORMANCE = {
  MAX_ASSET_SIZE_KB: 300,
  TARGET_FCP_MS: 2000,
  TARGET_GAME_LOAD_MS: 500,
} as const;

export const COLORS = {
  primary: '#8B5CF6',     // Purple
  secondary: '#06B6D4',   // Cyan  
  accent: '#F59E0B',      // Amber
  success: '#10B981',     // Emerald
  danger: '#EF4444',      // Red
  dark: '#1F2937',        // Gray-800
  light: '#F9FAFB',       // Gray-50
} as const;