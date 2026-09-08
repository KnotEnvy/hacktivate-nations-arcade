// ===== src/components/arcade/GameLibrary.tsx =====
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Chip, Tag } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GameCard } from './GameCard';
import { TIER_LABELS } from '@/lib/constants';
import { getTierUnlockCost } from '@/lib/unlocks';
import type { GameManifest } from '@/lib/types';
import {
  EMPTY_FILTERS,
  buildGameEntries,
  countByStatus,
  filterEntries,
  groupByTier,
  listCategories,
  pickFeatured,
  type GameEntry,
  type LibraryFilters,
  type StatusFilter,
  type TierGroup,
} from '@/lib/gameLibrary';
import { formatCoins } from '@/lib/utils';

interface GameLibraryProps {
  games: GameManifest[];
  unlockedTiers: number[];
  unlockedGames: string[];
  currentCoins: number;
  /** Play history keyed by game id, used for the featured card. */
  activity?: Record<string, { plays: number; lastPlayed: number }>;
  onGameSelect: (gameId: string) => void;
  onTierUnlock: (tier: number, cost: number) => void;
  onGameUnlock: (gameId: string, cost: number) => void;
}

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready to play' },
  { id: 'locked', label: 'Locked' },
  { id: 'coming-soon', label: 'In development' },
];

const relativeDay = (timestamp: number): string => {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return 'a while back';
};

/* -------------------------------------------------------------------------- */

function FeaturedGame({
  entry,
  onPlay,
  onUnlock,
}: {
  entry: GameEntry;
  onPlay: (gameId: string) => void;
  onUnlock: (gameId: string, cost: number) => void;
}) {
  const { game, status, plays, lastPlayed } = entry;
  const returning = plays > 0;
  const eyebrow =
    status === 'playable'
      ? returning
        ? 'Jump back in'
        : 'Start here'
      : 'Next unlock';

  return (
    <section
      data-testid="library-featured"
      className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="relative aspect-[16/9] md:aspect-auto md:min-h-[248px]">
          <Image
            src={game.thumbnail}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
            priority
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-transparent md:bg-gradient-to-r md:from-transparent md:via-surface/45 md:to-surface"
          />
        </div>

        <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-bright">
              {eyebrow}
            </span>
            {game.category && <Tag tone="neutral">{game.category}</Tag>}
            <Tag tone="quiet">
              Tier {game.tier} · {TIER_LABELS[game.tier] ?? 'Arcade'}
            </Tag>
          </div>

          <div>
            <h3 className="font-display text-2xl font-bold leading-tight text-ink md:text-3xl">
              {game.title}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
              {game.description ?? game.tagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {status === 'playable' ? (
              <Button size="lg" onClick={() => onPlay(game.id)}>
                <Icon name="play" size={16} />
                {returning ? 'Continue' : 'Play now'}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="coin"
                onClick={() => onUnlock(game.id, entry.unlockCost)}
              >
                <Icon name="coin" size={16} />
                Unlock for {formatCoins(entry.unlockCost)}
              </Button>
            )}
            {returning && lastPlayed > 0 && (
              <span className="text-xs text-ink-faint">
                {plays} {plays === 1 ? 'run' : 'runs'} · last played{' '}
                {relativeDay(lastPlayed)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function TierHeader({
  group,
  currentCoins,
  onTierUnlock,
}: {
  group: TierGroup;
  currentCoins: number;
  onTierUnlock: (tier: number, cost: number) => void;
}) {
  const {
    tier,
    unlocked,
    hasReleasedGames,
    tierCost,
    nextGameCost,
    ownedCount,
    releasedCount,
  } = group;
  const canUnlock =
    !unlocked && tier !== 0 && hasReleasedGames && currentCoins >= tierCost;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="font-display text-lg font-bold text-ink">
          {TIER_LABELS[tier] ?? `Tier ${tier}`}
        </h3>
        <Tag tone={unlocked ? 'good' : 'quiet'}>
          {unlocked ? 'Open' : hasReleasedGames ? 'Locked' : 'In development'}
        </Tag>
        <span className="tabular whitespace-nowrap text-xs text-ink-faint">
          Tier {tier} · {ownedCount}/{releasedCount} unlocked
        </span>
        {releasedCount > 0 && (
          <ProgressBar
            value={ownedCount}
            max={releasedCount}
            size="sm"
            tone={ownedCount === releasedCount ? 'good' : 'brand'}
            label={`Tier ${tier} unlock progress`}
            className="w-20"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        {unlocked && hasReleasedGames && ownedCount < releasedCount && (
          <span className="tabular whitespace-nowrap text-xs text-ink-muted">
            Next game{' '}
            <span className="font-semibold text-coin">{formatCoins(nextGameCost)}</span>
          </span>
        )}
        {!unlocked && tier !== 0 && (
          <Button
            size="sm"
            variant={canUnlock ? 'coin' : 'secondary'}
            data-testid={`tier-unlock-${tier}`}
            disabled={!canUnlock}
            onClick={() => onTierUnlock(tier, tierCost)}
          >
            {!hasReleasedGames ? (
              'Coming soon'
            ) : (
              <>
                <Icon name={canUnlock ? 'coin' : 'lock'} size={13} />
                {canUnlock
                  ? `Unlock tier · ${formatCoins(tierCost)}`
                  : `Need ${formatCoins(tierCost)} coins`}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function GameLibrary({
  games,
  unlockedTiers,
  unlockedGames,
  currentCoins,
  activity,
  onGameSelect,
  onTierUnlock,
  onGameUnlock,
}: GameLibraryProps) {
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);

  const entries = useMemo(
    () =>
      buildGameEntries(games, {
        unlockedTiers,
        unlockedGames,
        currentCoins,
        activity,
      }),
    [games, unlockedTiers, unlockedGames, currentCoins, activity]
  );

  const featured = useMemo(() => pickFeatured(entries), [entries]);
  const counts = useMemo(() => countByStatus(entries), [entries]);
  const categories = useMemo(() => listCategories(entries), [entries]);

  const groups = useMemo(
    () =>
      groupByTier(
        filterEntries(entries, filters),
        entries,
        { unlockedTiers, unlockedGames },
        getTierUnlockCost
      ),
    [entries, filters, unlockedTiers, unlockedGames]
  );

  const matchCount = groups.reduce((total, group) => total + group.entries.length, 0);
  const isFiltered =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.category !== null;

  return (
    <div className="space-y-6" data-testid="game-library">
      {featured && (
        <FeaturedGame
          entry={featured}
          onPlay={onGameSelect}
          onUnlock={onGameUnlock}
        />
      )}

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <Icon name="search" size={16} />
            </span>
            <input
              type="search"
              value={filters.search}
              onChange={event =>
                setFilters(prev => ({ ...prev, search: event.target.value }))
              }
              placeholder="Search the arcade"
              aria-label="Search games"
              data-testid="library-search"
              className="h-10 w-full rounded-control border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
            />
          </div>

          <select
            value={filters.category ?? ''}
            onChange={event =>
              setFilters(prev => ({
                ...prev,
                category: (event.target.value || null) as LibraryFilters['category'],
              }))
            }
            aria-label="Filter by category"
            className="h-10 rounded-control border border-line bg-surface-2 px-3 text-sm font-semibold text-ink transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map(tab => (
            <Chip
              key={tab.id}
              selected={filters.status === tab.id}
              count={counts[tab.id]}
              onClick={() => setFilters(prev => ({ ...prev, status: tab.id }))}
            >
              {tab.label}
            </Chip>
          ))}
          {isFiltered && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="ml-1 text-xs font-semibold text-ink-faint underline-offset-4 hover:text-ink hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Tier shelves */}
      {matchCount === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          description="Try a different search term, or clear the filters to see the whole arcade."
          icon={<Icon name="search" size={22} />}
          action={
            <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-9">
          {groups.map(group => (
            <section key={group.tier} className="space-y-4">
              <TierHeader
                group={group}
                currentCoins={currentCoins}
                onTierUnlock={onTierUnlock}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.entries.map(entry => (
                  <GameCard
                    key={entry.game.id}
                    entry={entry}
                    onPlay={onGameSelect}
                    onUnlock={onGameUnlock}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
