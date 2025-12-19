// ===== src/data/Games.ts =====
import type { GameManifest } from '@/lib/types';

export const AVAILABLE_GAMES: GameManifest[] = [
  // Tier 0
  {
    id: 'runner',
    title: 'Endless Runner',
    thumbnail: '/games/runner/runner-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 0,
    description: 'Jump and collect coins in this fast-paced endless runner!'
  },
  {
    id: 'snake',
    title: 'Snake',
    thumbnail: '/games/snake/snake-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Classic snake action. Coming soon!'
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    thumbnail: '/games/minesweeper/minesweeper-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Clear the board without hitting mines!'
  },
  {
    id: 'breakout',
    title: 'Mini Breakout',
    thumbnail: '/games/breakout/breakout-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Break bricks with a paddle.'
  },
  {
    id: 'memory',
    title: 'Memory Match',
    thumbnail: '/games/memory/memory-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Flip cards to find pairs!'
  },
  {
    id: 'tapdodge',
    title: 'Tap Dodge',
    thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Tap to dodge obstacles.'
  },

  // Tier 1
  {
    id: 'puzzle',
    title: 'Block Puzzle',
    thumbnail: '/games/puzzle/puzzle-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 75,
    tier: 1,
    description: 'Match blocks to clear lines.'
  },
  {
    id: 'color-drop',
    title: 'Color Drop',
    thumbnail: '/games/color-drop/color-drop-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 1,
    description: 'Match colorful gems in this addictive puzzle game! Build combos and create special gems!'
  },
  {
    id: 'tower-builder',
    title: 'Tower Builder',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 80,
    tier: 1,
    description: 'Coming soon!'
  },
  {
  id: 'mini-golf',
  title: 'Mini Golf',
  thumbnail: '/games/mini-golf/mini-golf-thumb.svg',
  inputSchema: ['keyboard', 'touch'],
  assetBudgetKB: 90,
  tier: 1,
  description: 'Master 9 holes of challenging mini golf! Avoid hazards, beat par, and sink that hole-in-one!'
},
  {
    id: 'bubble-pop',
    title: 'Bubble Pop',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 100,
    tier: 1,
    description: 'Coming soon!'
  },

  // Tier 2
  {
    id: 'space',
    title: 'Space Shooter',
    thumbnail: '/games/space/space-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 100,
    tier: 2,
    description: "Defend Earth from waves of alien ships in this fast-paced shooter!"
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    thumbnail: '/games/asteroids/asteroids-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 120,
    tier: 2,
    description: 'Blast space rocks in this retro shooter!'
  },
  {
    id: 'frog-hop',
    title: 'Frog Hop',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 120,
    tier: 2,
    description: 'Coming soon!'
  },
  {
    id: 'platform-adventure',
    title: 'Platform Adventure',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 130,
    tier: 2,
    description: 'Coming soon!'
  },
  {
    id: 'speed-racer',
    title: 'Speed Racer',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 130,
    tier: 2,
    description: 'Coming soon!'
  },

  // Tier 3
  {
    id: 'dungeon-crawl',
    title: 'Dungeon Crawl',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 160,
    tier: 3,
    description: 'Coming soon!'
  },
  {
    id: 'target-shooter',
    title: 'Target Shooter',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 160,
    tier: 3,
    description: 'Coming soon!'
  },
  {
    id: 'puzzle-quest',
    title: 'Puzzle Quest',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 180,
    tier: 3,
    description: 'Coming soon!'
  },
  {
    id: 'ice-hockey',
    title: 'Ice Hockey',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 200,
    tier: 3,
    description: 'Coming soon!'
  },
  {
    id: 'block-defense',
    title: 'Block Defense',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 200,
    tier: 3,
    description: 'Coming soon!'
  },

  // Tier 4
  {
    id: 'side-scroll-action',
    title: 'Side-Scroll Action',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 250,
    tier: 4,
    description: 'Coming soon!'
  },
  {
    id: 'sim-farm',
    title: 'Sim Farm',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 250,
    tier: 4,
    description: 'Coming soon!'
  },
  {
    id: 'battle-arena',
    title: 'Battle Arena',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 260,
    tier: 4,
    description: 'Coming soon!'
  },
  {
    id: 'puzzle-rpg',
    title: 'Puzzle RPG',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 260,
    tier: 4,
    description: 'Coming soon!'
  },
  {
    id: 'rhythm-challenge',
    title: 'Rhythm Challenge',
    thumbnail: '/games/coming-soon-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 280,
    tier: 4,
    description: 'Coming soon!'
  }
];
