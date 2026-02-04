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
    'R': 'gate',
    'B': 'gate',
    'Y': 'gate',
    '*': 'switch',
    'r': 'switch',
    'b': 'switch',
    'y': 'switch',
    'D': 'door',
    'T': 'torch',
    'h': 'potion_hp',
    'H': 'potion_max',
    'g': 'gem',
    't': 'time',
    'E': 'guard',
    'P': 'player',
    'O': 'owl',
    // Story/environmental tiles
    'S': 'skeleton',
    'I': 'inscription',
    'C': 'spectral_crystal',
    'F': 'fallen_seeker',
    'J': 'journal',
};

export function parseTile(char: string): TileType {
    return CHAR_MAP[char] || 'empty';
}

// ===== LEVEL DEFINITIONS =====

export const LEVEL_1: LevelDefinition = {
    name: 'The Forgotten Threshold',
    width: 50,
    height: 15,
    timeBonus: 120,
    tiles: [
        '##################################################',
        '# T       T                           T       T  #',
        '#                                                #',
        '#  P                                             #',
        '#                                                #',
        '#     I                                      I   #',
        '#                                                #',
        '#       g      g       g     g       g      g    #',
        '#             ------                ------       #',
        '#                     T --J---                   #',
        '# |   ------             S                       #',
        '# |    ===      g                                #',
        '# | =h=         S   t  *    G      E     g    D  #',
        '#=================^^=============^^=====~========#',
        '##################################################',
    ],
};

export const LEVEL_2: LevelDefinition = {
    name: 'Hall of Whispers',
    width: 55,
    height: 16,
    timeBonus: 100,
    tiles: [
        '#######################################################',
        '#T                         T                        T #',
        '#                                                     #',
        '#P                                                    #',
        '#=====                                                #',
        '#       g      g                       g       g      #',
        '#        -======  -^^^^   =======   ^^^^^   =====     #',
        '#                        -         -       -          #',
        '#   g                    C      g                  g  #',
        '#      ======  X   ======  X   ======   ====      -   #',
        '#                                               E     #',
        '#   t-      ~~~   g   ~~~       g     ===     D       #',
        '#      =======   ======   =======   ===   ===     -   #',
        '#  E           -         -       -       E   -   - g  #',
        '# h  g     g           g           g           g     h#',
        '#######################################################',
    ],
};

export const LEVEL_3: LevelDefinition = {
    name: 'Gauntlet of the Fallen',
    width: 60,
    height: 18,
    timeBonus: 90,
    tiles: [
        '############################################################',
        '#T                              T                        T #',
        '#                                                          #',
        '#P                                                         #',
        '#=====                                                     #',
        '#       g       g                         g       g        #',
        '#         =====   ======   =====   ======   ====           #',
        '#  E                                                   E   #',
        '#                   g           g           g              #',
        '#      ======   ======   ======   ======   ====            #',
        '#                                                          #',
        '#   g      E            g  H  g            E       g       #',
        '#      =======   =========   =======   ======              #',
        '#                                                          #',
        '#  t          g           g           g           E   ====D#',
        '#      ========   =========   ===========   ===      ===   #',
        '# h  g     g     g     g     g     g     g     g     g   h #',
        '############################################################',
    ],
};

export const LEVEL_4: LevelDefinition = {
    name: 'Labyrinth of Choices',
    width: 70,
    height: 20,
    timeBonus: 120,
    tiles: [
        '######################################################################',
        '#T                              G                                  T #',
        '#                               #                                    #',
        '#P                              #                                    #',
        '#=====                          #                                    #',
        '#       g       g       G      *#*     G       g       g       g     #',
        '#         =====     ====#========#=====#===     =====     =====      #',
        '#                       #        #     #                             #',
        '#   g      E            #   E    #     #            E       g        #',
        '#      ======     ======#========#=====#======     ======     ====   #',
        '#                       #        #     #                             #',
        '#   g           g       #   g    #  g  #       g           g      g  #',
        '#      ======     ===  G#====    #   ==#G  ===     ======     ====   #',
        '#              ~~~      #    ~~~    ~~~#       ~~~                   #',
        '#  t       g       E   *#*           *#*    E       g       t      I #',
        '#      =======     =====#=============#=====     =======     ===    D#',
        '#                       #             #                          ====#',
        '#  E        H           #      E      #           H       F    E    h#',
        '# h  g  t  g  t  g  t  g#  g  t  g  t #g  t  g  t  g  t  g  t  g  t g#',
        '######################################################################',
    ],
};

export const LEVEL_5: LevelDefinition = {
    name: 'Heart of Crystal',
    width: 80,
    height: 22,
    timeBonus: 150,
    tiles: [
        '################################################################################',
        '#T                                                                           T #',
        '#                                                                              #',
        '#                                          O                                   #',
        '#                                    =============                             #',
        '#                                                                              #',
        '#P                                  T           T =                            #',
        '#=====                             =               =    = =                    #',
        '#       g       g       g       g       g       g       g=      g       g      #',
        '#       = =====     =====     =====     =====     =====   = =====     ====     #',
        '#  E              X=      ^^^^        X      =^^^^       =X               E    #',
        '#   g       g       g       g       g       g       g       g       g       g  #',
        '#   =  ====== =   ======     ======     ====== =   ======     ======     ===   #',
        '#==   =         =           =      =  ==        = =      = =           =       #',
        '#   t       E    =      E  =        E           E           E =     t          #',
        '#  ==  =======     =======     =======     =======     =======     ====        #',
        '#             ~~~        ~~~=       ~~~        ~~~   ==   ~~~           =      #',
        '#  g       g       g       g       g       g       g       g       g       g  D#',
        '#   =  ========   ========   ========   ========   ========   ========   ======#',
        '#                =          =        =                                  =      #',
        '# h  H  g  t  g  t  g  t  g  t  g  H  g  t  g  t  g  t  g  t  g  t  g  H  h    #',
        '################################################################################',
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
