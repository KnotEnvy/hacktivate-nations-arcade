export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          country: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      wallets: {
        Row: {
          user_id: string;
          balance: number;
          lifetime_earned: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          balance?: number;
          lifetime_earned?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          balance?: number;
          lifetime_earned?: number;
          updated_at?: string;
        };
      };
      achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          progress: number | null;
          unlocked_at: string | null;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          progress?: number | null;
          unlocked_at?: string | null;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          progress?: number | null;
          unlocked_at?: string | null;
        };
      };
      game_sessions: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          score: number;
          duration_ms: number;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          score: number;
          duration_ms: number;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: string;
          score?: number;
          duration_ms?: number;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      leaderboards_view: {
        Row: {
          game_id: string;
          user_id: string;
          username: string | null;
          avatar_url: string | null;
          score: number;
          rank: number;
          period: Database['public']['Enums']['leaderboard_period'];
          created_at: string | null;
        };
        Insert: {
          game_id?: string;
          user_id?: string;
          username?: string | null;
          avatar_url?: string | null;
          score?: number;
          rank?: number;
          period?: Database['public']['Enums']['leaderboard_period'];
          created_at?: string | null;
        };
        Update: {
          game_id?: string;
          user_id?: string;
          username?: string | null;
          avatar_url?: string | null;
          score?: number;
          rank?: number;
          period?: Database['public']['Enums']['leaderboard_period'];
          created_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      leaderboard_period: 'daily' | 'weekly' | 'monthly' | 'all_time';
    };
  };
}
