// ===== src/components/arcade/GameCarousel.tsx =====
'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { GameManifest } from '@/lib/types';
import {
  getNextGameUnlockCost,
  getPaidUnlockedCountInTier,
  getTierUnlockCost,
  isDefaultUnlockedGame,
  isTierUnlocked,
} from '@/lib/unlocks';

interface GameCarouselProps {
  games: GameManifest[];
  unlockedTiers: number[];
  unlockedGames: string[];
  currentCoins: number;
  onGameSelect: (gameId: string) => void;
  onTierUnlock: (tier: number, cost: number) => void;
  onGameUnlock: (gameId: string, cost: number) => void;
}

export function GameCarousel({
  games,
  unlockedTiers,
  unlockedGames,
  currentCoins,
  onGameSelect,
  onTierUnlock,
  onGameUnlock,
}: GameCarouselProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || '');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const listRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const isTierUnlockedLocal = (tier: number) => isTierUnlocked(tier, unlockedTiers);

  const isGameUnlocked = (game: GameManifest) => {
    if (isDefaultUnlockedGame(game.id)) return true;
    return isTierUnlockedLocal(game.tier) && unlockedGames.includes(game.id);
  };

  const getNextCostForTier = (tier: number) => {
    const paidUnlocked = getPaidUnlockedCountInTier(tier, unlockedGames);
    return getNextGameUnlockCost(tier, paidUnlocked);
  };

  const handleImageError = (gameId: string) => {
    setImageErrors(prev => new Set([...prev, gameId]));
  };

  const handleImageLoad = (gameId: string) => {
    setLoadedImages(prev => new Set(prev).add(gameId));
  };

  const renderThumbnail = (game: GameManifest, unlocked: boolean) => {
    const hasError = imageErrors.has(game.id);
    const loaded = loadedImages.has(game.id);

    if (hasError) {
      return (
        <div className="text-2xl font-bold text-white">
          {unlocked ? 'PLAY' : 'LOCKED'}
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden rounded-t-2xl">
        <Image
          src={game.thumbnail}
          alt={game.title}
          fill
          className={`object-cover transition-all duration-300 ${
            unlocked ? 'opacity-100' : 'opacity-60 grayscale blur-[1px]'
          }`}
          onError={() => handleImageError(game.id)}
          onLoad={() => handleImageLoad(game.id)}
          priority={game.id === games[0]?.id}
        />
        {!loaded && <div className="absolute inset-0 thumbnail-loading" />}
      </div>
    );
  };

  const tiers = Array.from(new Set(games.map(g => g.tier))).sort((a, b) => a - b);

  return (
    <div className="w-full space-y-8" data-testid="game-carousel">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Game Arcade</h2>
          <p className="text-sm text-gray-300 mt-1">
            Unlock tiers, then unlock games inside each tier.
          </p>
        </div>
      </div>

      {tiers.map(tier => {
        const tierUnlocked = isTierUnlockedLocal(tier);
        const tierCost = getTierUnlockCost(tier);
        const canUnlockTier = !tierUnlocked && tier !== 0 && currentCoins >= tierCost;

        const nextGameCost = tierUnlocked ? getNextCostForTier(tier) : 0;

        return (
          <div
            key={tier}
            className="space-y-4 relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Tier {tier}</h3>
              <div className="flex items-center gap-2">
                {tierUnlocked ? (
                  <div className="text-xs font-semibold text-white/90 bg-black/30 border border-white/10 px-3 py-1 rounded-full">
                    Next game: {nextGameCost} coins
                  </div>
                ) : tier === 0 ? (
                  <div className="text-xs font-semibold text-white/90 bg-black/30 border border-white/10 px-3 py-1 rounded-full">
                    Open
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-white/90 bg-black/30 border border-white/10 px-3 py-1 rounded-full">
                    Unlock tier: {tierCost}
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full border border-white/10 backdrop-blur"
                onClick={() =>
                  listRefs.current[tier]?.scrollBy({ left: -300, behavior: 'smooth' })
                }
              >
                {'<'}
              </button>
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full border border-white/10 backdrop-blur"
                onClick={() =>
                  listRefs.current[tier]?.scrollBy({ left: 300, behavior: 'smooth' })
                }
              >
                {'>'}
              </button>

              <div
                ref={el => {
                  listRefs.current[tier] = el;
                }}
                className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar scroll-smooth"
              >
                {games
                  .filter(g => g.tier === tier)
                  .map(game => {
                    const unlocked = isGameUnlocked(game);
                    const tierLocked = !tierUnlocked;
                    const showGameLockOverlay = tierUnlocked && !unlocked;

                    const canUnlockGame =
                      !tierLocked &&
                      !unlocked &&
                      !isDefaultUnlockedGame(game.id) &&
                      currentCoins >= nextGameCost;

                    return (
                      <div
                        key={game.id}
                        data-testid={`game-card-${game.id}`}
                        className={`game-card w-72 flex-shrink-0 ${
                          selectedGameId === game.id ? 'ring-2 ring-purple-400/60' : ''
                        }`}
                        onClick={() => setSelectedGameId(game.id)}
                      >
                        <div className="aspect-square bg-black/30 border-b border-white/10 flex items-center justify-center relative rounded-t-2xl">
                          {renderThumbnail(game, unlocked)}

                          {showGameLockOverlay && (
                            <div className="absolute inset-0 z-10 pointer-events-none">
                              <svg
                                className="absolute inset-0 w-full h-full opacity-40"
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                              >
                                <defs>
                                  <pattern
                                    id={`chain-${game.id}`}
                                    width="24"
                                    height="24"
                                    patternUnits="userSpaceOnUse"
                                    patternTransform="rotate(35)"
                                  >
                                    <rect width="24" height="24" fill="transparent" />
                                    <path
                                      d="M2 12h8a4 4 0 0 1 0 8H2a4 4 0 0 1 0-8z"
                                      fill="none"
                                      stroke="rgba(255,255,255,0.8)"
                                      strokeWidth="2"
                                    />
                                    <path
                                      d="M14 4h8a4 4 0 0 1 0 8h-8a4 4 0 0 1 0-8z"
                                      fill="none"
                                      stroke="rgba(255,255,255,0.8)"
                                      strokeWidth="2"
                                    />
                                  </pattern>
                                </defs>
                                <rect width="100" height="100" fill={`url(#chain-${game.id})`} />
                              </svg>
                              <div className="absolute inset-0 bg-black/35" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/70 px-3 py-1 rounded-full text-xs font-bold text-white border border-gray-300/40">
                                  Locked
                                </div>
                              </div>
                            </div>
                          )}

                          {!unlocked && tierUnlocked && !isDefaultUnlockedGame(game.id) && (
                            <div className="absolute bottom-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold z-20">
                              {nextGameCost} coins
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <h3 className="font-bold text-white mb-2">{game.title}</h3>
                          <p className="text-sm text-gray-300 mb-3">{game.description}</p>

                          {unlocked ? (
                            <button
                              data-testid={`game-play-${game.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                onGameSelect(game.id);
                              }}
                              className="w-full arcade-button text-sm py-2"
                            >
                              Play Game
                            </button>
                          ) : tierLocked ? (
                            <div className="w-full bg-gray-700 text-gray-400 font-bold py-2 px-4 rounded-lg text-center text-sm">
                              Unlock Tier First
                            </div>
                          ) : canUnlockGame ? (
                            <button
                              data-testid={`game-unlock-${game.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                onGameUnlock(game.id, nextGameCost);
                              }}
                              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                              Unlock for {nextGameCost} coins
                            </button>
                          ) : (
                            <div className="w-full bg-gray-600 text-gray-400 font-bold py-2 px-4 rounded-lg text-center text-sm">
                              Need {nextGameCost} coins
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {!tierUnlocked && tier !== 0 && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur rounded-2xl border border-white/10">
                <div className="text-center space-y-3 px-6 py-6">
                  <div className="text-xl font-bold text-white">Tier {tier} Locked</div>
                  <p className="text-sm text-gray-300">
                    Unlock this tier to access and purchase its games.
                  </p>
                  <button
                    data-testid={`tier-unlock-${tier}`}
                    disabled={!canUnlockTier}
                    onClick={() => onTierUnlock(tier, tierCost)}
                    className={`w-full font-bold py-2 px-4 rounded-lg transition-colors text-sm ${
                      canUnlockTier
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Unlock Tier for {tierCost} coins
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
