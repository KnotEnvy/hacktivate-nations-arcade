// ===== src/hooks/useGameModule.ts =====
import { useEffect, useRef, useState } from 'react';
import { GameModule, Services } from '@/lib/types';
import { InputManager } from '@/services/InputManager';
import { AudioManager } from '@/services/AudioManager';
import { Analytics } from '@/services/Analytics';
import { CurrencyService } from '@/services/CurrencyService';

export function useGameModule(canvas: HTMLCanvasElement | null, game: GameModule | null, currencyService: CurrencyService) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const servicesRef = useRef<Services | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!canvas || !game) return;

    // Initialize services
    const input = new InputManager();
    const audio = new AudioManager();
    const analytics = new Analytics();
    const currency = currencyService;

    const services: Services = { input, audio, analytics, currency };
    servicesRef.current = services;

    // Initialize all services
    input.init(canvas);
    audio.init();
    analytics.init();
    currency.init();

    // Initialize game
    game.init(canvas, services);
    setIsInitialized(true);

    return () => {
      input.destroy();
      game.destroy?.();
    };
  }, [canvas, game, currencyService]);

  useEffect(() => {
    if (!isInitialized || !game) return;

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      if (deltaTime < 0.1) { // Cap delta time to prevent large jumps
        game.update(deltaTime);
        
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          game.render(ctx);
        }
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
