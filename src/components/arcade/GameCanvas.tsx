// ===== src/components/arcade/GameCanvas.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { useGameModule } from '@/hooks/useGameModule';
import { GameModule, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { CurrencyService } from '@/services/CurrencyService';
import { AudioManager } from '@/services/AudioManager';
import { AchievementService } from '@/services/AchievementService';

interface GameCanvasProps {
  game: GameModule | null;
  currencyService: CurrencyService;
  audioManager: AudioManager;
  achievementService: AchievementService;
  onGameEnd?: (stats?: GameScore) => void;
}

export function GameCanvas({ game, onGameEnd, currencyService, audioManager, achievementService }: GameCanvasProps) {
  const { canvasRef, ctx } = useCanvas(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  const { isInitialized, isRunning, startGame, stopGame, pauseGame, resumeGame } = useGameModule(
    canvasRef.current,
    game,
    currencyService,
    audioManager,
    achievementService
  );

  const [gameState, setGameState] = useState<'loading' | 'ready' | 'playing' | 'paused' | 'ended'>('loading');

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

  return (
    <div className="arcade-panel">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">{game.manifest.title}</h2>
        <div className="flex gap-2">
          {gameState === 'ready' || gameState === 'ended' ? (
            <Button onClick={handleStart} className="arcade-button">
              {gameState === 'ended' ? 'Play Again' : 'Start Game'}
            </Button>
          ) : (
            <Button onClick={handlePause} className="arcade-button">
              {gameState === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
        </div>
      </div>

      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          className="border-2 border-primary-500 rounded-lg bg-black"
          style={{
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        
        {gameState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="loading-spinner w-8 h-8"></div>
          </div>
        )}

        {gameState === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-xl mb-2">Ready to Play!</h3>
              <p className="text-sm opacity-75">Press Start to begin</p>
            </div>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-xl mb-2">Game Paused</h3>
              <p className="text-sm opacity-75">Press Resume to continue</p>
            </div>
          </div>
        )}

        {gameState === 'ended' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
            <div className="text-center text-white">
              <h3 className="text-xl mb-2">Game Over!</h3>
              <p className="text-sm opacity-75 mb-4">
                Final Score: {game.getScore?.()?.score || 0}
              </p>
              <p className="text-sm opacity-75">
                Coins Earned: {game.getScore?.()?.coinsEarned || 0}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-300">
        <p>{game.manifest.description}</p>
        <p className="mt-1">
          Controls: {game.manifest.inputSchema.join(', ')}
        </p>
      </div>
    </div>
  );
}
