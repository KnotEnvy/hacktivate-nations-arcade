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
          username: string;
          avatar: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_state: {
        Row: {
          user_id: string;
          level: number;
          experience: number;
          total_play_time: number;
          games_played: number;
          last_active_at: string | null;
          unlocked_tiers: number[];
          unlocked_games: string[];
          stats: Json;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          level?: number;
          experience?: number;
          total_play_time?: number;
          games_played?: number;
          last_active_at?: string | null;
          unlocked_tiers?: number[];
          unlocked_games?: string[];
          stats?: Json;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          level?: number;
          experience?: number;
          total_play_time?: number;
          games_played?: number;
          last_active_at?: string | null;
          unlocked_tiers?: number[];
          unlocked_games?: string[];
          stats?: Json;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          progress: number | null;
          unlocked_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
          progress?: number | null;
          unlocked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          progress?: number | null;
          unlocked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      challenge_assignments: {
        Row: {
          user_id: string;
          challenge_id: string;
          title: string;
          description: string;
          type: Database['public']['Enums']['challenge_type'];
          game_id: string | null;
          target: number;
          progress: number;
          reward: number;
          completed_at: string | null;
          expires_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          challenge_id: string;
          title: string;
          description: string;
          type: Database['public']['Enums']['challenge_type'];
          game_id?: string | null;
          target: number;
          progress?: number;
          reward?: number;
          completed_at?: string | null;
          expires_at: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          challenge_id?: string;
          title?: string;
          description?: string;
          type?: Database['public']['Enums']['challenge_type'];
          game_id?: string | null;
          target?: number;
          progress?: number;
          reward?: number;
          completed_at?: string | null;
          expires_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leaderboard_scores: {
        Row: {
          id: string;
          game_id: string;
          period: Database['public']['Enums']['leaderboard_period'];
          period_start: string;
          user_id: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          period: Database['public']['Enums']['leaderboard_period'];
          period_start: string;
          user_id: string;
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          period?: Database['public']['Enums']['leaderboard_period'];
          period_start?: string;
          user_id?: string;
          score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboards_view: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          username: string;
          avatar: string | null;
          score: number;
          rank: number;
          period: Database['public']['Enums']['leaderboard_period'];
          period_start: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      commit_trusted_game_session: {
        Args: {
          _user_id: string;
          _game_id: string;
          _score: number;
          _reward_awarded: number;
          _achievement_ids: string[];
          _next_games_played: number;
          _next_total_play_time: number;
          _next_stats: Json;
          _next_settings: Json;
          _challenge_progress_payload?: Json;
          _client_mutation_id?: string | null;
        };
        Returns: {
          balance: number;
          reward_awarded: number;
          duplicate: boolean;
          achievement_ids: string[];
        }[];
      };
      record_leaderboard_score: {
        Args: {
          game_id: string;
          score: number;
        };
        Returns: void;
      };
      upsert_leaderboard_score: {
        Args: {
          _user_id: string;
          _game_id: string;
          _period: Database['public']['Enums']['leaderboard_period'];
          _period_start: string;
          _score: number;
        };
        Returns: void;
      };
    };
    Enums: {
      leaderboard_period: 'daily' | 'weekly' | 'monthly' | 'all_time';
      challenge_type: 'daily' | 'weekly';
    };
  };
}
