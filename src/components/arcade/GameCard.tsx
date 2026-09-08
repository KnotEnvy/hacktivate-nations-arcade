// ===== src/components/arcade/GameCard.tsx =====
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Chip';
import { TIER_LABELS } from '@/lib/constants';
import type { GameEntry } from '@/lib/gameLibrary';
import { cn, formatCoins } from '@/lib/utils';

interface GameCardProps {
  entry: GameEntry;
  onPlay: (gameId: string) => void;
  onUnlock: (gameId: string, cost: number) => void;
}

function Thumbnail({ entry, dimmed }: { entry: GameEntry; dimmed: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { game } = entry;

  // Unbuilt games have no art of their own — the shared "coming soon" asset is
  // an empty grey box, which reads as a broken card rather than a planned one.
  if (entry.status === 'coming-soon') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-2 text-ink-faint">
        <Icon name="sparkle" size={20} />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
          In development
        </span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2">
        <span className="font-display text-sm font-bold tracking-wide text-ink-faint">
          {game.title.toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <>
      <Image
        src={game.thumbnail}
        alt=""
        fill
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px"
        className={cn(
          'object-cover transition-[transform,filter,opacity] duration-300 ease-out',
          'group-hover:scale-[1.04]',
          dimmed && 'opacity-70 grayscale-[0.7]'
        )}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && <div className="absolute inset-0 thumbnail-loading" />}
    </>
  );
}

export function GameCard({ entry, onPlay, onUnlock }: GameCardProps) {
  const { game, status, unlockCost } = entry;
  const dimmed = status === 'tier-locked';

  return (
    <article
      data-testid={`game-card-${game.id}`}
      data-status={status}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line bg-surface',
        'transition-[border-color,transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised',
        'focus-within:border-brand/50'
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <Thumbnail entry={entry} dimmed={dimmed} />

        {/* Scrim keeps the status pills legible over bright thumbnails. */}
        {status !== 'coming-soon' && (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/50"
          />
        )}

        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {game.category && (
            // Sits over artwork of unknown brightness, so it carries its own
            // contrast rather than relying on the token palette.
            <Tag
              tone="quiet"
              className="border-white/20 bg-black/65 text-white/90 backdrop-blur-sm"
            >
              {game.category}
            </Tag>
          )}
          {status === 'affordable' && (
            <Tag tone="coin" className="backdrop-blur-sm">
              <Icon name="coin" size={11} />
              {formatCoins(unlockCost)}
            </Tag>
          )}
          {status === 'short' && (
            <Tag
              tone="neutral"
              className="border-white/20 bg-black/65 text-white/90 backdrop-blur-sm"
            >
              <Icon name="coin" size={11} />
              {formatCoins(unlockCost)}
            </Tag>
          )}
          {status === 'tier-locked' && (
            <Tag
              tone="neutral"
              className="border-white/20 bg-black/65 text-white/90 backdrop-blur-sm"
            >
              <Icon name="lock" size={11} />
              Tier {game.tier}
            </Tag>
          )}
        </div>

        {status === 'playable' ? (
          // The whole thumbnail is the play target; the footer button stays for
          // clarity and for anyone tabbing through.
          <button
            type="button"
            onClick={() => onPlay(game.id)}
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-pop">
              <Icon name="play" size={20} className="translate-x-px" />
            </span>
            <span className="sr-only">Play {game.title}</span>
          </button>
        ) : (
          status === 'tier-locked' && (
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center text-ink-faint"
            >
              <Icon name="lock" size={26} />
            </div>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h4 className="text-[15px] font-bold leading-tight text-ink">{game.title}</h4>
        <div className="mt-1 text-xs text-ink-faint">
          Tier {game.tier} · {TIER_LABELS[game.tier] ?? 'Arcade'}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
          {game.tagline ?? game.description}
        </p>

        <div className="mt-4 pt-0.5">
          {status === 'playable' && (
            <Button
              block
              size="sm"
              data-testid={`game-play-${game.id}`}
              onClick={() => onPlay(game.id)}
            >
              <Icon name="play" size={13} />
              Play
            </Button>
          )}
          {status === 'affordable' && (
            <Button
              block
              size="sm"
              variant="coin"
              data-testid={`game-unlock-${game.id}`}
              onClick={() => onUnlock(game.id, unlockCost)}
            >
              <Icon name="coin" size={13} />
              Unlock for {formatCoins(unlockCost)}
            </Button>
          )}
          {status === 'short' && (
            <Button block size="sm" variant="secondary" disabled>
              Need {formatCoins(unlockCost)} coins
            </Button>
          )}
          {status === 'tier-locked' && (
            <Button block size="sm" variant="secondary" disabled>
              <Icon name="lock" size={13} />
              Tier {game.tier} locked
            </Button>
          )}
          {status === 'coming-soon' && (
            <div className="rounded-lg border border-dashed border-line py-1.5 text-center text-xs font-semibold text-ink-faint">
              Coming soon
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
