// ===== src/components/arcade/ThemedGameCanvas.tsx =====
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { useGameModule } from '@/hooks/useGameModule';
import type { GameModule, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import type { CurrencyService } from '@/services/CurrencyService';
import type { AudioManager } from '@/services/AudioManager';
import type { AchievementService } from '@/services/AchievementService';
import { getGameTheme } from '@/lib/gameThemes';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { formatCoins } from '@/lib/utils';

const EMPTY_SCORE: GameScore = {
  score: 0,
  pickups: 0,
  timePlayedMs: 0,
  coinsEarned: 0,
};

type RunState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended';

interface ThemedGameCanvasProps {
  game: GameModule | null;
  currencyService: CurrencyService;
  audioManager: AudioManager;
  achievementService: AchievementService;
  analyticsOwnerId?: string | null;
  onGameEnd?: (stats?: GameScore) => void;
  /** Leave the run and return to the hub. */
  onExit?: () => void;
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** A live value in the run's top bar. */
function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-right">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
      <div className="tabular font-display text-lg font-bold leading-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function OverlayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas-deep/85 p-6 backdrop-blur-sm">
      <div className="animate-rise-in w-full max-w-sm text-center">{children}</div>
    </div>
  );
}

export function ThemedGameCanvas({
  game,
  onGameEnd,
  onExit,
  currencyService,
  audioManager,
  achievementService,
  analyticsOwnerId,
}: ThemedGameCanvasProps) {
  const { canvasRef } = useCanvas(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  const { isInitialized, isRunning, startGame, stopGame, pauseGame, resumeGame } =
    useGameModule(
      canvasRef.current,
      game,
      currencyService,
      audioManager,
      achievementService,
      analyticsOwnerId
    );

  const [runState, setRunState] = useState<RunState>('loading');
  const [currentScore, setCurrentScore] = useState<GameScore>(EMPTY_SCORE);
  const hasHandledGameOverRef = useRef(false);
  const theme = game ? getGameTheme(game.manifest.id) : getGameTheme('default');

  useEffect(() => {
    if (isInitialized && game) {
      setRunState('ready');
      setCurrentScore(game.getScore?.() || EMPTY_SCORE);
    }
  }, [isInitialized, game]);

  useEffect(() => {
    hasHandledGameOverRef.current = false;
    setCurrentScore(game?.getScore?.() || EMPTY_SCORE);
  }, [game]);

  useEffect(() => {
    // Once a run has ended, never allow auto-transitions to flip the state
    // back to playing/paused — that race was the cause of the blank end screen.
    if (runState === 'ended') return;
    if (isRunning) {
      setRunState('playing');
    } else if (runState === 'playing') {
      setRunState('paused');
    }
  }, [isRunning, runState]);

  useEffect(() => {
    if (!game || !isInitialized) return;

    const syncGameState = () => {
      const nextScore = game.getScore?.() || EMPTY_SCORE;
      setCurrentScore(previous => {
        if (
          previous.score === nextScore.score &&
          previous.coinsEarned === nextScore.coinsEarned
        ) {
          return previous;
        }
        return nextScore;
      });

      const isGameOver = game.isGameOver?.();
      if (isGameOver) {
        if (hasHandledGameOverRef.current) return;
        hasHandledGameOverRef.current = true;
        setRunState('ended');
        stopGame();
        onGameEnd?.(nextScore);
        return;
      }

      if (hasHandledGameOverRef.current) {
        hasHandledGameOverRef.current = false;
      }
    };

    syncGameState();
    const interval = window.setInterval(syncGameState, 80);
    return () => clearInterval(interval);
  }, [game, isInitialized, stopGame, onGameEnd]);

  const handleStart = () => {
    if (runState === 'ended') {
      game?.restart?.();
      setRunState('ready');
    }
    startGame();
  };

  const handlePause = () => {
    if (runState === 'playing') {
      pauseGame();
    } else if (runState === 'paused') {
      resumeGame();
    }
  };

  if (!game) {
    return (
      <div className="flex h-96 items-center justify-center rounded-panel border border-line bg-surface text-sm text-ink-muted">
        No game selected
      </div>
    );
  }

  const { manifest } = game;
  // The game's own palette is allowed exactly one job in the harness: tinting
  // the frame around its canvas so each cabinet still feels distinct.
  const accentStyle = { '--game-accent': theme.colors.primary } as CSSProperties;

  return (
    <div
      style={accentStyle}
      data-testid="game-shell"
      className="mx-auto w-full max-w-5xl overflow-hidden rounded-panel border border-line bg-surface shadow-raised"
    >
      {/* Run bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold text-ink">
            {manifest.title}
          </h2>
          <div className="truncate text-xs text-ink-faint">{theme.name}</div>
        </div>

        <div className="flex items-center gap-5">
          <Readout label="Score" value={(currentScore.score ?? 0).toLocaleString()} />
          <Readout label="Coins" value={formatCoins(currentScore.coinsEarned ?? 0)} />
        </div>

        <div className="flex items-center gap-2">
          {runState === 'ready' || runState === 'ended' ? (
            <Button size="sm" onClick={handleStart}>
              <Icon name={runState === 'ended' ? 'replay' : 'play'} size={14} />
              {runState === 'ended' ? 'Play again' : 'Start'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={handlePause}>
              <Icon name={runState === 'paused' ? 'play' : 'pause'} size={14} />
              {runState === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-canvas-deep">
        <canvas
          ref={canvasRef}
          className="mx-auto block border-y-2 border-[color:var(--game-accent)]"
          style={{
            maxWidth: '100%',
            height: 'auto',
            backgroundColor: '#000000',
            // Suppress browser-level touch gestures (pinch-zoom, swipe-back,
            // double-tap zoom) over the canvas so the game owns every touch.
            touchAction: 'none',
          }}
        />

        {runState === 'loading' && (
          <OverlayShell>
            <div className="loading-spinner mx-auto mb-4 h-10 w-10" />
            <p className="text-sm font-semibold text-ink-muted">
              Loading {manifest.title}…
            </p>
          </OverlayShell>
        )}

        {runState === 'ready' && (
          <OverlayShell>
            <h3 className="font-display text-2xl font-bold text-ink">
              {manifest.title}
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
              {manifest.description}
            </p>
            <Button size="lg" className="mt-6" onClick={handleStart}>
              <Icon name="play" size={16} />
              Start run
            </Button>
            <p className="mt-4 text-xs text-ink-faint">
              Controls: {manifest.inputSchema.join(' · ')}
            </p>
          </OverlayShell>
        )}

        {runState === 'paused' && (
          <OverlayShell>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-ink">
              <Icon name="pause" size={20} />
            </span>
            <h3 className="font-display text-xl font-bold text-ink">Paused</h3>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={handlePause}>
                <Icon name="play" size={14} />
                Resume
              </Button>
              {onExit && (
                <Button variant="secondary" onClick={onExit}>
                  Back to hub
                </Button>
              )}
            </div>
          </OverlayShell>
        )}

        {runState === 'ended' && (
          <OverlayShell>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
              Run complete
            </div>
            <h3 className="mt-1 font-display text-2xl font-bold text-ink">
              {manifest.title}
            </h3>

            <dl className="mt-5 grid grid-cols-3 gap-2 rounded-card border border-line bg-surface p-4">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  Score
                </dt>
                <dd className="tabular mt-1 font-display text-lg font-bold text-ink">
                  {(currentScore.score ?? 0).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  Coins
                </dt>
                <dd className="tabular mt-1 font-display text-lg font-bold text-coin">
                  +{formatCoins(currentScore.coinsEarned ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  Time
                </dt>
                <dd className="tabular mt-1 font-display text-lg font-bold text-ink">
                  {formatDuration(currentScore.timePlayedMs ?? 0)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={handleStart}>
                <Icon name="replay" size={14} />
                Play again
              </Button>
              {onExit && (
                <Button variant="secondary" onClick={onExit}>
                  Back to hub
                </Button>
              )}
            </div>
          </OverlayShell>
        )}
      </div>

      {/* Run footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-ink-faint">
        <p className="min-w-0 flex-1 truncate">{manifest.description}</p>
        <span className="whitespace-nowrap">
          Controls: {manifest.inputSchema.join(' · ')}
        </span>
      </div>
    </div>
  );
}
