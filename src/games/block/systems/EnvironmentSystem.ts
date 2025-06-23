export type EnvironmentTheme = 'classic' | 'neon' | 'ice' | 'retro' | 'dusk';

export class EnvironmentSystem {
  private currentTheme: EnvironmentTheme = 'classic';

  updateTheme(level: number): void {
    const themes: EnvironmentTheme[] = ['classic', 'neon', 'ice', 'retro', 'dusk'];
    const index = Math.floor((level - 1)); //change theme every level
    this.currentTheme = themes[index % themes.length];
  }

  getCurrentTheme(): EnvironmentTheme {
    return this.currentTheme;
  }

  getBoardColor(): string {
    switch (this.currentTheme) {
      case 'neon':
        return '#000000';
      case 'ice':
        return '#e0f7fa';
      case 'retro':
        return '#2d2d2d';
      case 'dusk':
        return '#1e293b';
      default:
        return '#1a1a2e';
    }
  }

  getGridColor(): string {
    switch (this.currentTheme) {
      case 'neon':
        return '#0ff';
      case 'ice':
        return '#81d4fa';
      case 'retro':
        return '#444';
      case 'dusk':
        return '#334155';
      default:
        return '#444';
    }
  }

  getBlockColors(): Record<string, string> {
    switch (this.currentTheme) {
      case 'neon':
        return {
          red: '#ff007a',
          blue: '#00e0ff',
          green: '#0f0',
          yellow: '#ffea00',
          purple: '#be29ec',
          orange: '#ff5500',
          cyan: '#00ffff',
        };
      case 'ice':
        return {
          red: '#ef9a9a',
          blue: '#90caf9',
          green: '#a5d6a7',
          yellow: '#fff59d',
          purple: '#ce93d8',
          orange: '#ffcc80',
          cyan: '#80deea',
        };
      case 'retro':
        return {
          red: '#e63946',
          blue: '#457b9d',
          green: '#a8dadc',
          yellow: '#f1fa8c',
          purple: '#7209b7',
          orange: '#f4a261',
          cyan: '#2a9d8f',
        };
      case 'dusk':
        return {
          red: '#f43f5e',
          blue: '#3b82f6',
          green: '#22c55e',
          yellow: '#eab308',
          purple: '#a855f7',
          orange: '#fb923c',
          cyan: '#06b6d4',
        };
      default:
        return {
          red: '#ff4757',
          blue: '#3742fa',
          green: '#2ed573',
          yellow: '#ffa502',
          purple: '#a55eea',
          orange: '#ff6348',
          cyan: '#26d0ce',
        };
    }
  }
}
