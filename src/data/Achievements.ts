import type { Achievement } from '@/services/AchievementService';

export const ACHIEVEMENTS: Achievement[] = [
      // Gameplay achievements
      {
        id: 'first_jump',
        title: 'Taking Flight',
        description: 'Jump for the first time',
        icon: '🦅',
        category: 'gameplay',
        requirement: { type: 'jumps', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'coin_collector',
        title: 'Coin Collector',
        description: 'Collect 100 coins total',
        icon: '💰',
        category: 'collection',
        requirement: { type: 'total_coins', value: 100 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Reach 2x speed',
        icon: '⚡',
        category: 'skill',
        requirement: { type: 'max_speed', value: 2 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'marathon_runner',
        title: 'Marathon Runner',
        description: 'Run 5000 meters in a single game',
        icon: '🏃‍♂️',
        category: 'skill',
        requirement: { type: 'distance', value: 5000 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'power_user',
        title: 'Power User',
        description: 'Use all 4 types of power-ups',
        icon: '🌟',
        category: 'collection',
        requirement: { type: 'powerup_types', value: 4 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'combo_master',
        title: 'Combo Master',
        description: 'Achieve a 15x combo',
        icon: '🔥',
        category: 'skill',
        requirement: { type: 'max_combo', value: 15 },
        reward: 400,
        unlocked: false
      },
      
      // Progression achievements
      {
        id: 'spender',
        title: 'Big Spender',
        description: 'Unlock your first paid game',
        icon: '🎮',
        category: 'progression',
        requirement: { type: 'games_unlocked', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'completionist',
        title: 'Completionist',
        description: 'Unlock all available games',
        icon: '🏆',
        category: 'progression',
        requirement: { type: 'all_games_unlocked', value: 1 },
        reward: 500,
        unlocked: false
      },
      {
        id: 'dedicated_player',
        title: 'Dedicated Player',
        description: 'Play for 30 minutes total',
        icon: '⏰',
        category: 'progression',
        requirement: { type: 'total_playtime', value: 1800 }, // 30 minutes in seconds
        reward: 200,
        unlocked: false
      },
      
      // Collection achievements
      {
        id: 'rich_player',
        title: 'Rich Player',
        description: 'Accumulate 10,000 coins',
        icon: '💎',
        category: 'collection',
        requirement: { type: 'total_coins_earned', value: 10000 },
        reward: 1000,
        unlocked: false
      },

      // Additional achievements
      {
        id: 'first_game',
        title: 'Getting Started',
        description: 'Play your first game',
        icon: '🎲',
        category: 'progression',
        requirement: { type: 'games_played', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'seasoned_gamer',
        title: 'Seasoned Gamer',
        description: 'Play 10 games',
        icon: '🕹️',
        category: 'progression',
        requirement: { type: 'games_played', value: 10 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'jump_fanatic',
        title: 'Jump Fanatic',
        description: 'Perform 50 jumps in total',
        icon: '🐰',
        category: 'gameplay',
        requirement: { type: 'total_jumps', value: 50 },
        reward: 75,
        unlocked: false
      },
      {
        id: 'powerup_enthusiast',
        title: 'Power-Up Enthusiast',
        description: 'Use 20 power-ups in total',
        icon: '🔋',
        category: 'skill',
        requirement: { type: 'powerups_total', value: 20 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'speed_freak',
        title: 'Speed Freak',
        description: 'Reach 3.5x speed',
        icon: '💨',
        category: 'skill',
        requirement: { type: 'max_speed', value: 3.5 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'combo_legend',
        title: 'Combo Legend',
        description: 'Achieve a 25x combo',
        icon: '⚔️',
        category: 'skill',
        requirement: { type: 'max_combo', value: 25 },
        reward: 500,
        unlocked: false
      },
      {
        id: 'wealthy_merchant',
        title: 'Wealthy Merchant',
        description: 'Earn 50,000 coins in total',
        icon: '🏅',
        category: 'collection',
        requirement: { type: 'total_coins_earned', value: 50000 },
        reward: 2000,
        unlocked: false
      },
      {
        id: 'puzzle_rookie',
        title: 'Puzzle Rookie',
        description: 'Clear 10 lines in Block Puzzle',
        icon: '🧱',
        gameId: 'puzzle',
        category: 'gameplay',
        requirement: { type: 'lines_cleared', value: 10 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'puzzle_veteran',
        title: 'Puzzle Veteran',
        description: 'Clear 100 lines in Block Puzzle',
        icon: '🏗️',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'lines_cleared', value: 100 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'puzzle_master',
        title: 'Puzzle Master',
        description: 'Reach level 10 in Block Puzzle',
        icon: '🧩',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'puzzle_level', value: 10 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'puzzle_score_beginner',
        title: 'Puzzle Scorer',
        description: 'Score 1,000 points in Block Puzzle',
        icon: '🔢',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'score', value: 1000 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'puzzle_score_pro',
        title: 'Puzzle Pro',
        description: 'Score 5,000 points in Block Puzzle',
        icon: '🧠',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'score', value: 5000 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'puzzle_tetris',
        title: 'Tetris!',
        description: 'Clear a Tetris in Block Puzzle',
        icon: '🎯',
        gameId: 'puzzle',
        category: 'gameplay',
        requirement: { type: 'tetris_count', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'puzzle_tetris_king',
        title: 'Tetris King',
        description: 'Clear 10 Tetrises in Block Puzzle',
        icon: '👑',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'tetris_count', value: 10 },
        reward: 400,
        unlocked: false
      },
      {
        id: 'puzzle_theme_explorer',
        title: 'Theme Explorer',
        description: 'Experience 3 different themes',
        icon: '🎨',
        gameId: 'puzzle',
        category: 'gameplay',
        requirement: { type: 'unique_themes', value: 3 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'puzzle_theme_master',
        title: 'Theme Connoisseur',
        description: 'Experience all themes in Block Puzzle',
        icon: '🏅',
        gameId: 'puzzle',
        category: 'skill',
        requirement: { type: 'unique_themes', value: 5 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'snake_rookie',
        title: 'Snake Rookie',
        description: 'Score 100 points in Snake',
        icon: '🐍',
        gameId: 'snake',
        category: 'gameplay',
        requirement: { type: 'score', value: 100 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'snake_veteran',
        title: 'Snake Veteran',
        description: 'Score 300 points in Snake',
        icon: '🐍',
        gameId: 'snake',
        category: 'skill',
        requirement: { type: 'score', value: 300 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'snake_master',
        title: 'Snake Master',
        description: 'Score 600 points in Snake',
        icon: '👑',
        gameId: 'snake',
        category: 'skill',
        requirement: { type: 'score', value: 600 },
        reward: 300,
        unlocked: false
      }
    ];

