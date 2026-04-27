// ===== src/hooks/useGameModule.ts =====
import { useEffect, useRef, useState } from 'react';
import type { GameModule, Services } from '@/lib/types';
import { useInput } from '@/hooks/useInput';
import type { AudioManager } from '@/services/AudioManager';
import { Analytics } from '@/services/Analytics';
import type { CurrencyService } from '@/services/CurrencyService';
import type { AchievementService } from '@/services/AchievementService';

export function useGameModule(
  canvas: HTMLCanvasElement | null,
  game: GameModule | null,
  currencyService: CurrencyService,
  audioManager: AudioManager,
  achievementService: AchievementService,
  analyticsOwnerId?: string | null
) {
  const { input } = useInput(canvas);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const servicesRef = useRef<Services | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!canvas || !game) return;

    // Initialize services
    const audio = audioManager; // Use the passed AudioManager instance
    const analytics = new Analytics(analyticsOwnerId);
    const currency = currencyService;
    const achievements = achievementService;

    const services: Services = { input, audio, analytics, currency, achievements };
    servicesRef.current = services;

    // AudioManager is already initialized in the ArcadeHub, no need to init again
    void analytics.init();
    currency.init();

    // Initialize game
    game.init(canvas, services);
    setIsInitialized(true);

    return () => {
      game.destroy?.();
    };
  }, [canvas, game, currencyService, audioManager, achievementService, input, analyticsOwnerId]);

  useEffect(() => {
    if (!isInitialized || !game) return;

    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = currentTime;

      game.update(deltaTime);

      const ctx = canvas?.getContext('2d');
      if (ctx) {
        game.render(ctx);
      }

      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    if (isRunning) {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized, isRunning, game, canvas]);

  const startGame = () => setIsRunning(true);
  const stopGame = () => setIsRunning(false);
  const pauseGame = () => {
    setIsRunning(false);
    game?.pause?.();
  };
  const resumeGame = () => {
    setIsRunning(true);
    game?.resume?.();
  };

  return {
    isInitialized,
    isRunning,
    startGame,
    stopGame,
    pauseGame,
    resumeGame,
    services: servicesRef.current,
  };
}
