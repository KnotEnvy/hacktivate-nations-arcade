'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Database } from '@/lib/supabase.types';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import type { GameManifest } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { isDefaultUnlockedGame, isTierUnlocked } from '@/lib/unlocks';

type LeaderboardRow = Database['public']['Views']['leaderboards_view']['Row'];
type Period = Database['public']['Enums']['leaderboard_period'];
type DisplayRow = LeaderboardRow & { isPlaceholder?: boolean };

const periods: Array<{ id: Period; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'all_time', label: 'All-time' },
];

interface LeaderboardsTabProps {
  supabaseService: SupabaseArcadeService | null;
  signedIn: boolean;
  authDisabled: boolean;
  games: GameManifest[];
  unlockedTiers: number[];
  unlockedGames: string[];
  onPlayGame: (gameId: string) => void;
  onRequestSignIn: () => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

const hashStringToSeed = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const placeholderNames = [
  'PixelPunk',
  'CRTWizard',
  'QuarterKing',
  'NeonNinja',
  'BitBrawler',
  'ArcadeAcolyte',
  'CoinOpKid',
  'JoystickJedi',
  'RetroRanger',
  'ScanlineSam',
  'CabinetCrusader',
  'GlitchGoddess',
  'ChiptuneChamp',
  'VHSViper',
  'HighScoreHank',
  'DungeonDiver',
  'SpaceAce',
  'ByteBandit',
  'ComboClutch',
  'BossRushBea',
  'SpeedrunSage',
  'AstroAndy',
  'FrogHopFan',
  'SnakeCharmer',
  'MineSweeperMike',
] as const;

const buildPlaceholderRows = (gameId: string, period: Period): DisplayRow[] => {
  const seed = hashStringToSeed(`${gameId}:${period}:placeholders`);
  const rand = mulberry32(seed);
  const maxEntries = 25;
  const now = new Date();
  const toDateKey = (value: Date) => value.toISOString().slice(0, 10);
  const weekStart = (() => {
    const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = utc.getUTCDay();
    const diff = (day + 6) % 7;
    utc.setUTCDate(utc.getUTCDate() - diff);
    return utc;
  })();
  const periodStart =
    period === 'all_time'
      ? '1970-01-01'
      : period === 'daily'
        ? toDateKey(now)
        : period === 'weekly'
          ? toDateKey(weekStart)
          : toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));

  const baseMax =
    period === 'daily'
      ? 3500
      : period === 'weekly'
        ? 12000
        : period === 'monthly'
          ? 30000
          : 65000;
  const baseMin = Math.floor(baseMax * 0.35);

  const rows: DisplayRow[] = [];
  let score = baseMax;

  for (let index = 0; index < maxEntries; index += 1) {
    const jitter = Math.floor(rand() * (baseMax * 0.04));
    const drop = Math.floor(baseMax * (0.02 + rand() * 0.03));
    score = Math.max(baseMin, score - drop + jitter);

    const name = placeholderNames[Math.floor(rand() * placeholderNames.length)];
    const suffix = index < 9 ? '' : `#${index + 1}`;

    rows.push({
      id: `sample-${seed}-${period}-${index}`,
      game_id: gameId,
      user_id: `npc-${seed}-${index}`,
      username: `${name}${suffix}`,
      avatar: null,
      score,
      rank: index + 1,
      period,
      period_start: periodStart,
      created_at: null,
      updated_at: null,
      isPlaceholder: true,
    });
  }

  return rows;
};

const normalizeLeaderboardRows = (rows: LeaderboardRow[]): DisplayRow[] => {
  return [...rows]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const createdA = a.created_at ? Date.parse(a.created_at) : Number.MAX_SAFE_INTEGER;
      const createdB = b.created_at ? Date.parse(b.created_at) : Number.MAX_SAFE_INTEGER;
      if (createdA !== createdB) return createdA - createdB;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 25)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
};

export function LeaderboardsTab({
  supabaseService,
  signedIn,
  authDisabled,
  games,
  unlockedTiers,
  unlockedGames,
  onPlayGame,
  onRequestSignIn,
}: LeaderboardsTabProps) {
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<Period>('all_time');
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id ?? 'runner');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(
    () => signedIn && !!supabaseService && !authDisabled,
    [authDisabled, signedIn, supabaseService]
  );

  const selectedGame = useMemo(
    () => games.find(g => g.id === selectedGameId) ?? games[0],
    [games, selectedGameId]
  );

  const isGameUnlocked = useCallback(
    (game: GameManifest) => {
      if (isDefaultUnlockedGame(game.id)) return true;
      return isTierUnlocked(game.tier, unlockedTiers) && unlockedGames.includes(game.id);
    },
    [unlockedGames, unlockedTiers]
  );

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return games
      .filter(game => {
        if (showUnlockedOnly && !isGameUnlocked(game)) return false;
        if (!normalized) return true;
        return (
          game.title.toLowerCase().includes(normalized) ||
          game.id.toLowerCase().includes(normalized) ||
          String(game.tier).includes(normalized)
        );
      })
      .sort((a, b) => a.tier - b.tier || a.title.localeCompare(b.title));
  }, [games, isGameUnlocked, query, showUnlockedOnly]);

  const gamesByTier = useMemo(() => {
    const grouped = new Map<number, GameManifest[]>();
    filteredGames.forEach(game => {
      const list = grouped.get(game.tier) ?? [];
      list.push(game);
      grouped.set(game.tier, list);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, [filteredGames]);

  useEffect(() => {
    if (!canLoad) {
      setRows([]);
      setError(null);
      return;
    }

    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await supabaseService!.fetchLeaderboard({
          gameId: selectedGameId,
          period,
          limit: 25,
        });
        if (active) setRows(data);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      active = false;
    };
  }, [canLoad, period, selectedGameId, supabaseService]);

  const normalizedRows = useMemo(() => normalizeLeaderboardRows(rows), [rows]);
  const showPlaceholder = useMemo(() => {
    if (loading) return false;
    if (error) return false;
    return !canLoad || normalizedRows.length === 0;
  }, [canLoad, error, loading, normalizedRows.length]);

  const displayRows = useMemo<DisplayRow[]>(
    () => (showPlaceholder ? buildPlaceholderRows(selectedGameId, period) : normalizedRows),
    [normalizedRows, period, selectedGameId, showPlaceholder]
  );

  const topThree = displayRows.slice(0, 3);
  const rest = displayRows.slice(3);
  const selectedUnlocked = selectedGame ? isGameUnlocked(selectedGame) : false;

  const keyForRow = (row: DisplayRow, index: number) =>
    row.id || `${row.period}:${row.game_id}:${row.user_id}:${row.rank}:${index}`;

  return (
    <div className="space-y-6">
      <div className="rounded-panel border border-line bg-surface p-5 shadow-panel">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Leaderboards</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Browse top score entries by game, tier, and season.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                  period === p.id
                    ? 'border-brand/50 bg-brand-dim text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowUnlockedOnly(v => !v)}
              className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                showUnlockedOnly
                  ? 'border-brand/50 bg-brand-dim text-ink'
                  : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink'
              }`}
              title="Filter to unlocked games"
            >
              Unlocked only
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 rounded-panel border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-sm font-bold text-ink">Games</div>
            <div className="text-xs text-ink-faint">{filteredGames.length} total</div>
          </div>
          <div className="mb-3">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search games (name, id, tier)"
              className="h-10 w-full rounded-control border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint transition-colors hover:border-line-strong focus:border-brand/60 focus:outline-none"
            />
          </div>
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar pr-1 space-y-4">
            {gamesByTier.map(([tier, tierGames]) => (
              <div key={tier}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    Tier {tier}
                  </div>
                  <div className="text-xs text-ink-faint">{tierGames.length}</div>
                </div>
                <div className="space-y-2">
                  {tierGames.map(game => {
                    const active = game.id === selectedGameId;
                    const unlocked = isGameUnlocked(game);
                    return (
                      <button
                        key={game.id}
                        onClick={() => setSelectedGameId(game.id)}
                        className={`flex w-full items-center gap-3 rounded-card border px-3 py-2 text-left transition-colors ${
                          active
                            ? 'border-brand/50 bg-brand-dim'
                            : 'border-line bg-surface-2 hover:border-line-strong'
                        }`}
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
                          <Image
                            src={game.thumbnail}
                            alt={game.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">
                            {game.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-ink-faint">
                            <span className="truncate">{game.id}</span>
                            {!unlocked && (
                              <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-ink-muted">
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="lg:col-span-8 space-y-4">
          <div className="rounded-panel border border-line bg-surface p-5 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {selectedGame && (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-card border border-line bg-surface-2">
                    <Image
                      src={selectedGame.thumbnail}
                      alt={selectedGame.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                    {periods.find(p => p.id === period)?.label} leaderboard
                  </div>
                  <div className="truncate font-display text-xl font-bold text-ink">
                    {selectedGame?.title ?? selectedGameId}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    <span>Tier {selectedGame?.tier ?? '?'}</span>
                    {!selectedUnlocked && (
                      <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                        Locked
                      </span>
                    )}
                    {showPlaceholder && (
                      <span className="rounded-full border border-brand/40 bg-brand-dim px-2 py-0.5 text-xs text-brand-bright">
                        Sample
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={() => onPlayGame(selectedGameId)}
                  disabled={!selectedUnlocked}
                  className={`h-10 rounded-control px-4 text-sm font-semibold transition-colors ${
                    selectedUnlocked
                      ? 'bg-brand text-white hover:bg-brand-bright'
                      : 'cursor-not-allowed border border-line bg-surface-2 text-ink-faint'
                  }`}
                >
                  Play {selectedGame?.title ?? 'Game'}
                </button>
                {!selectedUnlocked && (
                  <div className="text-xs text-ink-faint">Unlock it in the Games tab.</div>
                )}
              </div>
            </div>
          </div>

          {!signedIn && !authDisabled && (
            <div className="rounded-panel border border-line bg-surface p-5 shadow-panel">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="font-bold text-ink">Sign in to post and view real scores</div>
                  <div className="mt-1 text-sm text-ink-muted">
                    Until then, enjoy the sample leaderboard layout.
                  </div>
                </div>
                <button
                  onClick={onRequestSignIn}
                  className="h-10 shrink-0 rounded-control bg-brand px-4 font-semibold text-white transition-colors hover:bg-brand-bright"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {authDisabled && (
            <div className="rounded-panel border border-warn/30 bg-surface p-5 text-warn">
              Supabase not configured; leaderboards are unavailable in offline mode.
            </div>
          )}

          {signedIn && !authDisabled && !supabaseService && (
            <div className="rounded-panel border border-warn/30 bg-surface p-5 text-warn">
              Supabase not configured; leaderboards are unavailable.
            </div>
          )}

          <div className="space-y-4">
            {loading && (
              <div className="rounded-panel border border-line bg-surface p-5 text-ink-muted shadow-panel">
                Loading leaderboard…
              </div>
            )}

            {error && (
              <div className="rounded-panel border border-bad/30 bg-bad-dim p-5 text-bad">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {canLoad && normalizedRows.length === 0 && (
                  <div className="rounded-panel border border-line bg-surface p-4 text-ink-muted">
                    <div className="text-sm font-bold text-ink">No scores yet</div>
                    <div className="mt-1 text-xs text-ink-muted">
                      Be the first to post a score for this game/period.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {topThree.map((row, index) => (
                    <div
                      key={keyForRow(row, index)}
                      className="rounded-panel border border-line bg-surface-2 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-ink">#{row.rank}</div>
                        <div className="text-xs text-ink-muted">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        {row.avatar ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-3 text-xl">
                            {row.avatar}
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-3 font-bold text-ink">
                            {initials(row.username ?? 'Arcader') || 'A'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">
                            {row.username || 'Arcader'}
                          </div>
                          <div className="text-xs text-ink-faint">{row.user_id.slice(0, 6)}…</div>
                        </div>
                      </div>
                      <div className="tabular mt-3 font-display text-2xl font-bold text-coin">
                        {formatNumber(row.score)}
                      </div>
                    </div>
                  ))}
                  {topThree.length < 3 &&
                    Array.from({ length: 3 - topThree.length }).map((_, idx) => (
                      <div
                        key={`empty-${idx}`}
                        className="rounded-panel border border-dashed border-line bg-surface p-4 text-ink-faint"
                      >
                        <div className="text-sm font-bold">No entry yet</div>
                        <div className="text-xs mt-1">Be the first to post a score.</div>
                      </div>
                    ))}
                </div>

                <div className="overflow-hidden rounded-panel border border-line bg-surface">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                    <div className="text-sm font-bold text-ink">Top 25</div>
                    <div className="text-xs text-ink-faint">
                      {periods.find(p => p.id === period)?.label}
                    </div>
                  </div>
                  <div className="divide-y divide-[color:var(--color-line)]">
                    {rest.map((row, index) => (
                      <div
                        key={keyForRow(row, index)}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="tabular w-10 font-bold text-ink-faint">#{row.rank}</div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">
                              {row.username || 'Arcader'}
                            </div>
                            <div className="text-xs text-ink-faint">{row.user_id.slice(0, 6)}…</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="tabular text-lg font-bold text-coin">
                            {formatNumber(row.score)}
                          </div>
                          <div className="text-xs text-ink-faint">
                            {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </div>
                    ))}

                    {canLoad && normalizedRows.length > 0 && normalizedRows.length <= 3 && (
                      <div className="px-4 py-4 text-sm text-ink-muted">
                        Only a few scores have been posted so far. Keep playing!
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
