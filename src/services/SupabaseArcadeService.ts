import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase.types';
import { createSupabaseAccessTokenClient } from '@/lib/supabase';

type DbClient = SupabaseClient<Database>;
type LeaderboardPeriod = Database['public']['Enums']['leaderboard_period'];

export interface ProfileUpsertInput {
  id: string;
  username?: string | null;
  avatar?: string | null;
}

export interface PlayerStateUpsertInput {
  userId: string;
  level: number;
  experience: number;
  totalPlayTime: number;
  gamesPlayed: number;
  lastActiveAt?: string | null;
  unlockedTiers: number[];
  unlockedGames: string[];
  stats: Json;
  settings?: Json;
  updatedAt?: string;
}

export interface WalletUpsertInput {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  updatedAt?: string;
}

export interface AchievementUpsertInput {
  userId: string;
  achievementId: string;
  progress?: number | null;
  unlockedAt?: string | null;
}

export interface ChallengeUpsertInput {
  userId: string;
  challengeId: string;
  title: string;
  description: string;
  type: Database['public']['Enums']['challenge_type'];
  gameId?: string | null;
  target: number;
  progress: number;
  reward: number;
  completedAt?: string | null;
  expiresAt: string;
  updatedAt?: string;
}

export interface LeaderboardScoreInput {
  gameId: string;
  score: number;
}

export interface LeaderboardQuery {
  gameId: string;
  period?: LeaderboardPeriod;
  limit?: number;
}

interface SupabaseRequestOptions {
  accessToken?: string;
}

const throwOnError = (error: PostgrestError | null, context: string) => {
  if (error) {
    const meta = [error.code, error.details, error.hint].filter(Boolean).join(' | ');
    throw new Error(`[Supabase] ${context}: ${error.message}${meta ? ` | ${meta}` : ''}`);
  }
};

// Thin service to keep Supabase calls in one place so we can wire games
// without touching the existing local-only services.
export class SupabaseArcadeService {
  constructor(private readonly client: DbClient) {}

  private getClient(options?: SupabaseRequestOptions) {
    return options?.accessToken ? createSupabaseAccessTokenClient(options.accessToken) : this.client;
  }

  async upsertProfile(input: ProfileUpsertInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('profiles')
      .upsert(
        {
          id: input.id,
          username: input.username ?? 'Player',
          avatar: input.avatar ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertProfile');
    return data;
  }

  async fetchProfile(userId: string, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error?.code === 'PGRST116') {
      return null;
    }

    throwOnError(error, 'fetchProfile');
    return data;
  }

  async fetchPlayerState(userId: string, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('player_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error?.code === 'PGRST116') {
      return null;
    }

    throwOnError(error, 'fetchPlayerState');
    return data;
  }

  async upsertPlayerState(input: PlayerStateUpsertInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('player_state')
      .upsert(
        {
          user_id: input.userId,
          level: input.level,
          experience: input.experience,
          total_play_time: input.totalPlayTime,
          games_played: input.gamesPlayed,
          last_active_at: input.lastActiveAt ?? null,
          unlocked_tiers: input.unlockedTiers,
          unlocked_games: input.unlockedGames,
          stats: input.stats ?? {},
          settings: input.settings ?? {},
          updated_at: input.updatedAt ?? new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertPlayerState');
    return data;
  }

  async upsertWallet(input: WalletUpsertInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('wallets')
      .upsert(
        {
          user_id: input.userId,
          balance: input.balance,
          lifetime_earned: input.lifetimeEarned,
          updated_at: input.updatedAt ?? new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertWallet');
    return data;
  }

  async fetchWallet(userId: string, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error?.code === 'PGRST116') {
      return null;
    }

    throwOnError(error, 'fetchWallet');
    return data;
  }

  async upsertAchievement(input: AchievementUpsertInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('achievements')
      .upsert(
        {
          user_id: input.userId,
          achievement_id: input.achievementId,
          progress: input.progress ?? null,
          unlocked_at: input.unlockedAt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,achievement_id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertAchievement');
    return data;
  }

  async fetchAchievements(userId: string, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('achievements')
      .select('*')
      .eq('user_id', userId);

    throwOnError(error, 'fetchAchievements');
    return data ?? [];
  }

  async upsertChallenges(challenges: ChallengeUpsertInput[], options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    if (challenges.length === 0) return [];
    const payload = challenges.map(challenge => ({
      user_id: challenge.userId,
      challenge_id: challenge.challengeId,
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      game_id: challenge.gameId ?? null,
      target: challenge.target,
      progress: challenge.progress,
      reward: challenge.reward,
      completed_at: challenge.completedAt ?? null,
      expires_at: challenge.expiresAt,
      updated_at: challenge.updatedAt ?? new Date().toISOString(),
    }));
    const { data, error } = await client
      .from('challenge_assignments')
      .upsert(payload, { onConflict: 'user_id,challenge_id' })
      .select();

    throwOnError(error, 'upsertChallenges');
    return data ?? [];
  }

  async fetchChallenges(userId: string, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('challenge_assignments')
      .select('*')
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString());

    throwOnError(error, 'fetchChallenges');
    return data ?? [];
  }

  async recordLeaderboardScore(input: LeaderboardScoreInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { error } = await client.rpc('record_leaderboard_score', {
      game_id: input.gameId,
      score: input.score,
    });

    throwOnError(error, 'recordLeaderboardScore');
  }

  async fetchLeaderboard(query: LeaderboardQuery) {
    const period = query.period ?? 'all_time';
    const now = new Date();
    const toDateKey = (value: Date) => value.toISOString().slice(0, 10);
    const getWeekStartUtc = (value: Date) => {
      const utc = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
      const day = utc.getUTCDay();
      const diff = (day + 6) % 7;
      utc.setUTCDate(utc.getUTCDate() - diff);
      return utc;
    };
    const periodStart =
      period === 'all_time'
        ? '1970-01-01'
        : period === 'daily'
          ? toDateKey(now)
          : period === 'weekly'
            ? toDateKey(getWeekStartUtc(now))
            : toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const { data, error } = await this.client
      .from('leaderboards_view')
      .select('*')
      .eq('game_id', query.gameId)
      .eq('period', period)
      .eq('period_start', periodStart)
      .order('score', { ascending: false })
      .limit(query.limit ?? 25);

    throwOnError(error, 'fetchLeaderboard');
    return data ?? [];
  }
}
