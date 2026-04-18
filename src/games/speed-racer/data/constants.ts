// Speed Racer — gameplay tuning constants
// All speeds in px/sec, accelerations in px/sec^2 (dt is in seconds).

export const CANVAS = {
  WIDTH: 800,
  HEIGHT: 600,
} as const;

export const ROAD = {
  X_MIN: 160,
  X_MAX: 640,
  WIDTH: 480,
  CENTER: 400,
  LANE_COUNT: 4,
} as const;

export const PLAYER = {
  WIDTH: 44,
  HEIGHT: 76,
  Y: 480,
  // Horizontal steering
  STEER_ACCEL: 1800,
  STEER_DECEL: 2400,
  STEER_MAX_SPEED: 380,
  // World scroll speed under player control
  BASE_SPEED: 360,
  BOOST_SPEED: 640,
  BRAKE_SPEED: 160,
  SPEED_ACCEL: 320,
  SPEED_DECEL: 480,
} as const;

export const ROAD_RENDER = {
  ROAD_COLOR: '#1a1a2e',
  EDGE_COLOR: '#FF1493',
  LANE_LINE_COLOR: '#00FFFF',
  CENTER_LINE_COLOR: '#FFFF00',
  GRASS_COLOR_TOP: '#0a001a',
  GRASS_COLOR_BOTTOM: '#1a0033',
  CENTER_LINE_LENGTH: 30,
  CENTER_LINE_GAP: 22,
  LANE_LINE_LENGTH: 24,
  LANE_LINE_GAP: 28,
} as const;

export const SCENERY = {
  POST_SPACING: 120,
  TREE_PARALLAX: 0.55,
  TREE_SPACING: 200,
} as const;
