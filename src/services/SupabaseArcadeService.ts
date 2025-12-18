import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase.types';
import { createSupabaseAccessTokenClient } from '@/lib/supabase';

type DbClient = SupabaseClient<Database>;
type LeaderboardPeriod = Database['public']['Enums']['leaderboard_period'];

export interface ProfileUpsertInput {
  id: string;
  username?: string | null;
  avatarUrl?: string | null;
  country?: string | null;
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

export interface GameSessionInput {
  userId: string;
  gameId: string;
  score: number;
  durationMs: number;
  metadata?: Json;
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
          username: input.username ?? null,
          avatar_url: input.avatarUrl ?? null,
          country: input.country ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertProfile');
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

  async recordGameSession(input: GameSessionInput, options?: SupabaseRequestOptions) {
    const client = this.getClient(options);
    const { data, error } = await client
      .from('game_sessions')
      .insert({
        user_id: input.userId,
        game_id: input.gameId,
        score: input.score,
        duration_ms: input.durationMs,
        metadata: input.metadata ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    throwOnError(error, 'recordGameSession');
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
        },
        { onConflict: 'user_id,achievement_id' }
      )
      .select()
      .single();

    throwOnError(error, 'upsertAchievement');
    return data;
  }

  async fetchLeaderboard(query: LeaderboardQuery) {
    const { data, error } = await this.client
      .from('leaderboards_view')
      .select('*')
      .eq('game_id', query.gameId)
      .eq('period', query.period ?? 'all_time')
      .order('score', { ascending: false })
      .limit(query.limit ?? 25);

    throwOnError(error, 'fetchLeaderboard');
    return data ?? [];
  }
}
