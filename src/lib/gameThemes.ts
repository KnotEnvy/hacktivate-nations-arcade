// ===== src/lib/gameThemes.ts =====

export interface GameTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  effects: {
    glow: boolean;
    particles: boolean;
    scanlines: boolean;
    chromatic: boolean;
  };
  animations: {
    fast: string;
    medium: string;
    slow: string;
  };
}

export const GAME_THEMES: Record<string, GameTheme> = {
  runner: {
    id: 'runner',
    name: 'Neon Sprint',
    colors: {
      primary: '#00FFFF',      // Electric cyan
      secondary: '#39FF14',    // Neon green
      accent: '#BF00FF',       // Electric purple
      background: '#0A0A0F',   // Deep dark blue
      surface: '#1A1A2E',     // Dark surface
      text: '#FFFFFF',         // White
      textSecondary: '#B0B0B0', // Light gray
      success: '#39FF14',      // Neon green
      warning: '#FFD700',      // Gold
      error: '#FF1744',        // Neon red
    },
    fonts: {
      primary: 'var(--font-orbitron)',
      secondary: 'var(--font-exo)',
      mono: 'var(--font-source-code-pro)',
    },
    effects: {
      glow: true,
      particles: true,
      scanlines: false,
      chromatic: true,
    },
    animations: {
      fast: '0.1s cubic-bezier(0.4, 0.0, 0.2, 1)',
      medium: '0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
      slow: '0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
    },
  },

  puzzle: {
    id: 'puzzle',
    name: 'Neon Grid',
    colors: {
      primary: '#FF1493',      // Hot pink
      secondary: '#00FFFF',    // Cyan
      accent: '#FFFF00',       // Electric yellow
      background: '#1A0A1A',   // Dark purple
      surface: '#2D1B2D',     // Purple surface
      text: '#FFFFFF',         // White
      textSecondary: '#C0C0C0', // Silver
      success: '#00FFFF',      // Cyan
      warning: '#FFFF00',      // Yellow
      error: '#FF1493',        // Hot pink
    },
    fonts: {
      primary: 'var(--font-tomorrow)',
      secondary: 'var(--font-space-mono)',
      mono: 'var(--font-fira-code)',
    },
    effects: {
      glow: true,
      particles: false,
      scanlines: true,
      chromatic: false,
    },
    animations: {
      fast: '0.15s ease-out',
      medium: '0.4s ease-in-out',
      slow: '0.8s ease-in-out',
    },
  },

  snake: {
    id: 'snake',
    name: 'Retro Arcade',
    colors: {
      primary: '#00FF00',      // Classic green
      secondary: '#FFFF00',    // Yellow
      accent: '#FF00FF',       // Magenta
      background: '#000000',   // Pure black
      surface: '#1A1A1A',     // Dark gray
      text: '#00FF00',         // Green text
      textSecondary: '#FFFF00', // Yellow text
      success: '#00FF00',      // Green
      warning: '#FFFF00',      // Yellow
      error: '#FF0000',        // Red
    },
    fonts: {
      primary: 'var(--font-vt323)',
      secondary: 'var(--font-courier-prime)',
      mono: 'var(--font-anonymous-pro)',
    },
    effects: {
      glow: false,
      particles: false,
      scanlines: true,
      chromatic: false,
    },
    animations: {
      fast: '0.05s linear',
      medium: '0.2s linear',
      slow: '0.5s linear',
    },
  },

  space: {
    id: 'space',
    name: 'Cosmic Command',
    colors: {
      primary: '#00AAFF',      // Space blue
      secondary: '#0099CC',    // Deep blue
      accent: '#FFAA00',       // Orange
      background: '#0B1426',   // Deep space
      surface: '#1B2B3D',     // Dark blue surface
      text: '#E0E0FF',         // Light blue-white
      textSecondary: '#A0A0BB', // Muted blue
      success: '#00FF99',      // Green
      warning: '#FFAA00',      // Orange
      error: '#FF4444',        // Red
    },
    fonts: {
      primary: 'var(--font-rajdhani)',
      secondary: 'var(--font-audiowide)',
      mono: 'var(--font-share-tech-mono)',
    },
    effects: {
      glow: true,
      particles: true,
      scanlines: false,
      chromatic: false,
    },
    animations: {
      fast: '0.2s ease-out',
      medium: '0.5s ease-in-out',
      slow: '1s ease-in-out',
    },
  },

  memory: {
    id: 'memory',
    name: 'Elegant Cards',
    colors: {
      primary: '#800020',      // Burgundy
      secondary: '#A0002A',    // Deep red
      accent: '#FFD700',       // Gold
      background: '#2F1B1B',   // Dark burgundy
      surface: '#4A2C2C',     // Burgundy surface
      text: '#F5F5DC',         // Cream
      textSecondary: '#D4AF37', // Gold text
      success: '#228B22',      // Forest green
      warning: '#FFD700',      // Gold
      error: '#DC143C',        // Crimson
    },
    fonts: {
      primary: 'var(--font-playfair-display)',
      secondary: 'var(--font-crimson-text)',
      mono: 'var(--font-inconsolata)',
    },
    effects: {
      glow: false,
      particles: false,
      scanlines: false,
      chromatic: false,
    },
    animations: {
      fast: '0.3s ease-out',
      medium: '0.6s ease-in-out',
      slow: '1.2s ease-in-out',
    },
  },

  // Default theme for unthemed games
  default: {
    id: 'default',
    name: 'Arcade Classic',
    colors: {
      primary: '#9333EA',      // Purple
      secondary: '#7C3AED',    // Light purple
      accent: '#EC4899',       // Pink
      background: '#111827',   // Dark gray
      surface: '#1F2937',     // Gray surface
      text: '#FFFFFF',         // White
      textSecondary: '#9CA3AF', // Light gray
      success: '#10B981',      // Green
      warning: '#F59E0B',      // Orange
      error: '#EF4444',        // Red
    },
    fonts: {
      primary: 'Inter, sans-serif',
      secondary: 'Inter, sans-serif',
      mono: 'var(--font-jetbrains-mono)',
    },
    effects: {
      glow: false,
      particles: false,
      scanlines: false,
      chromatic: false,
    },
    animations: {
      fast: '0.15s ease-out',
      medium: '0.3s ease-in-out',
      slow: '0.6s ease-in-out',
    },
  },
};

export function getGameTheme(gameId: string): GameTheme {
  return GAME_THEMES[gameId] || GAME_THEMES.default;
}