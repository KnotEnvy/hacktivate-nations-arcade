// ===== src/components/arcade/GameThemePreview.tsx =====
'use client';

import { GameManifest } from '@/lib/types';
import { getGameTheme } from '@/lib/gameThemes';

interface GameThemePreviewProps {
  game: GameManifest;
  isHovered: boolean;
}

export function GameThemePreview({ game, isHovered }: GameThemePreviewProps) {
  const theme = getGameTheme(game.id);

  if (!isHovered) return null;

  return (
    <div 
      className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none z-10"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.background}E6 0%, ${theme.colors.surface}E6 100%)`,
        borderColor: theme.colors.primary,
      }}
    >
      {/* Theme preview overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center p-4">
          <h4 
            className="text-lg font-bold mb-2"
            style={{ 
              color: theme.colors.primary, 
              fontFamily: theme.fonts.primary,
              textShadow: `0 0 10px ${theme.colors.primary}80`
            }}
          >
            {theme.name}
          </h4>
          <p 
            className="text-sm opacity-90"
            style={{ color: theme.colors.textSecondary }}
          >
            Experience Mode
          </p>
        </div>
      </div>

      {/* Theme effects preview */}
      {theme.effects.glow && (
        <div 
          className="absolute inset-0"
          style={{
            boxShadow: `
              inset 0 0 20px ${theme.colors.primary}30,
              inset 0 0 40px ${theme.colors.secondary}20
            `
          }}
        />
      )}

      {theme.effects.scanlines && (
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              transparent 50%,
              ${theme.colors.primary}08 50%
            )`,
            backgroundSize: '100% 4px',
          }}
        />
      )}

      {/* Corner accent */}
      <div 
        className="absolute top-2 right-2 w-6 h-6 rounded-full"
        style={{ backgroundColor: theme.colors.accent }}
      />
    </div>
  );
}