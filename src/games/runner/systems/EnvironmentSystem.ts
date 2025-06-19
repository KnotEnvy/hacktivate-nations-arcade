// ===== src/games/runner/systems/EnvironmentSystem.ts =====
export type EnvironmentTheme = 'day' | 'sunset' | 'night' | 'desert' | 'forest';

export class EnvironmentSystem {
  private currentTheme: EnvironmentTheme = 'day';
  private transitionProgress: number = 0;
  private themeChangeDistance: number = 2000; // Distance between theme changes
  
  updateTheme(distance: number): void {
    const themeIndex = Math.floor(distance / this.themeChangeDistance);
    const themes: EnvironmentTheme[] = ['day', 'sunset', 'night', 'desert', 'forest'];
    this.currentTheme = themes[themeIndex % themes.length];
    
    // Calculate transition progress within current theme
    this.transitionProgress = (distance % this.themeChangeDistance) / this.themeChangeDistance;
  }
  
  getCurrentTheme(): EnvironmentTheme {
    return this.currentTheme;
  }
  
  getSkyColors(): { top: string; bottom: string } {
    switch (this.currentTheme) {
      case 'day':
        return { top: '#87CEEB', bottom: '#E0F6FF' };
      case 'sunset':
        return { top: '#FF6B6B', bottom: '#FFE66D' };
      case 'night':
        return { top: '#2C3E50', bottom: '#4A6741' };
      case 'desert':
        return { top: '#F4A460', bottom: '#DEB887' };
      case 'forest':
        return { top: '#228B22', bottom: '#90EE90' };
      default:
        return { top: '#87CEEB', bottom: '#E0F6FF' };
    }
  }
  
  getGroundColor(): string {
    switch (this.currentTheme) {
      case 'day': return '#8B7355';
      case 'sunset': return '#D2691E';
      case 'night': return '#2F2F2F';
      case 'desert': return '#F4A460';
      case 'forest': return '#8B4513';
      default: return '#8B7355';
    }
  }
  
  getGrassColor(): string {
    switch (this.currentTheme) {
      case 'day': return '#22C55E';
      case 'sunset': return '#32CD32';
      case 'night': return '#006400';
      case 'desert': return '#DAA520';
      case 'forest': return '#228B22';
      default: return '#22C55E';
    }
  }
}
