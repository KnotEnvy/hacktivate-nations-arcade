// ===== src/components/arcade/ThemedGameCanvas.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { useGameModule } from '@/hooks/useGameModule';
import { GameModule, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import { CurrencyService } from '@/services/CurrencyService';
import { AudioManager } from '@/services/AudioManager';
import { AchievementService } from '@/services/AchievementService';
import { getGameTheme, GameTheme } from '@/lib/gameThemes';

interface ThemedGameCanvasProps {
  game: GameModule | null;
  currencyService: CurrencyService;
  audioManager: AudioManager;
  achievementService: AchievementService;
  onGameEnd?: (stats?: GameScore) => void;
}

export function ThemedGameCanvas({ game, onGameEnd, currencyService, audioManager, achievementService }: ThemedGameCanvasProps) {
  const { canvasRef } = useCanvas(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  const { isInitialized, isRunning, startGame, stopGame, pauseGame, resumeGame } = useGameModule(
    canvasRef.current,
    game,
    currencyService,
    audioManager,
    achievementService
  );

  const [gameState, setGameState] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'ended'>('loading');
  const theme: GameTheme = game ? getGameTheme(game.manifest.id) : getGameTheme('default');

  useEffect(() => {
    if (isInitialized && game) {
      setGameState('ready');
    }
  }, [isInitialized, game]);

  useEffect(() => {
    if (isRunning) {
      setGameState('playing');
    } else if (gameState === 'playing') {
      setGameState('paused');
    }
  }, [isRunning, gameState]);

  // Check for game over
  useEffect(() => {
    if (!game || !isInitialized) return;

    const checkGameOver = () => {
      if (game.isGameOver && game.isGameOver()) {
        setGameState('ended');
        stopGame();
        onGameEnd?.(game.getScore?.());
      }
    };

    const interval = setInterval(checkGameOver, 100);
    return () => clearInterval(interval);
  }, [game, isInitialized, stopGame, onGameEnd]);

  const handleStart = () => {
    if (gameState === 'ended') {
      game?.restart?.();
      setGameState('ready');
    }
    startGame();
  };

  const handlePause = () => {
    if (gameState === 'playing') {
      pauseGame();
    } else if (gameState === 'paused') {
      resumeGame();
    }
  };

  if (!game) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
        <p className="text-white">No game selected</p>
      </div>
    );
  }

  const currentScore = game.getScore?.() || { score: 0, coinsEarned: 0 };

  return (
    <div 
      className={`relative rounded-xl overflow-hidden ${theme.effects.glow ? 'glow-effect' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.surface} 100%)`,
        fontFamily: theme.fonts.primary,
      }}
    >
      {/* Dynamic CSS styles for current theme */}
      <style jsx>{`
        .theme-primary { color: ${theme.colors.primary}; }
        .theme-secondary { color: ${theme.colors.secondary}; }
        .theme-accent { color: ${theme.colors.accent}; }
        .theme-text { color: ${theme.colors.text}; }
        .theme-text-secondary { color: ${theme.colors.textSecondary}; }
        
        .theme-bg-primary { background-color: ${theme.colors.primary}; }
        .theme-bg-secondary { background-color: ${theme.colors.secondary}; }
        .theme-bg-accent { background-color: ${theme.colors.accent}; }
        .theme-bg-surface { background-color: ${theme.colors.surface}; }
        
        .theme-border-primary { border-color: ${theme.colors.primary}; }
        .theme-border-secondary { border-color: ${theme.colors.secondary}; }
        .theme-border-accent { border-color: ${theme.colors.accent}; }
        
        .glow-effect {
          box-shadow: 
            0 0 20px ${theme.colors.primary}40,
            0 0 40px ${theme.colors.primary}20,
            0 0 60px ${theme.colors.primary}10;
        }
        
        .theme-button {
          background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%);
          border: 2px solid ${theme.colors.accent};
          color: ${theme.colors.text};
          font-family: ${theme.fonts.primary};
          font-weight: bold;
          transition: all ${theme.animations.medium};
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .theme-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px ${theme.colors.primary}60;
        }
        
        .theme-hud {
          background: ${theme.colors.surface}CC;
          border: 1px solid ${theme.colors.primary}60;
          backdrop-filter: blur(10px);
          ${theme.effects.glow ? `box-shadow: 0 0 15px ${theme.colors.primary}30;` : ''}
        }
        
        .scanlines {
          position: relative;
          overflow: hidden;
        }
        
        .scanlines::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            transparent 50%,
            ${theme.colors.primary}08 50%
          );
          background-size: 100% 4px;
          pointer-events: none;
          animation: scanline-move 0.1s linear infinite;
        }
        
        @keyframes scanline-move {
          0% { transform: translateY(0px); }
          100% { transform: translateY(4px); }
        }
        
        .theme-overlay {
          background: ${theme.colors.background}F0;
          backdrop-filter: blur(8px);
        }
        
        .theme-title {
          font-family: ${theme.fonts.primary};
          color: ${theme.colors.primary};
          text-shadow: 0 0 10px ${theme.colors.primary}80;
          font-weight: bold;
        }
        
        .stats-display {
          font-family: ${theme.fonts.mono};
          color: ${theme.colors.accent};
          text-shadow: 0 0 5px ${theme.colors.accent}60;
        }
      `}</style>

      {/* Game Header */}
      <div className="flex justify-between items-center p-4 theme-bg-surface">
        <div>
          <h2 className="text-2xl font-bold theme-title">
            {game.manifest.title}
          </h2>
          <p className="text-sm theme-text-secondary mt-1">
            {theme.name}
          </p>
        </div>
        
        {/* Live Stats HUD */}
        <div className="flex gap-4 items-center">
          <div className="theme-hud px-3 py-1 rounded">
            <div className="text-xs theme-text-secondary">SCORE</div>
            <div className="text-lg font-bold stats-display">{currentScore.score?.toLocaleString() || '0'}</div>
          </div>
          <div className="theme-hud px-3 py-1 rounded">
            <div className="text-xs theme-text-secondary">COINS</div>
            <div className="text-lg font-bold theme-secondary">{currentScore.coinsEarned || '0'}</div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {gameState === 'ready' || gameState === 'ended' ? (
            <button onClick={handleStart} className="theme-button px-4 py-2 rounded">
              {gameState === 'ended' ? 'RETRY' : 'START'}
            </button>
          ) : (
            <button onClick={handlePause} className="theme-button px-4 py-2 rounded">
              {gameState === 'paused' ? 'RESUME' : 'PAUSE'}
            </button>
          )}
        </div>
      </div>

      {/* Game Canvas Area */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`block mx-auto border-2 theme-border-primary ${theme.effects.scanlines ? 'scanlines' : ''}`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            backgroundColor: '#000000',
          }}
        />
        
        {/* Game State Overlays */}
        {gameState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center theme-overlay">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 theme-border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="theme-text text-lg font-semibold">LOADING {theme.name.toUpperCase()}</p>
            </div>
          </div>
        )}

        {gameState === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center theme-overlay">
            <div className="text-center">
              <div className="theme-primary text-6xl mb-4">▶</div>
              <h3 className="theme-title text-2xl mb-2">READY TO PLAY!</h3>
              <p className="theme-text-secondary">Press START to begin your {theme.name} experience</p>
            </div>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center theme-overlay">
            <div className="text-center">
              <div className="theme-accent text-6xl mb-4">⏸</div>
              <h3 className="theme-title text-2xl mb-2">GAME PAUSED</h3>
              <p className="theme-text-secondary">Press RESUME to continue</p>
            </div>
          </div>
        )}

        {gameState === 'ended' && (
          <div className="absolute inset-0 flex items-center justify-center theme-overlay">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="theme-accent text-6xl mb-4">🎯</div>
              <h3 className="theme-title text-3xl mb-4">GAME COMPLETE!</h3>
              
              <div className="theme-hud p-4 rounded-lg mb-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-xs theme-text-secondary mb-1">FINAL SCORE</div>
                    <div className="stats-display text-2xl font-bold">{currentScore.score?.toLocaleString() || '0'}</div>
                  </div>
                  <div>
                    <div className="text-xs theme-text-secondary mb-1">COINS EARNED</div>
                    <div className="theme-secondary text-2xl font-bold">{currentScore.coinsEarned || '0'}</div>
                  </div>
                </div>
              </div>
              
              <p className="theme-text-secondary mb-4">Thanks for playing {theme.name}!</p>
            </div>
          </div>
        )}
      </div>

      {/* Game Info Footer */}
      <div className="p-4 theme-bg-surface border-t theme-border-primary">
        <div className="flex justify-between items-center text-sm">
          <p className="theme-text-secondary">{game.manifest.description}</p>
          <div className="flex gap-4 theme-text-secondary">
            <span>Controls: {game.manifest.inputSchema.join(' • ')}</span>
            <span>Theme: {theme.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}