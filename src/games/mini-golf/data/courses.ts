// ===== src/games/minigolf/data/courses.ts =====

import { ObstacleConfig } from '../entities/Obstacle';
import { CourseBounds } from '../systems/PhysicsSystem';

export interface Decoration {
  type: 'tree' | 'rock' | 'flower' | 'cactus' | 'lamp';
  x: number;
  y: number;
  size?: number;
}

export interface CourseData {
  name: string;
  par: number;
  startX: number;
  startY: number;
  holeX: number;
  holeY: number;
  bounds: CourseBounds;
  obstacles: ObstacleConfig[];
  hasWind: boolean;
  theme: 'outdoor' | 'indoor' | 'desert' | 'night';
  decorations?: Decoration[];
}

export const COURSES: CourseData[] = [
  // ===== HOLE 1: Simple Straight Shot =====
  {
    name: 'The Opener',
    par: 2,
    startX: 200,
    startY: 500,
    holeX: 200,
    holeY: 150,
    bounds: {
      points: [
        { x: 100, y: 70 },
        { x: 300, y: 70 },
        { x: 300, y: 580 },
        { x: 100, y: 580 },
      ]
    },
    obstacles: [],
    hasWind: false,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 50, y: 300, size: 1.2 },
      { type: 'tree', x: 350, y: 200, size: 0.9 },
      { type: 'flower', x: 80, y: 450 },
      { type: 'flower', x: 320, y: 380 },
      { type: 'flower', x: 70, y: 180 },
    ]
  },

  // ===== HOLE 2: L-Shaped =====
  {
    name: 'The L',
    par: 3,
    startX: 100,
    startY: 500,
    holeX: 320,
    holeY: 150,
    bounds: {
      points: [
        { x: 50, y: 70 },
        { x: 380, y: 70 },
        { x: 380, y: 320 },
        { x: 180, y: 320 },
        { x: 180, y: 580 },
        { x: 50, y: 580 },
      ]
    },
    obstacles: [
      { type: 'wall', x: 180, y: 320, width: 20, height: 120 },
    ],
    hasWind: false,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 250, y: 450, size: 1 },
      { type: 'rock', x: 30, y: 250, size: 1.5 },
    ]
  },

  // ===== HOLE 3: Water Hazard Introduction =====
  {
    name: 'Pond Hop',
    par: 3,
    startX: 200,
    startY: 520,
    holeX: 200,
    holeY: 120,
    bounds: {
      points: [
        { x: 80, y: 70 },
        { x: 320, y: 70 },
        { x: 320, y: 580 },
        { x: 80, y: 580 },
      ]
    },
    obstacles: [
      { type: 'water', x: 120, y: 280, width: 160, height: 80 },
    ],
    hasWind: false,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 50, y: 200, size: 1 },
      { type: 'tree', x: 350, y: 400, size: 1.1 },
      { type: 'flower', x: 100, y: 450 },
      { type: 'flower', x: 300, y: 180 },
    ]
  },

  // ===== HOLE 4: Sand Bunkers =====
  {
    name: 'Desert Oasis',
    par: 3,
    startX: 100,
    startY: 500,
    holeX: 300,
    holeY: 150,
    bounds: {
      points: [
        { x: 50, y: 70 },
        { x: 380, y: 70 },
        { x: 380, y: 580 },
        { x: 50, y: 580 },
      ]
    },
    obstacles: [
      { type: 'sand', x: 150, y: 200, width: 80, height: 100 },
      { type: 'sand', x: 200, y: 380, width: 100, height: 70 },
    ],
    hasWind: true,
    theme: 'desert',
    decorations: [
      { type: 'cactus', x: 40, y: 300, size: 1 },
      { type: 'cactus', x: 360, y: 250, size: 0.8 },
      { type: 'rock', x: 350, y: 500, size: 1.2 },
    ]
  },

  // ===== HOLE 5: Bumper Madness =====
  {
    name: 'Pinball',
    par: 3,
    startX: 200,
    startY: 520,
    holeX: 200,
    holeY: 120,
    bounds: {
      points: [
        { x: 80, y: 70 },
        { x: 320, y: 70 },
        { x: 320, y: 580 },
        { x: 80, y: 580 },
      ]
    },
    obstacles: [
      { type: 'bumper', x: 140, y: 250, width: 40, height: 40 },
      { type: 'bumper', x: 220, y: 250, width: 40, height: 40 },
      { type: 'bumper', x: 180, y: 350, width: 40, height: 40 },
    ],
    hasWind: false,
    theme: 'indoor',
    decorations: []
  },

  // ===== HOLE 6: Narrow Corridor =====
  {
    name: 'The Gauntlet',
    par: 4,
    startX: 100,
    startY: 520,
    holeX: 320,
    holeY: 520,
    bounds: {
      points: [
        { x: 50, y: 70 },
        { x: 380, y: 70 },
        { x: 380, y: 580 },
        { x: 50, y: 580 },
      ]
    },
    obstacles: [
      // Central walls creating S-curve
      { type: 'wall', x: 50, y: 200, width: 200, height: 15 },
      { type: 'wall', x: 150, y: 350, width: 230, height: 15 },
      { type: 'water', x: 280, y: 150, width: 80, height: 50 },
      { type: 'sand', x: 70, y: 400, width: 60, height: 60 },
    ],
    hasWind: true,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 30, y: 140, size: 0.8 },
      { type: 'tree', x: 370, y: 300, size: 0.9 },
    ]
  },

  // ===== HOLE 7: Windmill Challenge =====
  {
    name: 'Windmill Way',
    par: 4,
    startX: 100,
    startY: 500,
    holeX: 320,
    holeY: 150,
    bounds: {
      points: [
        { x: 50, y: 70 },
        { x: 380, y: 70 },
        { x: 380, y: 350 },
        { x: 220, y: 350 },
        { x: 220, y: 580 },
        { x: 50, y: 580 },
      ]
    },
    obstacles: [
      { type: 'windmill', x: 180, y: 320, width: 60, height: 30, speed: 2 },
      { type: 'wall', x: 220, y: 350, width: 15, height: 100 },
    ],
    hasWind: true,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 300, y: 450, size: 1.2 },
      { type: 'flower', x: 100, y: 200 },
      { type: 'flower', x: 350, y: 280 },
    ]
  },

  // ===== HOLE 8: Night Course =====
  {
    name: 'Midnight Magic',
    par: 4,
    startX: 200,
    startY: 520,
    holeX: 200,
    holeY: 100,
    bounds: {
      points: [
        { x: 80, y: 70 },
        { x: 320, y: 70 },
        { x: 350, y: 300 },
        { x: 320, y: 580 },
        { x: 80, y: 580 },
        { x: 50, y: 300 },
      ]
    },
    obstacles: [
      { type: 'water', x: 100, y: 250, width: 60, height: 100 },
      { type: 'water', x: 240, y: 300, width: 60, height: 100 },
      { type: 'bumper', x: 180, y: 200, width: 35, height: 35 },
      { type: 'bumper', x: 180, y: 420, width: 35, height: 35 },
    ],
    hasWind: false,
    theme: 'night',
    decorations: [
      { type: 'lamp', x: 60, y: 180 },
      { type: 'lamp', x: 340, y: 200 },
      { type: 'lamp', x: 60, y: 450 },
      { type: 'lamp', x: 340, y: 470 },
    ]
  },

  // ===== HOLE 9: The Grand Finale =====
  {
    name: 'The Finale',
    par: 5,
    startX: 80,
    startY: 520,
    holeX: 320,
    holeY: 100,
    bounds: {
      points: [
        { x: 30, y: 70 },
        { x: 380, y: 70 },
        { x: 380, y: 580 },
        { x: 30, y: 580 },
      ]
    },
    obstacles: [
      // Water hazards
      { type: 'water', x: 30, y: 280, width: 100, height: 60 },
      { type: 'water', x: 280, y: 350, width: 100, height: 60 },
      
      // Sand bunkers
      { type: 'sand', x: 200, y: 150, width: 70, height: 50 },
      { type: 'sand', x: 100, y: 420, width: 80, height: 50 },
      
      // Walls creating maze
      { type: 'wall', x: 130, y: 200, width: 15, height: 120 },
      { type: 'wall', x: 260, y: 180, width: 15, height: 100 },
      { type: 'wall', x: 180, y: 450, width: 100, height: 15 },
      
      // Bumpers for chaos
      { type: 'bumper', x: 200, y: 300, width: 35, height: 35 },
      { type: 'bumper', x: 80, y: 150, width: 30, height: 30 },
    ],
    hasWind: true,
    theme: 'outdoor',
    decorations: [
      { type: 'tree', x: 360, y: 500, size: 1.3 },
      { type: 'tree', x: 20, y: 130, size: 1 },
      { type: 'rock', x: 350, y: 250, size: 1 },
      { type: 'flower', x: 300, y: 500 },
      { type: 'flower', x: 50, y: 380 },
      { type: 'flower', x: 370, y: 150 },
    ]
  },
];
