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
      },

      // Space Shooter Achievements
      {
        id: 'space_first_wave',
        title: 'Space Cadet',
        description: 'Complete your first wave in Space Shooter',
        icon: '🚀',
        gameId: 'space',
        category: 'progression',
        requirement: { type: 'waves_completed', value: 1 },
        reward: 75,
        unlocked: false
      },
      {
        id: 'space_boss_slayer',
        title: 'Boss Slayer',
        description: 'Defeat your first boss in Space Shooter',
        icon: '⚔️',
        gameId: 'space',
        category: 'skill',
        requirement: { type: 'bosses_defeated', value: 1 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'space_ace_pilot',
        title: 'Ace Pilot',
        description: 'Reach Stage 3 in Space Shooter',
        icon: '🛸',
        gameId: 'space',
        category: 'skill',
        requirement: { type: 'max_stage', value: 3 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'space_sharpshooter',
        title: 'Sharpshooter',
        description: 'Destroy 100 enemies in Space Shooter',
        icon: '🎯',
        gameId: 'space',
        category: 'skill',
        requirement: { type: 'enemies_destroyed', value: 100 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'space_power_collector',
        title: 'Power Collector',
        description: 'Collect 10 power-ups in Space Shooter',
        icon: '⚡',
        gameId: 'space',
        category: 'collection',
        requirement: { type: 'powerups_collected', value: 10 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'space_survivor',
        title: 'Space Survivor',
        description: 'Survive 5 minutes in Space Shooter',
        icon: '🕰️',
        gameId: 'space',
        category: 'skill',
        requirement: { type: 'survival_time', value: 300 },
        reward: 250,
        unlocked: false
      },

      // Memory Match Achievements
      {
        id: 'memory_first_match',
        title: 'Memory Starter',
        description: 'Make your first match in Memory Match',
        icon: '🧠',
        gameId: 'memory',
        category: 'progression',
        requirement: { type: 'matches_made', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'memory_perfect_level',
        title: 'Perfect Memory',
        description: 'Complete a level without mistakes',
        icon: '💫',
        gameId: 'memory',
        category: 'skill',
        requirement: { type: 'perfect_levels', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'memory_speed_demon',
        title: 'Memory Speed Demon',
        description: 'Complete a level in under 30 seconds',
        icon: '⚡',
        gameId: 'memory',
        category: 'skill',
        requirement: { type: 'fast_completion', value: 30 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'memory_master',
        title: 'Memory Master',
        description: 'Complete 10 levels in Memory Match',
        icon: '🏆',
        gameId: 'memory',
        category: 'progression',
        requirement: { type: 'levels_completed', value: 10 },
        reward: 300,
        unlocked: false
      },

      // Breakout Achievements
      {
        id: 'breakout_first_brick',
        title: 'Brick Breaker',
        description: 'Break your first brick in Breakout',
        icon: '🧱',
        gameId: 'breakout',
        category: 'progression',
        requirement: { type: 'bricks_broken', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'breakout_level_clear',
        title: 'Level Clearer',
        description: 'Clear your first level in Breakout',
        icon: '✨',
        gameId: 'breakout',
        category: 'progression',
        requirement: { type: 'levels_cleared', value: 1 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'breakout_power_user',
        title: 'Power User',
        description: 'Collect 5 power-ups in Breakout',
        icon: '🔋',
        gameId: 'breakout',
        category: 'collection',
        requirement: { type: 'powerups_collected', value: 5 },
        reward: 125,
        unlocked: false
      },
      {
        id: 'breakout_demolisher',
        title: 'Demolisher',
        description: 'Break 100 bricks total in Breakout',
        icon: '💥',
        gameId: 'breakout',
        category: 'skill',
        requirement: { type: 'total_bricks_broken', value: 100 },
        reward: 200,
        unlocked: false
      },

      // Minesweeper Achievements
      {
        id: 'minesweeper_first_clear',
        title: 'Minesweeper Rookie',
        description: 'Clear your first cell in Minesweeper',
        icon: '💣',
        gameId: 'minesweeper',
        category: 'progression',
        requirement: { type: 'cells_cleared', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'minesweeper_first_win',
        title: 'Mine Detector',
        description: 'Win your first Minesweeper game',
        icon: '🏁',
        gameId: 'minesweeper',
        category: 'skill',
        requirement: { type: 'games_won', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'minesweeper_speed_clearer',
        title: 'Speed Clearer',
        description: 'Win a game in under 60 seconds',
        icon: '⏱️',
        gameId: 'minesweeper',
        category: 'skill',
        requirement: { type: 'fast_win', value: 60 },
        reward: 250,
        unlocked: false
      },

      // Tap Dodge Achievements
      {
        id: 'tapdodge_survivor',
        title: 'Dodge Master',
        description: 'Survive 30 seconds in Tap Dodge',
        icon: '🤹',
        gameId: 'tapdodge',
        category: 'skill',
        requirement: { type: 'survival_time', value: 30 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'tapdodge_veteran',
        title: 'Dodge Veteran',
        description: 'Survive 60 seconds in Tap Dodge',
        icon: '🥋',
        gameId: 'tapdodge',
        category: 'skill',
        requirement: { type: 'survival_time', value: 60 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'tapdodge_master',
        title: 'Dodge Legend',
        description: 'Survive 120 seconds in Tap Dodge',
        icon: '🏅',
        gameId: 'tapdodge',
        category: 'skill',
        requirement: { type: 'survival_time', value: 120 },
        reward: 400,
        unlocked: false
      },

      // Cross-Game Meta Achievements
      {
        id: 'game_explorer',
        title: 'Game Explorer',
        description: 'Try 5 different games',
        icon: '🗺️',
        category: 'progression',
        requirement: { type: 'unique_games_played', value: 5 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'arcade_master',
        title: 'Arcade Master',
        description: 'Score 1000+ in 3 different games',
        icon: '👑',
        category: 'skill',
        requirement: { type: 'high_scores_across_games', value: 3 },
        reward: 500,
        unlocked: false
      },
      {
        id: 'daily_player',
        title: 'Daily Player',
        description: 'Play games for 7 consecutive days',
        icon: '📅',
        category: 'progression',
        requirement: { type: 'consecutive_days', value: 7 },
        reward: 300,
        unlocked: false
      }
    ];

