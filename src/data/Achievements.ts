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

      // Bubble Pop Achievements
      {
        id: 'bubble_first_pop',
        title: 'Pop Star',
        description: 'Pop your first bubble in Bubble Pop',
        icon: '🫧',
        gameId: 'bubble',
        category: 'progression',
        requirement: { type: 'bubbles_popped', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'bubble_popper',
        title: 'Bubble Popper',
        description: 'Pop 50 bubbles in Bubble Pop',
        icon: '💥',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'bubbles_popped', value: 50 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'bubble_master_popper',
        title: 'Master Popper',
        description: 'Pop 200 bubbles in a single game',
        icon: '🌟',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'bubbles_popped', value: 200 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'bubble_combo_starter',
        title: 'Combo Starter',
        description: 'Achieve a 5x combo in Bubble Pop',
        icon: '🔥',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'max_combo', value: 5 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'bubble_combo_master',
        title: 'Combo Master',
        description: 'Achieve a 10x combo in Bubble Pop',
        icon: '⚡',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'max_combo', value: 10 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'bubble_chain_reaction',
        title: 'Chain Reaction',
        description: 'Create a 5-chain cascade',
        icon: '🔗',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'max_chain', value: 5 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'bubble_fever_mode',
        title: 'Fever Mode',
        description: 'Reach Fever level 3 in Bubble Pop',
        icon: '🌡️',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'max_fever', value: 3 },
        reward: 175,
        unlocked: false
      },
      {
        id: 'bubble_fever_max',
        title: 'Maximum Fever',
        description: 'Reach maximum Fever level in Bubble Pop',
        icon: '🔥',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'max_fever', value: 5 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'bubble_powerup_user',
        title: 'Power Up!',
        description: 'Use 5 power-ups in Bubble Pop',
        icon: '💣',
        gameId: 'bubble',
        category: 'collection',
        requirement: { type: 'powerups_used', value: 5 },
        reward: 125,
        unlocked: false
      },
      {
        id: 'bubble_sharpshooter',
        title: 'Sharpshooter',
        description: 'Achieve 80% accuracy in a game',
        icon: '🎯',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'accuracy', value: 80 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'bubble_perfect_clear',
        title: 'Perfect Clear',
        description: 'Clear all bubbles from the board',
        icon: '✨',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'perfect_clears', value: 1 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'bubble_score_beginner',
        title: 'Bubble Scorer',
        description: 'Score 5,000 points in Bubble Pop',
        icon: '🔢',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'score', value: 5000 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'bubble_score_expert',
        title: 'Bubble Expert',
        description: 'Score 25,000 points in Bubble Pop',
        icon: '🏆',
        gameId: 'bubble',
        category: 'skill',
        requirement: { type: 'score', value: 25000 },
        reward: 300,
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
      },

      // ============= MUSIC LAB SECRET ACHIEVEMENTS =============
      {
        id: 'music_lab_discoverer',
        title: 'Lab Rat',
        description: 'Discover the secret Music Laboratory',
        icon: '🔬',
        category: 'collection',
        requirement: { type: 'music_lab_unlocked', value: 1 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'music_creator',
        title: 'Music Creator',
        description: 'Generate 10 custom tracks in the Music Lab',
        icon: '🎵',
        category: 'collection',
        requirement: { type: 'music_lab_tracks_generated', value: 10 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'music_collector',
        title: 'Music Collector',
        description: 'Save 5 favorite configurations',
        icon: '💾',
        category: 'collection',
        requirement: { type: 'music_lab_favorites', value: 5 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'music_sharer',
        title: 'Music Sharer',
        description: 'Share your first music creation',
        icon: '🔗',
        category: 'collection',
        requirement: { type: 'music_lab_shared', value: 1 },
        reward: 75,
        unlocked: false
      },
      {
        id: 'music_customizer',
        title: 'Game DJ',
        description: 'Customize music for 5 different games',
        icon: '🎮',
        category: 'collection',
        requirement: { type: 'music_lab_games_customized', value: 5 },
        reward: 200,
        unlocked: false
      },

      // ============= BOWLING ACHIEVEMENTS =============
      // Beginner Achievements
      {
        id: 'bowling_first_strike',
        title: 'First Strike',
        description: 'Get your first strike',
        icon: '🎳',
        gameId: 'bowling',
        category: 'progression',
        requirement: { type: 'strikes', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'bowling_first_spare',
        title: 'First Spare',
        description: 'Convert your first spare',
        icon: '🎳',
        gameId: 'bowling',
        category: 'progression',
        requirement: { type: 'spares', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'bowling_lane_debut',
        title: 'Lane Debut',
        description: 'Complete your first bowling game',
        icon: '🎳',
        gameId: 'bowling',
        category: 'progression',
        requirement: { type: 'totalScore', value: 1 },
        reward: 25,
        unlocked: false
      },

      // Skill Achievements
      {
        id: 'bowling_double_trouble',
        title: 'Double Trouble',
        description: 'Get 2 strikes in a row',
        icon: '🔥',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'maxConsecutiveStrikes', value: 2 },
        reward: 75,
        unlocked: false
      },
      {
        id: 'bowling_turkey',
        title: 'Turkey',
        description: 'Get 3 strikes in a row',
        icon: '🦃',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'maxConsecutiveStrikes', value: 3 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'bowling_clean_game',
        title: 'Clean Game',
        description: 'Complete a game with no open frames (all strikes or spares)',
        icon: '✨',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'cleanFrames', value: 10 },
        reward: 300,
        unlocked: false
      },

      // Score Milestone Achievements
      {
        id: 'bowling_century_club',
        title: 'Century Club',
        description: 'Score 100+ points in a single game',
        icon: '💯',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'totalScore', value: 100 },
        reward: 75,
        unlocked: false
      },
      {
        id: 'bowling_150_club',
        title: '150 Club',
        description: 'Score 150+ points in a single game',
        icon: '🏅',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'totalScore', value: 150 },
        reward: 125,
        unlocked: false
      },
      {
        id: 'bowling_200_club',
        title: '200 Club',
        description: 'Score 200+ points in a single game',
        icon: '🥈',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'totalScore', value: 200 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'bowling_high_roller',
        title: 'High Roller',
        description: 'Score 250+ points in a single game',
        icon: '🥇',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'totalScore', value: 250 },
        reward: 350,
        unlocked: false
      },
      {
        id: 'bowling_perfect_game',
        title: 'Perfect Game',
        description: 'Score a perfect 300!',
        icon: '👑',
        gameId: 'bowling',
        category: 'skill',
        requirement: { type: 'totalScore', value: 300 },
        reward: 1000,
        unlocked: false
      },

      // Fun/Negative Achievements
      {
        id: 'bowling_gutter_ball',
        title: 'Gutter Ball',
        description: 'Get a gutter ball (everyone starts somewhere!)',
        icon: '😅',
        gameId: 'bowling',
        category: 'gameplay',
        requirement: { type: 'gutterBalls', value: 1 },
        reward: 10,
        unlocked: false
      },
      {
        id: 'bowling_gutter_master',
        title: 'Gutter Master',
        description: 'Get 5 gutter balls in one game (ouch!)',
        icon: '🕳️',
        gameId: 'bowling',
        category: 'gameplay',
        requirement: { type: 'gutterBalls', value: 5 },
        reward: 25,
        unlocked: false
      },

      // ============= CRYSTAL CAVERNS (PLATFORM ADVENTURE) ACHIEVEMENTS =============
      // Combat Achievements
      {
        id: 'caverns_first_blood',
        title: 'First Blood',
        description: 'Defeat your first guard in Crystal Caverns',
        icon: '⚔️',
        gameId: 'platform-adventure',
        category: 'progression',
        requirement: { type: 'guards_defeated', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'caverns_captain_slayer',
        title: 'Captain Slayer',
        description: 'Defeat the Captain boss',
        icon: '🛡️',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'captain_defeated', value: 1 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'caverns_shadow_slayer',
        title: 'Shadow Slayer',
        description: 'Defeat the Shadow Guardian',
        icon: '👤',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'shadow_defeated', value: 1 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'caverns_parry_master',
        title: 'Parry Master',
        description: 'Block 50 attacks total in Crystal Caverns',
        icon: '🛡️',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'blocks_total', value: 50 },
        reward: 150,
        unlocked: false
      },

      // Collection Achievements
      {
        id: 'caverns_owl_finder',
        title: 'Owl Finder',
        description: 'Find the Golden Owl and complete the game',
        icon: '🦉',
        gameId: 'platform-adventure',
        category: 'progression',
        requirement: { type: 'owl_found', value: 1 },
        reward: 500,
        unlocked: false
      },
      {
        id: 'caverns_collector',
        title: 'Gem Collector',
        description: 'Collect 100 gems total in Crystal Caverns',
        icon: '💎',
        gameId: 'platform-adventure',
        category: 'collection',
        requirement: { type: 'gems_collected', value: 100 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'caverns_completionist',
        title: 'Completionist',
        description: 'Collect all gems in a level',
        icon: '✨',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'all_gems_level', value: 1 },
        reward: 100,
        unlocked: false
      },

      // Skill Achievements
      {
        id: 'caverns_flawless',
        title: 'Flawless',
        description: 'Complete a level without taking damage',
        icon: '💫',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'flawless_level', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'caverns_speedrunner',
        title: 'Speedrunner',
        description: 'Complete the entire game in under 8 minutes',
        icon: '⚡',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'speedrun_complete', value: 1 },
        reward: 400,
        unlocked: false
      },
      {
        id: 'caverns_time_lord',
        title: 'Time Lord',
        description: 'Finish a level with 60+ seconds remaining',
        icon: '⏰',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'time_bonus', value: 1 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'caverns_pacifist',
        title: 'Pacifist',
        description: 'Complete Level 1 without drawing your sword',
        icon: '🕊️',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'pacifist_level1', value: 1 },
        reward: 200,
        unlocked: false
      },

      // Score Achievements
      {
        id: 'caverns_high_scorer',
        title: 'Cave Explorer',
        description: 'Score 5,000 points in Crystal Caverns',
        icon: '🏆',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'score', value: 5000 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'caverns_master',
        title: 'Cavern Master',
        description: 'Score 15,000 points in Crystal Caverns',
        icon: '👑',
        gameId: 'platform-adventure',
        category: 'skill',
        requirement: { type: 'score', value: 15000 },
        reward: 300,
        unlocked: false
      }
    ];

