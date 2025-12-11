'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import type { Database } from '@/lib/supabase.types';
import { AVAILABLE_GAMES } from '@/data/Games';

type LeaderboardRow = Database['public']['Tables']['leaderboards_view']['Row'];
type Period = Database['public']['Enums']['leaderboard_period'];

interface LeaderboardPanelProps {
  supabaseService: SupabaseArcadeService | null;
  signedIn: boolean;
}

const periods: Period[] = ['daily', 'weekly', 'monthly', 'all_time'];

export function LeaderboardPanel({ supabaseService, signedIn }: LeaderboardPanelProps) {
  const [gameId, setGameId] = useState<string>(AVAILABLE_GAMES[0]?.id ?? 'runner');
  const [period, setPeriod] = useState<Period>('all_time');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = useMemo(() => signedIn && !!supabaseService, [signedIn, supabaseService]);

  useEffect(() => {
    if (!canLoad) {
      setRows([]);
      return;
    }
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await supabaseService!.fetchLeaderboard({
          gameId,
          period,
          limit: 10,
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
  }, [canLoad, gameId, period, supabaseService]);

  return (
    <div className="arcade-panel">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-white">Leaderboards</h3>
          <p className="text-xs text-gray-400">Top scores by game and period</p>
        </div>
        <div className="flex gap-2">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1 text-xs rounded-md ${
                period === p ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <select
          value={gameId}
          onChange={event => setGameId(event.target.value)}
          className="w-full bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {AVAILABLE_GAMES.map(game => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
      </div>

      {!signedIn && (
        <div className="rounded-md bg-gray-800 text-gray-200 text-sm p-3 border border-gray-700">
          Sign in to view and post leaderboard scores.
        </div>
      )}

      {signedIn && !supabaseService && (
        <div className="rounded-md bg-gray-800 text-orange-200 text-sm p-3 border border-orange-600/60">
          Supabase not configured; scores stay local.
        </div>
      )}

      {signedIn && supabaseService && (
        <div className="space-y-2">
          {loading && <div className="text-sm text-gray-300">Loading...</div>}
          {error && (
            <div className="text-sm text-red-200 bg-red-900/50 border border-red-700 rounded-md p-2">
              {error}
            </div>
          )}
          {!loading && rows.length === 0 && !error && (
            <div className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-md p-2">
              No scores yet for this period.
            </div>
          )}
          {rows.map(row => (
            <div
              key={`${row.game_id}-${row.user_id}-${row.rank}-${row.period}`}
              className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-purple-300 font-semibold">#{row.rank}</span>
                <div>
                  <div className="text-white text-sm font-semibold">
                    {row.username || 'Arcader'}
                  </div>
                  <div className="text-xs text-gray-400">{row.user_id.slice(0, 6)}...</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg text-yellow-300 font-bold">{row.score}</div>
                <div className="text-xs text-gray-400 capitalize">{row.period.replace('_', ' ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
