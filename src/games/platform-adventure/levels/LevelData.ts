// ===== src/games/platform-adventure/levels/LevelData.ts =====
import { TileType, TILE_SIZE } from '../data/TileTypes';

export interface LevelDefinition {
    name: string;
    width: number;   // In tiles
    height: number;  // In tiles
    tiles: string[]; // Row strings using char codes
    timeBonus: number; // Seconds added when reached
}

// Tile character mapping
const CHAR_MAP: Record<string, TileType> = {
    ' ': 'empty',
    '#': 'wall',
    '=': 'floor',
    '-': 'platform',
    '|': 'pillar',
    '_': 'ledge',
    '^': 'spikes',
    'X': 'chomper',
    '~': 'loose',
    'G': 'gate',
    '*': 'switch',
    'D': 'door',
    'T': 'torch',
    'h': 'potion_hp',
    'H': 'potion_max',
    'g': 'gem',
    't': 'time',
    'E': 'guard',
    'P': 'player',
    'O': 'owl',
};

export function parseTile(char: string): TileType {
    return CHAR_MAP[char] || 'empty';
}

// ===== LEVEL DEFINITIONS =====

export const LEVEL_1: LevelDefinition = {
    name: 'The Descent',
    width: 20,
    height: 12,
    timeBonus: 60,
    tiles: [
        '####################',
        '#       T          #',
        '#                  #',
        '#   P              #',
        '#====      ====    #',
        '#    g            T#',
        '#         ====     #',
        '#              g   #',
        '#     ====        D#',
        '#                ===#',
        '# h               g#',
        '####################',
    ],
};

export const LEVEL_2: LevelDefinition = {
    name: 'Trap Corridor',
    width: 25,
    height: 12,
    timeBonus: 45,
    tiles: [
        '#########################',
        '#  T                   T#',
        '#                       #',
        '#P                      #',
        '#===  ===  ===  ===   ==#',
        '#  ^ X  ^    ^  X      h#',
        '#                       #',
        '#     ~~~      ~~~     t#',
        '#===       ==      ===D#=',
        '#                      =#',
        '#  g     g      g     g#',
        '#########################',
    ],
};

export const LEVEL_3: LevelDefinition = {
    name: 'Guard Post',
    width: 22,
    height: 12,
    timeBonus: 50,
    tiles: [
        '######################',
        '#T                  T#',
        '#                    #',
        '#P        E          #',
        '#=====  ======  =====#',
        '#                    #',
        '#      h       H     #',
        '#   ======  ======   #',
        '#              E    D#',
        '#==================  #',
        '# g  t   g   t   g  g#',
        '######################',
    ],
};

export const LEVEL_4: LevelDefinition = {
    name: 'The Labyrinth',
    width: 28,
    height: 14,
    timeBonus: 60,
    tiles: [
        '############################',
        '#T       G        T        #',
        '#        #                 #',
        '#P       #    E            #',
        '#====  *=#=====   ====    =#',
        '#  ^     #     X          t#',
        '#       ##         ~~~    =#',
        '#  ===  #     ====        h#',
        '#       # E        ===    =#',
        '#      G#===            ^ D#',
        '#======*#              ====#',
        '#  ^  ^                   H#',
        '#t   g    g   t   g   t  g#',
        '############################',
    ],
};

export const LEVEL_5: LevelDefinition = {
    name: 'Owl Chamber',
    width: 30,
    height: 14,
    timeBonus: 90,
    tiles: [
        '##############################',
        '#T           O             T#',
        '#         =====              #',
        '#                            #',
        '#    ===        ===    E     #',
        '#                        ====#',
        '#P   ^ X ^   ^ X ^        h  #',
        '#====    ===      ===  ===  =#',
        '#                 E          #',
        '#    ~~~      ~~~        ~~~t#',
        '#===     = ==     ==         #',
        '#   E            H        E  #',
        '#  g  t  g  t  g  t  g  t  g #',
        '##############################',
    ],
};

export const ALL_LEVELS: LevelDefinition[] = [
    LEVEL_1,
    LEVEL_2,
    LEVEL_3,
    LEVEL_4,
    LEVEL_5,
];

export function getTileAt(level: LevelDefinition, tileX: number, tileY: number): TileType {
    if (tileX < 0 || tileX >= level.width || tileY < 0 || tileY >= level.height) {
        return 'wall';
    }
    const row = level.tiles[tileY] || '';
    const char = row[tileX] || ' ';
    return parseTile(char);
}

export function isTileSolid(level: LevelDefinition, tileX: number, tileY: number): boolean {
    const tile = getTileAt(level, tileX, tileY);
    return tile === 'floor' || tile === 'wall' || tile === 'platform' || tile === 'gate';
}

export function findPlayerSpawn(level: LevelDefinition): { x: number; y: number } {
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            if (getTileAt(level, x, y) === 'player') {
                return { x: x * TILE_SIZE + 12, y: y * TILE_SIZE };
            }
        }
    }
    return { x: TILE_SIZE * 2, y: TILE_SIZE * 4 };
}

export function findDoorPosition(level: LevelDefinition): { x: number; y: number } | null {
    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            if (getTileAt(level, x, y) === 'door') {
                return { x: x * TILE_SIZE, y: y * TILE_SIZE };
            }
        }
    }
    return null;
}
