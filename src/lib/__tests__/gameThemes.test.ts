import { GAME_THEMES, getGameTheme } from '@/lib/gameThemes';
import type { GameTheme } from '@/lib/gameThemes';

describe('Game Themes', () => {
  describe('GAME_THEMES constant', () => {
    test('contains all expected theme IDs', () => {
      const expectedThemes = ['runner', 'puzzle', 'snake', 'space', 'memory', 'default'];
      const actualThemes = Object.keys(GAME_THEMES);
      
      expectedThemes.forEach(theme => {
        expect(actualThemes).toContain(theme);
      });
    });

    test('each theme has required properties', () => {
      Object.values(GAME_THEMES).forEach((theme: GameTheme) => {
        // Basic properties
        expect(theme.id).toBeDefined();
        expect(theme.name).toBeDefined();
        expect(typeof theme.name).toBe('string');
        
        // Colors object with all required fields
        expect(theme.colors).toBeDefined();
        expect(theme.colors.primary).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.secondary).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.accent).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.background).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.surface).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.text).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.textSecondary).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.success).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.warning).toMatch(/^#[0-9A-F]{6}$/i);
        expect(theme.colors.error).toMatch(/^#[0-9A-F]{6}$/i);
        
        // Fonts object
        expect(theme.fonts).toBeDefined();
        expect(theme.fonts.primary).toBeDefined();
        expect(theme.fonts.secondary).toBeDefined();
        expect(theme.fonts.mono).toBeDefined();
        
        // Effects object
        expect(theme.effects).toBeDefined();
        expect(typeof theme.effects.glow).toBe('boolean');
        expect(typeof theme.effects.particles).toBe('boolean');
        expect(typeof theme.effects.scanlines).toBe('boolean');
        expect(typeof theme.effects.chromatic).toBe('boolean');
        
        // Animations object
        expect(theme.animations).toBeDefined();
        expect(theme.animations.fast).toBeDefined();
        expect(theme.animations.medium).toBeDefined();
        expect(theme.animations.slow).toBeDefined();
      });
    });
  });

  describe('specific themes', () => {
    test('runner theme has correct neon styling', () => {
      const runner = GAME_THEMES.runner;
      
      expect(runner.name).toBe('Neon Sprint');
      expect(runner.colors.primary).toBe('#00FFFF'); // Electric cyan
      expect(runner.colors.secondary).toBe('#39FF14'); // Neon green
      expect(runner.fonts.primary).toBe('var(--font-orbitron)');
      expect(runner.effects.glow).toBe(true);
      expect(runner.effects.particles).toBe(true);
    });

    test('snake theme has retro arcade styling', () => {
      const snake = GAME_THEMES.snake;
      
      expect(snake.name).toBe('Retro Arcade');
      expect(snake.colors.primary).toBe('#00FF00'); // Classic green
      expect(snake.colors.background).toBe('#000000'); // Pure black
      expect(snake.fonts.primary).toBe('var(--font-vt323)');
      expect(snake.effects.glow).toBe(false);
      expect(snake.effects.scanlines).toBe(true);
    });

    test('memory theme has elegant card styling', () => {
      const memory = GAME_THEMES.memory;
      
      expect(memory.name).toBe('Elegant Cards');
      expect(memory.colors.primary).toBe('#800020'); // Burgundy
      expect(memory.colors.accent).toBe('#FFD700'); // Gold
      expect(memory.fonts.primary).toBe('var(--font-playfair-display)');
      expect(memory.effects.glow).toBe(false);
      expect(memory.effects.particles).toBe(false);
    });

    test('space theme has cosmic styling', () => {
      const space = GAME_THEMES.space;
      
      expect(space.name).toBe('Cosmic Command');
      expect(space.colors.primary).toBe('#00AAFF'); // Space blue
      expect(space.fonts.primary).toBe('var(--font-rajdhani)');
      expect(space.effects.glow).toBe(true);
      expect(space.effects.particles).toBe(true);
    });

    test('default theme provides fallback styling', () => {
      const defaultTheme = GAME_THEMES.default;
      
      expect(defaultTheme.name).toBe('Arcade Classic');
      expect(defaultTheme.colors.primary).toBe('#9333EA'); // Purple
      expect(defaultTheme.fonts.primary).toBe('Inter, sans-serif');
      expect(defaultTheme.effects.glow).toBe(false);
    });
  });

  describe('getGameTheme function', () => {
    test('returns correct theme for valid game ID', () => {
      const runnerTheme = getGameTheme('runner');
      expect(runnerTheme).toEqual(GAME_THEMES.runner);
      expect(runnerTheme.name).toBe('Neon Sprint');
    });

    test('returns correct theme for all valid game IDs', () => {
      const validGameIds = ['runner', 'puzzle', 'snake', 'space', 'memory'];
      
      validGameIds.forEach(gameId => {
        const theme = getGameTheme(gameId);
        expect(theme.id).toBe(gameId);
        expect(theme).toEqual(GAME_THEMES[gameId]);
      });
    });

    test('returns default theme for invalid game ID', () => {
      const theme = getGameTheme('nonexistent-game');
      expect(theme).toEqual(GAME_THEMES.default);
      expect(theme.name).toBe('Arcade Classic');
    });

    test('returns default theme for empty string', () => {
      const theme = getGameTheme('');
      expect(theme).toEqual(GAME_THEMES.default);
    });

    test('returns default theme for null/undefined', () => {
      const theme1 = getGameTheme(null as any);
      const theme2 = getGameTheme(undefined as any);
      
      expect(theme1).toEqual(GAME_THEMES.default);
      expect(theme2).toEqual(GAME_THEMES.default);
    });
  });

  describe('theme color validation', () => {
    test('all colors are valid hex codes', () => {
      Object.values(GAME_THEMES).forEach((theme: GameTheme) => {
        Object.values(theme.colors).forEach((color: string) => {
          expect(color).toMatch(/^#[0-9A-F]{6}$/i);
          expect(color.length).toBe(7); // Including the #
        });
      });
    });

    test('no duplicate primary colors across themes', () => {
      const primaryColors = Object.values(GAME_THEMES).map(theme => theme.colors.primary);
      const uniqueColors = [...new Set(primaryColors)];
      
      expect(uniqueColors.length).toBe(primaryColors.length);
    });
  });

  describe('font CSS variables', () => {
    test('all fonts use CSS variable format', () => {
      Object.values(GAME_THEMES).forEach((theme: GameTheme) => {
        // Primary and secondary fonts should either be CSS variables or fallback fonts
        if (theme.fonts.primary.includes('var(')) {
          expect(theme.fonts.primary).toMatch(/var\(--font-[\w-]+\)/);
        }
        
        if (theme.fonts.secondary.includes('var(')) {
          expect(theme.fonts.secondary).toMatch(/var\(--font-[\w-]+\)/);
        }
        
        if (theme.fonts.mono.includes('var(')) {
          expect(theme.fonts.mono).toMatch(/var\(--font-[\w-]+\)/);
        }
      });
    });
  });

  describe('animation timing functions', () => {
    test('all animations have valid CSS timing values', () => {
      Object.values(GAME_THEMES).forEach((theme: GameTheme) => {
        // Should contain time units and easing functions
        expect(theme.animations.fast).toMatch(/\d+(\.\d+)?s/);
        expect(theme.animations.medium).toMatch(/\d+(\.\d+)?s/);
        expect(theme.animations.slow).toMatch(/\d+(\.\d+)?s/);
      });
    });

    test('animation durations are in logical order', () => {
      Object.values(GAME_THEMES).forEach((theme: GameTheme) => {
        const fast = parseFloat(theme.animations.fast);
        const medium = parseFloat(theme.animations.medium);
        const slow = parseFloat(theme.animations.slow);
        
        expect(fast).toBeLessThanOrEqual(medium);
        expect(medium).toBeLessThanOrEqual(slow);
      });
    });
  });
});