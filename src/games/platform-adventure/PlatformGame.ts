// ===== src/games/platform-adventure/PlatformGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import { TILE_SIZE, TileType, TILE_COLORS } from './data/TileTypes';
import { Player, PlayerInventory } from './entities/Player';
import { Guard, GuardSense, GuardType } from './entities/Guard';
import { Collectible } from './entities/Collectible';
import { Trap, TrapType } from './entities/Trap';
import { ALL_LEVELS, LevelDefinition, getTileAt, findPlayerSpawn, findDoorPosition } from './levels/LevelData';
import { STORY_BY_LEVEL, GLOBAL_STORY_EVENTS, StoryEvent } from './levels/StoryData';
import { ParallaxBackground } from './rendering/ParallaxBackground';
import { Camera, SHAKE_PRESETS, ShakePreset } from './rendering/Camera';
import { DynamicLighting } from './rendering/DynamicLighting';

type GameState = 'menu' | 'level_select' | 'playing' | 'level_intro' | 'story' | 'level_complete' | 'victory' | 'game_over' | 'paused';

// Enhanced scoring system
const SCORING = {
    GEM_VALUE: 100,           // up from 50
    TIME_VALUE: 10,           // per second remaining
    SPEED_THRESHOLD: 60,      // seconds for speed bonus
    SPEED_MULTIPLIER: 2,
    NO_HIT_BONUS: 500,
    GUARD_KILL: 200,          // up from 100
    PERFECT_BLOCK: 50,
    COUNTER_ATTACK: 100,
};

// Leaderboard interface
interface LeaderboardEntry {
    name: string;
    score: number;
    timeRemaining: number;
    deaths: number;
    date: number;
}

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    gravity: number;
};

type DeathCause = 'guard' | 'trap' | 'pit' | 'time';

type DeathInterstitialParticle = {
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; size: number; color: string;
};

type DeathInterstitial = {
    active: boolean;
    timer: number;
    duration: number;
    cause: DeathCause;
    guardType?: GuardType;
    trapType?: TrapType;
    particles: DeathInterstitialParticle[];
    flavorIndex: number;
};

const DEATH_FLAVOR_TEXT: Record<DeathCause, string[]> = {
    guard: [
        'The guards show no mercy...',
        'Steel bites deep in the dark.',
        'Outmatched, but not defeated.',
        'The cavern claims another soul.',
        'A warrior falls, but rises again.',
        'Their blade was faster this time.',
    ],
    trap: [
        'The cavern\'s teeth are sharp.',
        'Ancient mechanisms still hunger.',
        'These ruins were built to kill.',
        'The dungeon punishes the unwary.',
        'Every stone hides danger.',
        'The architects were cruel.',
    ],
    pit: [
        'The abyss yawns endlessly below.',
        'Darkness swallowed everything.',
        'The fall seemed to last forever.',
        'Nothing but void beneath your feet.',
        'The depths claimed another explorer.',
        'Watch your step next time.',
    ],
    time: [
        'The sands of time have run dry.',
        'Time waits for no adventurer.',
        'The cavern\'s magic fades...',
        'Too slow to outrun fate.',
        'The torch sputters and dies.',
        'Darkness reclaims the caverns.',
    ],
};

type ScoreBreakdownState = {
    phase: 'counting' | 'waiting';
    lineIndex: number;
    lineProgress: number;
    lines: Array<{ label: string; value: number; displayValue: number }>;
    levelTotal: number;
    runningTotal: number;
};

type ScorePopup = {
    x: number;
    y: number;
    text: string;
    color: string;
    timer: number;
};

type GateColor = 'gray' | 'red' | 'blue' | 'gold';

const DEFAULT_GATE_COLOR: GateColor = 'gray';

const GATE_COLOR_BY_CHAR: Record<string, GateColor> = {
    G: 'gray',
    R: 'red',
    B: 'blue',
    Y: 'gold',
};

const SWITCH_COLOR_BY_CHAR: Record<string, GateColor> = {
    '*': 'gray',
    r: 'red',
    b: 'blue',
    y: 'gold',
};

const GATE_STYLE: Record<GateColor, {
    frame: string;
    bars: string;
    barsDark: string;
    switchBase: string;
    switchAccent: string;
    switchPressedBase: string;
    switchPressedAccent: string;
}> = {
    gray: {
        frame: '#444433',
        bars: '#555544',
        barsDark: '#333322',
        switchBase: '#666655',
        switchAccent: '#888877',
        switchPressedBase: '#445533',
        switchPressedAccent: '#88bb55',
    },
    red: {
        frame: '#5a2a2a',
        bars: '#7a2d2d',
        barsDark: '#3a1a1a',
        switchBase: '#7a3a3a',
        switchAccent: '#d65c5c',
        switchPressedBase: '#5a2f2f',
        switchPressedAccent: '#f08a8a',
    },
    blue: {
        frame: '#2a355a',
        bars: '#3b4f7a',
        barsDark: '#1a2233',
        switchBase: '#3a4f7a',
        switchAccent: '#7aa2ff',
        switchPressedBase: '#243255',
        switchPressedAccent: '#9bbcff',
    },
    gold: {
        frame: '#5b4a2a',
        bars: '#7a6232',
        barsDark: '#3a2a1a',
        switchBase: '#7a653a',
        switchAccent: '#f4c542',
        switchPressedBase: '#5a4a2a',
        switchPressedAccent: '#ffd77a',
    },
};

type Gate = {
    tileX: number;
    tileY: number;
    x: number;
    y: number;
    color: GateColor;
    open: boolean;
    openProgress: number;
    linkedSwitches: number[];
};

type SwitchTile = {
    tileX: number;
    tileY: number;
    x: number;
    y: number;
    color: GateColor;
    pressed: boolean;
    linkedGates: number[];
};

export class PlatformGame extends BaseGame {
    manifest: GameManifest = {
        id: 'platform-adventure',
        title: 'Crystal Caverns',
        thumbnail: '/games/platform-adventure/platform-adventure-thumb.svg',
        inputSchema: ['keyboard', 'touch'],
        assetBudgetKB: 130,
        tier: 2,
    };

    // Game state
    private gameState: GameState = 'menu';
    private stateTimer: number = 0;
    private currentLevel: number = 0;
    private level: LevelDefinition | null = null;

    // Timer
    private timeRemaining: number = 180; // 3 minutes start
    private readonly MAX_TIME = 300;

    // Entities
    private player!: Player;
    private guards: Guard[] = [];
    private collectibles: Collectible[] = [];
    private traps: Trap[] = [];
    private gates: Gate[] = [];
    private switches: SwitchTile[] = [];
    private gateIndexByTile: Map<string, number> = new Map();
    private switchIndexByTile: Map<string, number> = new Map();
    private torches: Array<{ x: number; y: number; flicker: number }> = [];

    // Camera
    private camera: Camera = new Camera(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    // Parallax background system
    private parallaxBackground: ParallaxBackground = new ParallaxBackground();

    // Dynamic lighting system
    private lighting: DynamicLighting = new DynamicLighting();

    // Combat feel
    private hitStopTimer: number = 0;
    private particles: Particle[] = [];
    private footstepTimer: number = 0;

    // Particle enhancement timers (P3-1.3)
    private ambientDustTimer: number = 0;
    private footstepDustTimer: number = 0;
    private crystalPositions: Array<{ x: number; y: number }> = [];
    private previousPlayerVy: number = 0;

    // Screen flash effect
    private screenFlash: { color: string; alpha: number; timer: number; duration: number } | null = null;

    // Boss battle
    private activeBoss: Guard | null = null;
    private bossHealthBarTimer: number = 0;
    private bannerText: string = '';
    private bannerTimer: number = 0;
    private bannerDuration: number = 0;
    private timeScale: number = 1.0;
    private slowmoTimer: number = 0;
    private phaseFlashTimer: number = 0;

    // Music state
    private musicState: 'none' | 'exploration' | 'boss' | 'victory' = 'none';

    // Boss-locked door (Level 3)
    private doorLocked: boolean = false;

    // Stats
    private gemsCollected: number = 0;
    private guardsDefeated: number = 0;
    private deaths: number = 0;
    private pendingDeathRecord: { cause: DeathCause; guardType?: GuardType; trapType?: TrapType; level: number } | null = null;
    private lastDeathCause: DeathCause = 'time';
    private deathsByGuard: number = 0;
    private deathsByTrap: number = 0;
    private deathsByPit: number = 0;
    private timePenaltyTotal: number = 0;
    private deathInterstitial: DeathInterstitial | null = null;
    private foundOwl: boolean = false;
    private levelStory: StoryEvent[] = [];
    private storyQueue: StoryEvent[] = [];
    private activeStory: StoryEvent | null = null;
    private storySeen: Set<string> = new Set();

    // Level stats for scoring
    private levelDamagesTaken: number = 0;
    private levelPerfectBlocks: number = 0;
    private levelCounterAttacks: number = 0;
    private swordEverDrawn: boolean = false;
    private levelStartTime: number = 0;
    private totalGemsInLevel: number = 0;
    private levelGemsCollected: number = 0;
    private gameStartTime: number = 0;

    // Achievement tracking (uses platform AchievementService)
    private totalBlocksEver: number = 0;
    private totalGemsEver: number = 0;
    private achievementToast: { name: string; timer: number } | null = null;
    private readonly STATS_KEY = 'crystal-caverns-stats';

    // Leaderboard system
    private leaderboard: LeaderboardEntry[] = [];
    private readonly LEADERBOARD_KEY = 'crystal-caverns-leaderboard';
    private enteringName: boolean = false;
    private playerName: string = '';
    private nameInputChars: string[] = ['A', 'A', 'A'];
    private nameInputIndex: number = 0;
    private hasEnteredName: boolean = false;
    private nameInputUpWasPressed: boolean = false;
    private nameInputDownWasPressed: boolean = false;
    private nameInputLeftWasPressed: boolean = false;
    private nameInputRightWasPressed: boolean = false;
    private nameInputActionWasPressed: boolean = false;

    // Input state for edge detection
    private swordKeyWasPressed: boolean = false;
    private jumpKeyWasPressed: boolean = false;

    // Pending item raise animation (plays after story dialogue)
    private pendingItemRaise: boolean = false;

    // HUD animations (P3-6)
    private scorePopups: ScorePopup[] = [];
    private healthPulseTimer: number = 0;
    private lastPlayerHealth: number = 3;
    private gemBounceTimer: number = 0;

    // Story typewriter (P3-6)
    private storyCharIndex: number = 0;
    private storyFullyRevealed: boolean = false;

    // Score breakdown (P3-4)
    private scoreBreakdown: ScoreBreakdownState | null = null;
    private levelGuardsDefeated: number = 0;

    // Pause menu (P3-6)
    private pauseMenuIndex: number = 0;
    private escKeyWasPressed: boolean = false;
    private pauseUpWasPressed: boolean = false;
    private pauseDownWasPressed: boolean = false;

    // Level select (P3-6)
    private menuIndex: number = 0;
    private menuUpWasPressed: boolean = false;
    private menuDownWasPressed: boolean = false;
    private levelSelectIndex: number = 0;
    private levelSelectUpWasPressed: boolean = false;
    private levelSelectDownWasPressed: boolean = false;
    private menuActionWasPressed: boolean = false;
    private unlockedLevels: number = 1;
    private levelBestScores: number[] = [0, 0, 0, 0, 0];
    private levelBestTimes: number[] = [0, 0, 0, 0, 0];
    private readonly PROGRESS_KEY = 'crystal-caverns-progress';

    // Item progression inventory
    private playerInventory: PlayerInventory = { hasBlade: false, hasArmor: false, hasBoots: false, hasHeart: false };
    private readonly INVENTORY_KEY = 'crystal-caverns-inventory';

    // Dash input edge detection
    private dashKeyWasPressed: boolean = false;

    protected renderBaseHud: boolean = false;

    protected onInit(): void {
        this.player = new Player(100, 200);
        this.loadPersistentStats();
        this.loadLeaderboard();
        this.loadProgress();
        this.loadInventory();
        this.gameStartTime = Date.now();
        this.loadLevel(0);
    }

    protected endGame(): void {
        // Stop music before ending game
        this.services?.audio?.stopMusic?.(1.0);
        this.musicState = 'none';
        super.endGame();
    }

    private loadLevel(levelIndex: number): void {
        this.currentLevel = levelIndex;
        this.level = ALL_LEVELS[levelIndex] || ALL_LEVELS[0];

        // Set parallax background theme for this level
        this.parallaxBackground.setLevel(levelIndex);

        // Set lighting level and clear old lights
        this.lighting.setLevel(levelIndex);

        // Add time bonus
        this.timeRemaining = Math.min(this.MAX_TIME, this.timeRemaining + this.level.timeBonus);

        // Clear entities
        this.guards = [];
        this.collectibles = [];
        this.traps = [];
        this.gates = [];
        this.switches = [];
        this.gateIndexByTile = new Map();
        this.switchIndexByTile = new Map();
        this.torches = [];
        this.crystalPositions = [];
        const guardSpawns: Array<{ x: number; y: number }> = [];
        let owlPosition: { x: number; y: number } | null = null;
        let gemCount = 0;
        this.particles = [];
        this.hitStopTimer = 0;
        this.ambientDustTimer = 0;
        this.footstepDustTimer = 0;
        this.previousPlayerVy = 0;
        this.camera.reset();
        this.screenFlash = null;
        this.footstepTimer = 0;
        this.activeBoss = null;
        this.bossHealthBarTimer = 0;
        this.bannerText = '';
        this.bannerTimer = 0;
        this.bannerDuration = 0;
        this.timeScale = 1.0;
        this.slowmoTimer = 0;
        this.phaseFlashTimer = 0;
        this.levelStory = STORY_BY_LEVEL[this.currentLevel] ?? [];
        this.storyQueue = this.levelStory.filter((event) => event.trigger.type === 'level_start');
        this.activeStory = null;
        this.storySeen = new Set();

        // Reset level stats
        this.levelDamagesTaken = 0;
        this.levelPerfectBlocks = 0;
        this.levelCounterAttacks = 0;
        this.levelGuardsDefeated = 0;
        this.swordEverDrawn = false;
        this.pendingItemRaise = false;
        this.levelStartTime = Date.now();
        this.levelGemsCollected = 0;
        this.totalGemsInLevel = gemCount;

        // Parse level tiles for entities
        for (let y = 0; y < this.level.height; y++) {
            for (let x = 0; x < this.level.width; x++) {
                const rawChar = this.level.tiles[y]?.[x] ?? ' ';
                const tile = getTileAt(this.level, x, y);
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                switch (tile) {
                    case 'guard':
                        guardSpawns.push({ x: px + 12, y: py });
                        break;
                    case 'potion_hp':
                        this.collectibles.push(new Collectible(px + 16, py + 16, 'potion_hp'));
                        break;
                    case 'potion_max':
                        this.collectibles.push(new Collectible(px + 16, py + 16, 'potion_max'));
                        break;
                    case 'gem':
                        this.collectibles.push(new Collectible(px + 16, py + 16, 'gem'));
                        gemCount++;
                        break;
                    case 'time':
                        this.collectibles.push(new Collectible(px + 16, py + 16, 'time'));
                        break;
                    case 'owl':
                        this.collectibles.push(new Collectible(px + 16, py + 8, 'owl'));
                        owlPosition = { x: px, y: py };
                        this.lighting.addOwlLight(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
                        break;
                    case 'torch':
                        this.torches.push({ x: px + TILE_SIZE / 2, y: py + 12, flicker: Math.random() * Math.PI * 2 });
                        this.lighting.addTorch(px + TILE_SIZE / 2, py + 12);
                        break;
                    case 'spectral_crystal':
                        this.lighting.addSpectralCrystal(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
                        this.crystalPositions.push({ x: px, y: py });
                        break;
                    case 'spikes':
                        this.traps.push(new Trap(px, py, 'spikes'));
                        break;
                    case 'chomper':
                        this.traps.push(new Trap(px, py, 'chomper'));
                        break;
                    case 'loose':
                        this.traps.push(new Trap(px, py - TILE_SIZE + 8, 'loose_floor'));
                        break;
                    case 'gate':
                        this.gateIndexByTile.set(`${x},${y}`, this.gates.length);
                        this.gates.push({
                            tileX: x,
                            tileY: y,
                            x: px,
                            y: py,
                            color: GATE_COLOR_BY_CHAR[rawChar] ?? DEFAULT_GATE_COLOR,
                            open: false,
                            openProgress: 0,
                            linkedSwitches: [],
                        });
                        break;
                    case 'switch':
                        this.switchIndexByTile.set(`${x},${y}`, this.switches.length);
                        this.switches.push({
                            tileX: x,
                            tileY: y,
                            x: px,
                            y: py,
                            color: SWITCH_COLOR_BY_CHAR[rawChar] ?? DEFAULT_GATE_COLOR,
                            pressed: false,
                            linkedGates: [],
                        });
                        break;
                    case 'item_sword':
                        if (!this.playerInventory.hasBlade) {
                            this.collectibles.push(new Collectible(px + 16, py + 12, 'item_sword'));
                        }
                        break;
                    case 'item_armor':
                        if (!this.playerInventory.hasArmor) {
                            this.collectibles.push(new Collectible(px + 16, py + 12, 'item_armor'));
                        }
                        break;
                    case 'item_boots':
                        if (!this.playerInventory.hasBoots) {
                            this.collectibles.push(new Collectible(px + 16, py + 12, 'item_boots'));
                        }
                        break;
                    case 'item_heart':
                        if (!this.playerInventory.hasHeart) {
                            this.collectibles.push(new Collectible(px + 16, py + 12, 'item_heart'));
                        }
                        break;
                }
            }
        }

        this.linkSwitchesToGates();

        // Place moonlight shafts at key areas and regular intervals
        this.placeMoonlights();

        // Spawn guards with difficulty scaling + Level 3 captain
        const baseGuardType = this.getGuardTypeForLevel(this.currentLevel);
        const door = findDoorPosition(this.level);
        let captainIndex = -1;
        if (this.currentLevel === 2 && door && guardSpawns.length > 0) {
            let bestDist = Infinity;
            guardSpawns.forEach((spawn, index) => {
                const dx = spawn.x - door.x;
                const dy = spawn.y - door.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    captainIndex = index;
                }
            });
        }
        let shadowIndex = -1;
        if (this.currentLevel === 4 && owlPosition && guardSpawns.length > 0) {
            let bestDist = Infinity;
            guardSpawns.forEach((spawn, index) => {
                const dx = spawn.x - owlPosition.x;
                const dy = spawn.y - owlPosition.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    shadowIndex = index;
                }
            });
        }
        guardSpawns.forEach((spawn, index) => {
            const type = index === captainIndex ? 'captain' : index === shadowIndex ? 'shadow' : baseGuardType;
            const groundY = this.getGuardGroundY(spawn.x, spawn.y);
            const guard = new Guard(spawn.x, groundY, 3, type);

            // Register boss callbacks
            if (type === 'captain' || type === 'shadow') {
                guard.onDeath = (g) => this.onBossDefeat(g);
                if (type === 'shadow') {
                    guard.onPhaseChange = (phase, g) => this.onShadowPhaseChange(phase, g);
                }
            }

            this.guards.push(guard);
        });

        // Lock door on Level 3 until Captain is defeated
        this.doorLocked = this.currentLevel === 2 && captainIndex !== -1;

        // Spawn player
        const spawn = findPlayerSpawn(this.level);
        this.player.x = spawn.x;
        this.player.y = spawn.y;
        this.player.setCheckpoint(spawn.x, spawn.y);
        this.player.respawn();

        // Apply persistent inventory to player
        this.applyInventoryToPlayer();

        // Snap camera to player position
        this.snapCameraToPlayer();
    }

    private getGuardTypeForLevel(levelIndex: number): GuardType {
        if (levelIndex <= 0) return 'recruit';
        if (levelIndex === 1) return 'soldier';
        if (levelIndex === 2) return 'veteran';
        if (levelIndex === 3) return 'veteran';
        return 'veteran';
    }

    private getGuardGroundY(spawnX: number, spawnY: number): number {
        if (!this.level) return spawnY;
        const tileX = Math.floor(spawnX / TILE_SIZE);
        const startY = Math.max(0, Math.floor(spawnY / TILE_SIZE));
        for (let ty = startY; ty < this.level.height; ty++) {
            if (this.isTileSolidAt(tileX, ty)) {
                return Math.max(0, ty * TILE_SIZE - TILE_SIZE);
            }
        }
        return spawnY;
    }

    protected onUpdate(dt: number): void {
        // ESC pause toggle (only from 'playing' or 'paused')
        const escPressed = this.services?.input?.isKeyPressed?.('Escape') || false;
        if (escPressed && !this.escKeyWasPressed) {
            if (this.gameState === 'playing') {
                this.gameState = 'paused';
                this.pauseMenuIndex = 0;
            } else if (this.gameState === 'paused') {
                this.gameState = 'playing';
            }
        }
        this.escKeyWasPressed = escPressed;

        switch (this.gameState) {
            case 'menu':
                this.updateMenu(dt);
                break;
            case 'level_select':
                this.updateLevelSelect(dt);
                break;
            case 'level_intro':
                this.updateLevelIntro(dt);
                break;
            case 'story':
                this.updateStory(dt);
                break;
            case 'playing':
                this.updatePlaying(dt);
                break;
            case 'level_complete':
                this.updateLevelComplete(dt);
                break;
            case 'paused':
                this.updatePauseMenu(dt);
                break;
            case 'victory':
            case 'game_over':
                this.updateEndScreen(dt);
                break;
        }
    }

    private updateMenu(dt: number): void {
        const input = this.services?.input;
        const up = input?.isUpPressed?.() || false;
        const down = input?.isDownPressed?.() || false;
        const action = input?.isActionPressed?.() || false;

        if (up && !this.menuUpWasPressed) this.menuIndex = Math.max(0, this.menuIndex - 1);
        if (down && !this.menuDownWasPressed) this.menuIndex = Math.min(1, this.menuIndex + 1);
        this.menuUpWasPressed = up;
        this.menuDownWasPressed = down;

        if (action && !this.menuActionWasPressed) {
            if (this.menuIndex === 0) {
                // New Game — reset inventory
                this.resetInventory();
                this.gameState = 'level_intro';
                this.stateTimer = 0;
                this.services?.audio?.playSound?.('powerup');
            } else {
                // Level Select
                this.gameState = 'level_select';
                this.levelSelectIndex = 0;
                this.services?.audio?.playSound?.('coin');
            }
        }
        this.menuActionWasPressed = action;
    }

    private updateLevelSelect(dt: number): void {
        const input = this.services?.input;
        const up = input?.isUpPressed?.() || false;
        const down = input?.isDownPressed?.() || false;
        const action = input?.isActionPressed?.() || false;
        const esc = input?.isKeyPressed?.('Escape') || false;

        if (up && !this.levelSelectUpWasPressed) {
            this.levelSelectIndex = Math.max(0, this.levelSelectIndex - 1);
        }
        if (down && !this.levelSelectDownWasPressed) {
            this.levelSelectIndex = Math.min(ALL_LEVELS.length - 1, this.levelSelectIndex + 1);
        }
        this.levelSelectUpWasPressed = up;
        this.levelSelectDownWasPressed = down;

        // ESC to go back to menu
        if (esc && !this.escKeyWasPressed) {
            this.gameState = 'menu';
            this.menuIndex = 1;
        }

        if (action && !this.menuActionWasPressed) {
            if (this.levelSelectIndex < this.unlockedLevels) {
                // Play selected level
                this.loadLevel(this.levelSelectIndex);
                this.gameState = 'level_intro';
                this.stateTimer = 0;
                this.services?.audio?.playSound?.('powerup');
            } else {
                // Locked - play error sound
                this.services?.audio?.playSound?.('error');
            }
        }
        this.menuActionWasPressed = action;
    }

    private updatePauseMenu(dt: number): void {
        const input = this.services?.input;
        const up = input?.isUpPressed?.() || false;
        const down = input?.isDownPressed?.() || false;
        const action = input?.isActionPressed?.() || false;

        if (up && !this.pauseUpWasPressed) {
            this.pauseMenuIndex = Math.max(0, this.pauseMenuIndex - 1);
        }
        if (down && !this.pauseDownWasPressed) {
            this.pauseMenuIndex = Math.min(2, this.pauseMenuIndex + 1);
        }
        this.pauseUpWasPressed = up;
        this.pauseDownWasPressed = down;

        if (action && !this.menuActionWasPressed) {
            switch (this.pauseMenuIndex) {
                case 0: // Resume
                    this.gameState = 'playing';
                    break;
                case 1: // Restart Level
                    this.loadLevel(this.currentLevel);
                    this.gameState = 'level_intro';
                    this.stateTimer = 0;
                    break;
                case 2: // Quit to Menu
                    this.endGame();
                    break;
            }
        }
        this.menuActionWasPressed = action;
    }

    private updateLevelIntro(dt: number): void {
        this.stateTimer += dt;
        if (this.stateTimer > 2) {
            if (this.storyQueue.length > 0) {
                this.beginStory(this.storyQueue.shift()!);
            } else {
                this.gameState = 'playing';
                // Start exploration music when gameplay begins
                if (this.musicState === 'none') {
                    this.services?.audio?.playMusic?.('epic_tension', 2.0);
                    this.musicState = 'exploration';
                }
            }
        }
    }

    private updatePlaying(dt: number): void {
        if (!this.level) return;

        // Clamp dt to prevent physics explosion
        const safeDt = Math.min(dt, 0.05);

        // Update parallax background animations
        this.parallaxBackground.update(safeDt);

        // Update dynamic lighting (torch flicker, etc.)
        this.lighting.update(safeDt);

        // Update screen flash
        this.updateScreenFlash(safeDt);

        // Update hit stop (camera updates happen later in updateCamera)
        if (this.hitStopTimer > 0) {
            this.hitStopTimer = Math.max(0, this.hitStopTimer - safeDt);
            return;
        }

        // Death interstitial - freeze game, only update interstitial + camera
        if (this.deathInterstitial?.active) {
            this.updateDeathInterstitial(safeDt);
            this.updateCamera(safeDt);
            return;
        }

        // Update timer
        this.timeRemaining -= safeDt;
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.lastDeathCause = 'time';
            this.endGame();
            return;
        }

        const input = this.services?.input;
        const left = input?.isLeftPressed?.() || false;
        const right = input?.isRightPressed?.() || false;
        const up = input?.isUpPressed?.() || false;
        const action = input?.isActionPressed?.() || false;
        const shiftKey = input?.isKeyPressed?.('ShiftLeft') || input?.isKeyPressed?.('ShiftRight') || false;
        const ctrlKey = input?.isKeyPressed?.('ControlLeft') || input?.isKeyPressed?.('ControlRight') || false;

        // Handle combat mode toggle (edge triggered) — Shift always works
        if (shiftKey && !this.swordKeyWasPressed) {
            this.player.toggleCombatMode();
            if (this.player.hasSword) {
                this.swordEverDrawn = true;
                this.services?.audio?.playSound?.('sword_draw');
            } else if (this.player.inCombatMode) {
                // Entering fist stance (no blade)
                this.services?.audio?.playSound?.('jump'); // Stance shuffle sound
            } else {
                this.services?.audio?.playSound?.('sword_sheathe');
            }
        }
        this.swordKeyWasPressed = shiftKey;

        // Handle combat (punch when no sword, sword attack when drawn)
        if (action) {
            if (this.player.tryAttack()) {
                this.services?.audio?.playSound?.(this.player.hasSword ? 'sword_swing' : 'hit');
            }
        } else if (ctrlKey && this.player.inCombatMode) {
            this.player.tryBlock();
        }

        // Handle dash (Ctrl when NOT in combat mode, requires boots)
        if (ctrlKey && !this.player.inCombatMode && !this.dashKeyWasPressed) {
            if (this.player.tryDash()) {
                this.services?.audio?.playSound?.('jump'); // Reuse jump sound for dash
            }
        }
        this.dashKeyWasPressed = ctrlKey;

        // Handle movement - direct calls like TapDodge!
        if (left) {
            this.player.moveLeft();
        } else if (right) {
            this.player.moveRight();
        } else {
            this.player.stopMoving();
        }

        const wasGrounded = this.player.isGrounded;
        this.previousPlayerVy = this.player.vy;

        // Handle jump with buffering and variable height
        if (up && !this.jumpKeyWasPressed) {
            // Jump key just pressed - buffer the jump
            this.player.bufferJump();
            if (this.player.state === 'jump') {
                this.services?.audio?.playSound?.('jump');
            }
        } else if (!up && this.jumpKeyWasPressed) {
            // Jump key just released - cut jump for variable height
            this.player.onJumpRelease();
        }
        this.jumpKeyWasPressed = up;

        // Update player physics
        this.player.update(safeDt * this.timeScale);

        // Update player torch light (always on, dims over time, relights near torches)
        this.lighting.updatePlayerLight(
            this.player.centerX,
            this.player.centerY
        );

        // Collision detection
        this.handlePlayerCollision();

        if (!wasGrounded && this.player.isGrounded) {
            this.services?.audio?.playSound?.('land');
            // Landing impact particles for high falls
            if (this.previousPlayerVy > 280) {
                this.spawnLandingImpact(this.player.centerX, this.player.y + this.player.height);
                if (this.previousPlayerVy > 400) {
                    this.triggerScreenShakePreset('LANDING_IMPACT');
                }
            }
        }

        // Check for buffered jump AFTER collision resolution
        // (prevents wall-sticking and block-phasing)
        if (this.player.tryBufferedJump()) {
            this.services?.audio?.playSound?.('jump');
        }

        this.updateFootsteps(safeDt);

        // Update guards
        const playerAttacking = this.player.state === 'attack' && this.player.attackHitbox !== null;
        const playerBlocking = this.player.isBlocking;
        const playerNoise = this.player.state === 'run' || this.player.state === 'jump' || this.player.state === 'fall' || playerAttacking;
        const guardSense: GuardSense = {
            playerX: this.player.x,
            playerY: this.player.y,
            playerAttacking,
            playerBlocking,
            playerNoise,
            playerHasSword: this.player.hasSword,
        };
        for (const guard of this.guards) {
            guard.update(safeDt * this.timeScale, guardSense);
        }

        // Boss detection and update
        this.updateBossState();
        this.updateSlowmo(safeDt);
        this.updateBanner(safeDt);

        // Update traps
        for (const trap of this.traps) {
            trap.update(safeDt * this.timeScale, this.player.centerX, this.player.feetY);
        }

        // Update collectibles
        for (const c of this.collectibles) {
            c.update(safeDt);
        }

        // Check collisions
        this.checkCombat();
        this.checkTraps();
        this.checkCollectibles();
        this.checkSwitches();
        this.updateGates(safeDt);
        this.checkStoryTriggers();
        if (this.gameState === 'story') {
            return;
        }
        this.checkDoor();

        // Update ambient particle effects (P3-1.3)
        const camOffset = this.camera.getOffset();
        this.updateAmbientDust(safeDt, camOffset.x, camOffset.y);
        this.updateTorchSparks(safeDt, camOffset.x, camOffset.y);
        this.updateCrystalShimmer(safeDt, camOffset.x, camOffset.y);
        this.updateFootstepDust(safeDt);

        // Update particles
        this.updateParticles(safeDt * this.timeScale);

        // Update HUD animation timers
        if (this.healthPulseTimer > 0) this.healthPulseTimer -= safeDt;
        if (this.gemBounceTimer > 0) this.gemBounceTimer -= safeDt;
        // Health pulse detection
        if (this.player.health < this.lastPlayerHealth) {
            this.healthPulseTimer = 0.3;
        }
        this.lastPlayerHealth = this.player.health;
        // Update score popups
        for (const popup of this.scorePopups) {
            popup.timer -= safeDt;
            popup.y -= 40 * safeDt;
        }
        this.scorePopups = this.scorePopups.filter(p => p.timer > 0);

        // Update achievement toast timer
        if (this.achievementToast && this.achievementToast.timer > 0) {
            this.achievementToast.timer -= safeDt;
        }

        // Check death - trigger interstitial instead of immediate respawn
        if (this.player.state === 'dead' && !this.deathInterstitial) {
            this.deaths++;
            this.timeRemaining -= 10;
            this.timePenaltyTotal += 10;

            // Consume pending death record for cause tracking
            const cause = this.pendingDeathRecord?.cause ?? 'guard';
            this.lastDeathCause = cause;
            if (cause === 'guard') this.deathsByGuard++;
            else if (cause === 'trap') this.deathsByTrap++;
            else if (cause === 'pit') this.deathsByPit++;

            // On Level 5 during Shadow fight, show defeat taunt
            if (this.currentLevel === 4 && this.activeBoss?.type === 'shadow') {
                this.triggerEndingStory('defeat');
            }

            // Create death interstitial
            this.deathInterstitial = {
                active: true,
                timer: 0,
                duration: 2.5,
                cause,
                guardType: this.pendingDeathRecord?.guardType,
                trapType: this.pendingDeathRecord?.trapType,
                particles: this.spawnDeathInterstitialParticles(cause),
                flavorIndex: Math.floor(Math.random() * DEATH_FLAVOR_TEXT[cause].length),
            };
            this.pendingDeathRecord = null;
        }

        // Update camera with dt for smooth following
        this.updateCamera(safeDt);
    }



    private handlePlayerCollision(): void {
        if (!this.level) return;

        // Get tile positions - check slightly below feet for ground detection
        const tileXLeft = Math.floor(this.player.left / TILE_SIZE);
        const tileXRight = Math.floor((this.player.right - 1) / TILE_SIZE);
        const tileXCenter = Math.floor(this.player.centerX / TILE_SIZE);
        const tileYFeet = Math.floor((this.player.feetY + 1) / TILE_SIZE); // +1 to check tile below feet
        const tileYHead = Math.floor(this.player.top / TILE_SIZE);
        const tileYBody = Math.floor(this.player.centerY / TILE_SIZE);

        // Ground check - check if there's solid ground below feet
        const groundTileL = this.isTileSolidAt(tileXLeft, tileYFeet);
        const groundTileC = this.isTileSolidAt(tileXCenter, tileYFeet);
        const groundTileR = this.isTileSolidAt(tileXRight, tileYFeet);
        const onGround = groundTileL || groundTileC || groundTileR;

        // If on ground, confirm grounded state
        if (onGround) {
            // Snap feet to top of floor tile if close enough
            const targetY = tileYFeet * TILE_SIZE - this.player.height;
            if (this.player.y >= targetY - 4 && this.player.y <= targetY + 4) {
                this.player.y = targetY;
            }

            if (!this.player.isGrounded || this.player.vy > 0) {
                this.player.land();
            }
        } else if (this.player.isGrounded) {
            // Walked off edge
            this.player.startFall();
        }

        // Ceiling check - stop upward movement if hitting ceiling
        if (this.player.vy < 0) {
            const ceilTileL = this.isTileSolidAt(tileXLeft, tileYHead);
            const ceilTileR = this.isTileSolidAt(tileXRight, tileYHead);
            if (ceilTileL || ceilTileR) {
                this.player.vy = 0;
                this.player.y = (tileYHead + 1) * TILE_SIZE;
            }
        }

        // Wall collision - left
        if (this.player.vx < 0) {
            const wallL = this.isTileSolidAt(tileXLeft, tileYBody);
            if (wallL) {
                this.player.x = (tileXLeft + 1) * TILE_SIZE;
                this.player.vx = 0;
            }
        }

        // Wall collision - right
        if (this.player.vx > 0) {
            const wallR = this.isTileSolidAt(tileXRight, tileYBody);
            if (wallR) {
                this.player.x = tileXRight * TILE_SIZE - this.player.width;
                this.player.vx = 0;
            }
        }

        // Deadly tile check (falling into pit)
        if (this.player.y > this.level.height * TILE_SIZE) {
            if (this.player.state !== 'dying' && this.player.state !== 'dead') {
                this.pendingDeathRecord = { cause: 'pit', level: this.currentLevel };
                this.player.die();
                this.services?.audio?.playSound?.('death_cry');
            }
        }
    }

    private checkCombat(): void {
        // Player attacks guard
        if (this.player.attackHitbox) {
            const ph = this.player.attackHitbox;
            const isSwordAttack = this.player.hasSword;

            for (const guard of this.guards) {
                if (!guard.isAlive) continue;

                if (ph.x < guard.right && ph.x + ph.w > guard.left &&
                    ph.y < guard.bottom && ph.y + ph.h > guard.top) {
                    // Push direction: always away from player center
                    const hitDir = guard.centerX >= this.player.centerX ? 1 : -1;
                    const isBoss = guard.type === 'captain' || guard.type === 'shadow';

                    if (isSwordAttack) {
                        // === SWORD ATTACK: works on everything ===
                        if (guard.isBlocking) {
                            this.services?.audio?.playSound?.('sword_clash');
                            this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5, hitDir);
                            this.triggerHitStop(isBoss ? 0.04 : 0.02);
                            this.triggerScreenShakePreset('BLOCK_CLASH');
                        } else {
                            // Sword damage: 1 (2 with Crystal Heart). Recruits take 3 (instant kill).
                            let damage = this.playerInventory.hasHeart ? 2 : 1;
                            if (guard.type === 'recruit') damage = 3; // One-shot recruit
                            guard.takeDamage(damage);
                            this.services?.audio?.playSound?.('hit');
                            this.services?.audio?.playSound?.('hurt_grunt');
                            this.spawnBloodBurst(guard.centerX, guard.y + guard.height * 0.5);
                            this.triggerHitStop(isBoss ? 0.06 : 0.04);
                            this.triggerScreenShakePreset(isBoss ? 'HIT_ENEMY' : 'GUARD_DEATH');
                            if (isBoss) {
                                this.triggerScreenFlash('#ffffff', 0.15, 0.1);
                                this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5, hitDir);
                            }
                            if (!guard.isAlive) {
                                this.guardsDefeated++;
                                this.levelGuardsDefeated++;
                                this.score += SCORING.GUARD_KILL;
                                this.services?.audio?.playSound?.('death_cry');
                                this.spawnDeathBurst(guard.centerX, guard.y + guard.height * 0.5);
                                this.scorePopups.push({ x: guard.centerX, y: guard.y - 10, text: `+${SCORING.GUARD_KILL}`, color: '#ff6644', timer: 1.2 });
                            }
                        }
                    } else {
                        // === PUNCH ATTACK: tiered by guard type ===
                        if (guard.type === 'recruit') {
                            // Punch damages recruits normally; on death → KO instead of dying
                            if (guard.isBlocking) {
                                // Recruits can't block (blockChance = 0), but handle defensively
                                this.services?.audio?.playSound?.('sword_clash');
                                this.triggerHitStop(0.02);
                            } else {
                                guard.takeDamage(1);
                                guard.x += hitDir * 20; // Knock back away from player
                                this.services?.audio?.playSound?.('hurt_grunt');
                                this.spawnBloodBurst(guard.centerX, guard.y + guard.height * 0.5);
                                this.triggerHitStop(0.03);
                                this.triggerScreenShakePreset('GUARD_DEATH');
                                // If recruit "died" from punch, convert to KO
                                if (guard.isDying) {
                                    guard.knockOut();
                                    guard.x += hitDir * 16; // Extra KO knockback
                                    this.scorePopups.push({ x: guard.centerX, y: guard.y - 10, text: 'KO!', color: '#ffaa44', timer: 1.0 });
                                }
                            }
                        } else if (guard.type === 'soldier') {
                            // Soldier: no HP damage, every 3rd punch staggers + pushes
                            guard.punchHitCount++;
                            this.services?.audio?.playSound?.('hurt_grunt');
                            this.triggerHitStop(0.02);
                            // Small impact particles
                            this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5, hitDir);
                            if (guard.punchHitCount % 3 === 0) {
                                // Stagger + knockback
                                guard.stagger();
                                guard.x += hitDir * 24; // Push ~0.75 tile
                                this.triggerHitStop(0.04);
                                this.triggerScreenShakePreset('GUARD_DEATH');
                                this.spawnBloodBurst(guard.centerX, guard.y + guard.height * 0.5);
                                this.scorePopups.push({ x: guard.centerX, y: guard.y - 10, text: 'Stagger!', color: '#ffcc44', timer: 0.8 });
                            }
                        } else {
                            // Veteran / Captain / Shadow: punch has no effect
                            this.services?.audio?.playSound?.('sword_clash'); // Armor clank
                            this.triggerHitStop(0.01);
                            // Small spark at impact
                            this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5, hitDir);
                        }
                    }
                }
            }
        }

        // Guard attacks player
        for (const guard of this.guards) {
            if (!guard.attackHitbox) continue;

            const gh = guard.attackHitbox;
            if (gh.x < this.player.right && gh.x + gh.w > this.player.left &&
                gh.y < this.player.bottom && gh.y + gh.h > this.player.top) {
                const knockDir = guard.facingRight ? 1 : -1;

                if (this.player.isBlocking && !guard.attackIgnoresBlock) {
                    this.services?.audio?.playSound?.('sword_clash');
                    guard.onAttackBlocked();
                    this.spawnSwordClash(this.player.centerX, this.player.centerY, -knockDir);
                    this.triggerHitStop(0.03);
                    this.triggerScreenShakePreset('BLOCK_CLASH');
                    // Track perfect block and award points
                    this.levelPerfectBlocks++;
                    this.totalBlocksEver++;
                    this.score += SCORING.PERFECT_BLOCK;
                    this.scorePopups.push({ x: this.player.centerX, y: this.player.y - 10, text: `+${SCORING.PERFECT_BLOCK}`, color: '#8888ff', timer: 1.0 });
                } else {
                    // Set knockback direction on player for hurt stagger (P3-3.2)
                    this.player.hurtDirection = knockDir;
                    const died = this.player.takeDamage(guard.attackDamage, guard.attackIgnoresBlock);
                    this.services?.audio?.playSound?.('hit');
                    this.services?.audio?.playSound?.(died ? 'death_cry' : 'hurt_grunt');
                    this.spawnBloodBurst(this.player.centerX, this.player.centerY);
                    // Hit stop scales with damage (P3-3.2)
                    this.triggerHitStop(0.04 + guard.attackDamage * 0.02);
                    this.triggerScreenShakePreset('PLAYER_HURT');
                    // Track damage taken
                    this.levelDamagesTaken++;
                    if (died) {
                        this.pendingDeathRecord = { cause: 'guard', guardType: guard.type, level: this.currentLevel };
                    }
                }
            }
        }
    }

    private checkTraps(): void {
        for (const trap of this.traps) {
            if (!trap.active || !trap.deadly) continue;

            // Simple bounding box check
            if (this.player.right > trap.left && this.player.left < trap.right &&
                this.player.bottom > trap.top && this.player.top < trap.bottom) {
                const died = this.player.takeDamage(3); // Traps are deadly!
                this.services?.audio?.playSound?.('hit');
                this.services?.audio?.playSound?.(died ? 'death_cry' : 'hurt_grunt');
                this.spawnBloodBurst(this.player.centerX, this.player.centerY);
                this.triggerHitStop(0.06);
                this.triggerScreenShakePreset('TRAP_HIT');
                this.triggerScreenFlash('#ff2200', 0.12, 0.15);
                if (died) {
                    this.pendingDeathRecord = { cause: 'trap', trapType: trap.type, level: this.currentLevel };
                }
            }
        }
    }

    private checkCollectibles(): void {
        for (const c of this.collectibles) {
            if (c.collected) continue;

            if (this.player.right > c.left && this.player.left < c.right &&
                this.player.bottom > c.top && this.player.top < c.bottom) {
                const type = c.collect();

                switch (type) {
                    case 'potion_hp':
                        this.player.heal(1);
                        this.services?.audio?.playSound?.('powerup');
                        break;
                    case 'potion_max':
                        this.player.increaseMaxHealth();
                        this.services?.audio?.playSound?.('unlock');
                        break;
                    case 'gem':
                        this.gemsCollected++;
                        this.levelGemsCollected++;
                        this.totalGemsEver++;
                        this.score += SCORING.GEM_VALUE;
                        this.services?.audio?.playSound?.('coin');
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: `+${SCORING.GEM_VALUE}`, color: '#ffdd44', timer: 1.0 });
                        this.gemBounceTimer = 0.3;
                        break;
                    case 'time':
                        this.timeRemaining = Math.min(this.MAX_TIME, this.timeRemaining + 15);
                        this.score += 25;
                        this.services?.audio?.playSound?.('coin');
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: '+15s', color: '#44ddff', timer: 1.0 });
                        break;
                    case 'item_sword':
                        this.playerInventory.hasBlade = true;
                        this.player.inventory.hasBlade = true;
                        this.player.inCombatMode = true;
                        this.player.hasSword = true;
                        this.swordEverDrawn = true;
                        this.pendingItemRaise = true; // Trigger raise after story
                        this.saveInventory();
                        this.services?.audio?.playSound?.('unlock');
                        this.triggerScreenFlash('#c0d0e0', 0.4, 0.2);
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: 'Ancient Blade!', color: '#c0d0e0', timer: 2.0 });
                        this.queueItemStory('item_sword');
                        break;
                    case 'item_armor':
                        this.playerInventory.hasArmor = true;
                        this.player.inventory.hasArmor = true;
                        this.player.maxHealth = 5;
                        this.player.health = this.player.maxHealth; // Full heal
                        this.saveInventory();
                        this.services?.audio?.playSound?.('unlock');
                        this.triggerScreenFlash('#8899aa', 0.4, 0.2);
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: 'Iron Armor!', color: '#8899aa', timer: 2.0 });
                        this.queueItemStory('item_armor');
                        break;
                    case 'item_boots':
                        this.playerInventory.hasBoots = true;
                        this.player.inventory.hasBoots = true;
                        this.saveInventory();
                        this.services?.audio?.playSound?.('unlock');
                        this.triggerScreenFlash('#44aaff', 0.4, 0.2);
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: 'Dash Boots!', color: '#44aaff', timer: 2.0 });
                        this.queueItemStory('item_boots');
                        break;
                    case 'item_heart':
                        this.playerInventory.hasHeart = true;
                        this.player.inventory.hasHeart = true;
                        this.saveInventory();
                        this.services?.audio?.playSound?.('unlock');
                        this.triggerScreenFlash('#ff44aa', 0.5, 0.3);
                        this.scorePopups.push({ x: c.x, y: c.y - 10, text: 'Crystal Heart!', color: '#ff44aa', timer: 2.0 });
                        this.queueItemStory('item_heart');
                        break;
                    case 'owl':
                        this.foundOwl = true;
                        // Unlock all levels on victory
                        this.unlockedLevels = ALL_LEVELS.length;
                        this.saveProgress();
                        // Calculate final level bonus
                        const finalBonus = this.calculateLevelBonus();
                        this.score += finalBonus;
                        this.score += 1000; // Owl bonus
                        // Check all achievements
                        this.checkAchievements();
                        this.checkVictoryAchievements();
                        this.stateTimer = 0;
                        this.services?.audio?.playSound?.('success');
                        // Golden radiance explosion (P3-1.3)
                        this.spawnOwlRadiance(c.x, c.y);
                        this.triggerScreenFlash('#ffd700', 0.6, 0.4);
                        // Play victory music if not already playing
                        if (this.musicState !== 'victory') {
                            this.services?.audio?.playMusic?.('epic_heroic', 0.5);
                            this.musicState = 'victory';
                        }
                        // Trigger the Owl's wisdom dialogue before victory screen
                        this.triggerEndingStory('victory');
                        break;
                }
            }
        }
    }

    private checkSwitches(): void {
        if (!this.level) return;
        for (const switchTile of this.switches) {
            const isPressed = this.isPlayerOnSwitch(switchTile);
            if (isPressed && !switchTile.pressed) {
                this.services?.audio?.playSound?.('switch_click');
            }
            switchTile.pressed = switchTile.pressed || isPressed;

            if (!isPressed) continue;

            let openedGate = false;
            for (const gateIndex of switchTile.linkedGates) {
                const gate = this.gates[gateIndex];
                if (!gate || gate.open) continue;
                gate.open = true;
                openedGate = true;
            }
            if (openedGate) {
                this.services?.audio?.playSound?.('gate_open');
            }
        }
    }

    private updateGates(dt: number): void {
        const speed = 3;
        for (const gate of this.gates) {
            const target = gate.open ? 1 : 0;
            if (gate.openProgress === target) continue;
            const direction = gate.open ? 1 : -1;
            gate.openProgress = Math.max(0, Math.min(1, gate.openProgress + direction * speed * dt));
        }
    }

    private updateFootsteps(dt: number): void {
        if (!this.player.isGrounded || this.player.state !== 'run' || Math.abs(this.player.vx) < 1) {
            this.footstepTimer = 0;
            return;
        }

        this.footstepTimer -= dt;
        if (this.footstepTimer <= 0) {
            this.services?.audio?.playSound?.('footstep_stone');
            this.footstepTimer = 0.32;
        }
    }

    private isPlayerOnSwitch(switchTile: SwitchTile): boolean {
        const sx = switchTile.x;
        const sy = switchTile.y;
        return this.player.centerX >= sx && this.player.centerX < sx + TILE_SIZE &&
            this.player.feetY >= sy && this.player.feetY <= sy + TILE_SIZE + 1;
    }

    private isTileSolidAt(tileX: number, tileY: number): boolean {
        if (!this.level) return false;
        const tile = getTileAt(this.level, tileX, tileY);
        if (tile === 'gate') {
            const gateIndex = this.gateIndexByTile.get(`${tileX},${tileY}`);
            if (typeof gateIndex === 'number' && this.gates[gateIndex]?.open) return false;
        }
        return tile === 'floor' || tile === 'wall' || tile === 'platform' || tile === 'gate';
    }

    private isSwitchPressed(tileX: number, tileY: number): boolean {
        return !!this.getSwitchAt(tileX, tileY)?.pressed;
    }

    private getSwitchAt(tileX: number, tileY: number): SwitchTile | null {
        const switchIndex = this.switchIndexByTile.get(`${tileX},${tileY}`);
        if (typeof switchIndex !== 'number') return null;
        return this.switches[switchIndex] ?? null;
    }

    private linkSwitchToGate(switchIndex: number, gateIndex: number): void {
        const switchTile = this.switches[switchIndex];
        const gate = this.gates[gateIndex];
        if (!switchTile || !gate) return;

        if (!switchTile.linkedGates.includes(gateIndex)) {
            switchTile.linkedGates.push(gateIndex);
        }
        if (!gate.linkedSwitches.includes(switchIndex)) {
            gate.linkedSwitches.push(switchIndex);
        }
    }

    private linkSwitchesToGates(): void {
        if (this.gates.length === 0 || this.switches.length === 0) return;

        this.switches.forEach((switchTile, switchIndex) => {
            for (let gateIndex = 0; gateIndex < this.gates.length; gateIndex++) {
                const gate = this.gates[gateIndex];
                if (gate.color !== switchTile.color) continue;
                this.linkSwitchToGate(switchIndex, gateIndex);
            }
        });
    }

    /**
     * Place moonlight shafts at gates, switches, and regular intervals
     * to provide ambient lighting so the level isn't pitch black between torches.
     */
    private placeMoonlights(): void {
        if (!this.level) return;

        const levelPixelWidth = this.level.width * TILE_SIZE;
        const levelPixelHeight = this.level.height * TILE_SIZE;

        // Moonlight near every gate (level exits / doors)
        for (const gate of this.gates) {
            this.lighting.addMoonlight(
                gate.x + TILE_SIZE / 2,
                gate.y - TILE_SIZE
            );
        }

        // Moonlight near every switch
        for (const sw of this.switches) {
            this.lighting.addMoonlight(
                sw.x + TILE_SIZE / 2,
                sw.y - TILE_SIZE
            );
        }

        // Moonlight near the door/exit
        const door = findDoorPosition(this.level);
        if (door) {
            this.lighting.addMoonlight(door.x + TILE_SIZE / 2, door.y - TILE_SIZE);
        }

        // Place ambient moonlights at regular intervals along the level
        // Spacing decreases on later levels (fewer moonlights = darker feel)
        const spacingByLevel = [400, 500, 650, 800, 1000];
        const spacing = spacingByLevel[this.currentLevel] ?? 600;
        const midY = levelPixelHeight * 0.35; // Upper portion of level

        for (let px = spacing / 2; px < levelPixelWidth; px += spacing) {
            this.lighting.addMoonlight(px, midY);
        }
    }

    private checkDoor(): void {
        if (!this.level) return;

        const door = findDoorPosition(this.level);
        if (!door) return;

        // Block if door is locked (Captain must be defeated first)
        if (this.doorLocked) return;

        if (this.player.centerX >= door.x && this.player.centerX < door.x + TILE_SIZE &&
            this.player.feetY >= door.y && this.player.feetY < door.y + TILE_SIZE) {
            // Level complete!
            if (this.currentLevel < ALL_LEVELS.length - 1) {
                // Check achievements before transitioning
                this.checkAchievements();

                // Build score breakdown (defer score addition until player confirms)
                this.scoreBreakdown = this.buildScoreBreakdown();

                this.gameState = 'level_complete';
                this.stateTimer = 0;
                this.services?.audio?.playSound?.('success');
            }
        }
    }

    private calculateLevelBonus(): number {
        let bonus = 0;
        const levelTime = (Date.now() - this.levelStartTime) / 1000;

        // Time bonus: points per second remaining
        bonus += Math.floor(this.timeRemaining * SCORING.TIME_VALUE);

        // Speed bonus: 2x multiplier if completed in under 60 seconds
        if (levelTime < SCORING.SPEED_THRESHOLD) {
            bonus *= SCORING.SPEED_MULTIPLIER;
        }

        // No-hit bonus: 500 points if no damage taken this level
        if (this.levelDamagesTaken === 0) {
            bonus += SCORING.NO_HIT_BONUS;
        }

        // Perfect blocks bonus
        bonus += this.levelPerfectBlocks * SCORING.PERFECT_BLOCK;

        // Completionist bonus: all gems collected
        if (this.totalGemsInLevel > 0 && this.levelGemsCollected >= this.totalGemsInLevel) {
            bonus += 250; // Bonus for collecting all gems
        }

        return bonus;
    }

    private buildScoreBreakdown(): ScoreBreakdownState {
        const levelTime = (Date.now() - this.levelStartTime) / 1000;
        const lines: ScoreBreakdownState['lines'] = [];

        // Gems
        const gemScore = this.levelGemsCollected * SCORING.GEM_VALUE;
        lines.push({ label: `Gems Collected (${this.levelGemsCollected}/${this.totalGemsInLevel})`, value: gemScore, displayValue: 0 });

        // Time remaining
        let timeScore = Math.floor(this.timeRemaining * SCORING.TIME_VALUE);
        const isSpeedBonus = levelTime < SCORING.SPEED_THRESHOLD;
        if (isSpeedBonus) {
            timeScore *= SCORING.SPEED_MULTIPLIER;
        }
        lines.push({ label: `Time Remaining${isSpeedBonus ? ' (x2 SPEED!)' : ''}`, value: timeScore, displayValue: 0 });

        // Guards defeated this level
        if (this.levelGuardsDefeated > 0) {
            lines.push({ label: `Guards Defeated (${this.levelGuardsDefeated})`, value: this.levelGuardsDefeated * SCORING.GUARD_KILL, displayValue: 0 });
        }

        // Perfect blocks
        if (this.levelPerfectBlocks > 0) {
            lines.push({ label: `Perfect Blocks (${this.levelPerfectBlocks})`, value: this.levelPerfectBlocks * SCORING.PERFECT_BLOCK, displayValue: 0 });
        }

        // No-hit bonus
        if (this.levelDamagesTaken === 0) {
            lines.push({ label: 'Flawless (No Damage!)', value: SCORING.NO_HIT_BONUS, displayValue: 0 });
        }

        // All gems bonus
        if (this.totalGemsInLevel > 0 && this.levelGemsCollected >= this.totalGemsInLevel) {
            lines.push({ label: 'All Gems Collected!', value: 250, displayValue: 0 });
        }

        const levelTotal = lines.reduce((sum, l) => sum + l.value, 0);

        return {
            phase: 'counting',
            lineIndex: 0,
            lineProgress: 0,
            lines,
            levelTotal,
            runningTotal: this.score + levelTotal,
        };
    }

    // ===== ACHIEVEMENT SYSTEM (uses platform AchievementService) =====

    private loadPersistentStats(): void {
        try {
            const saved = localStorage.getItem(this.STATS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.totalBlocksEver = parsed.totalBlocksEver ?? 0;
                this.totalGemsEver = parsed.totalGemsEver ?? 0;
            }
        } catch {
            // Use defaults
        }
    }

    private savePersistentStats(): void {
        try {
            localStorage.setItem(this.STATS_KEY, JSON.stringify({
                totalBlocksEver: this.totalBlocksEver,
                totalGemsEver: this.totalGemsEver,
            }));
        } catch {
            // Silently fail
        }
    }

    private loadInventory(): void {
        try {
            const saved = localStorage.getItem(this.INVENTORY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.playerInventory = {
                    hasBlade: parsed.hasBlade ?? false,
                    hasArmor: parsed.hasArmor ?? false,
                    hasBoots: parsed.hasBoots ?? false,
                    hasHeart: parsed.hasHeart ?? false,
                };
            }
        } catch {
            // Use defaults
        }
    }

    private saveInventory(): void {
        try {
            localStorage.setItem(this.INVENTORY_KEY, JSON.stringify(this.playerInventory));
        } catch {
            // Silently fail
        }
    }

    private resetInventory(): void {
        this.playerInventory = { hasBlade: false, hasArmor: false, hasBoots: false, hasHeart: false };
        this.player.inventory = { hasBlade: false, hasArmor: false, hasBoots: false, hasHeart: false };
        this.player.hasSword = false;
        this.player.inCombatMode = false;
        this.player.maxHealth = 3;
        this.player.health = 3;
        this.saveInventory();
    }

    private applyInventoryToPlayer(): void {
        this.player.inventory = { ...this.playerInventory };
        if (this.playerInventory.hasArmor) {
            this.player.maxHealth = 5;
        }
    }

    private trackAchievement(type: string, value: number): void {
        const unlocked = this.services?.achievements?.trackGameSpecificStat?.(
            'platform-adventure',
            type,
            value
        );
        // Show toast for any newly unlocked achievements
        if (unlocked && unlocked.length > 0) {
            for (const achievement of unlocked) {
                this.achievementToast = { name: achievement.title, timer: 3 };
                this.services?.audio?.playSound?.('unlock');
            }
        }
        this.savePersistentStats();
    }

    private checkAchievements(): void {
        // Track game stats for achievements
        this.trackAchievement('guards_defeated', this.guardsDefeated);
        this.trackAchievement('blocks_total', this.totalBlocksEver);
        this.trackAchievement('gems_collected', this.totalGemsEver);
        this.trackAchievement('score', this.score);

        // Flawless: Complete level without damage
        if (this.levelDamagesTaken === 0) {
            this.trackAchievement('flawless_level', 1);
        }

        // Time Lord: Finish with 60+ seconds remaining
        if (this.timeRemaining >= 60) {
            this.trackAchievement('time_bonus', 1);
        }

        // Completionist: All gems in a level
        if (this.totalGemsInLevel > 0 && this.levelGemsCollected >= this.totalGemsInLevel) {
            this.trackAchievement('all_gems_level', 1);
        }

        // Pacifist: Complete Level 1 without drawing sword
        if (this.currentLevel === 0 && !this.swordEverDrawn) {
            this.trackAchievement('pacifist_level1', 1);
        }
    }

    private checkVictoryAchievements(): void {
        // Owl Finder: Find the Golden Owl
        if (this.foundOwl) {
            this.trackAchievement('owl_found', 1);
        }

        // Speedrunner: Complete game in under 8 minutes
        const totalGameTime = (Date.now() - this.gameStartTime) / 1000;
        if (this.foundOwl && totalGameTime < 480) { // 8 minutes = 480 seconds
            this.trackAchievement('speedrun_complete', 1);
        }

        // Final score achievement
        this.trackAchievement('score', this.score);
    }

    // ===== LEADERBOARD SYSTEM =====

    private loadLeaderboard(): void {
        try {
            const saved = localStorage.getItem(this.LEADERBOARD_KEY);
            if (saved) {
                this.leaderboard = JSON.parse(saved);
            } else {
                this.leaderboard = [];
            }
        } catch {
            this.leaderboard = [];
        }
    }

    private saveLeaderboard(): void {
        try {
            localStorage.setItem(this.LEADERBOARD_KEY, JSON.stringify(this.leaderboard));
        } catch {
            // Silently fail
        }
    }

    private loadProgress(): void {
        try {
            const saved = localStorage.getItem(this.PROGRESS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                this.unlockedLevels = data.unlockedLevels ?? 1;
                this.levelBestScores = data.levelBestScores ?? [0, 0, 0, 0, 0];
                this.levelBestTimes = data.levelBestTimes ?? [0, 0, 0, 0, 0];
            }
        } catch {
            // Use defaults
        }
    }

    private saveProgress(): void {
        try {
            localStorage.setItem(this.PROGRESS_KEY, JSON.stringify({
                unlockedLevels: this.unlockedLevels,
                levelBestScores: this.levelBestScores,
                levelBestTimes: this.levelBestTimes,
            }));
        } catch {
            // Silently fail
        }
    }

    private isHighScore(score: number): boolean {
        if (this.leaderboard.length < 10) return true;
        return score > (this.leaderboard[this.leaderboard.length - 1]?.score ?? 0);
    }

    private addToLeaderboard(entry: LeaderboardEntry): void {
        this.leaderboard.push(entry);
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 10); // Keep top 10
        this.saveLeaderboard();
    }

    private updateLevelComplete(dt: number): void {
        this.stateTimer += dt;
        if (!this.scoreBreakdown) {
            // Fallback: old behavior if no breakdown
            if (this.stateTimer > 2) {
                this.loadLevel(this.currentLevel + 1);
                this.gameState = 'level_intro';
                this.stateTimer = 0;
            }
            return;
        }

        const bd = this.scoreBreakdown;
        if (bd.phase === 'counting') {
            bd.lineProgress += dt * 2.5; // ~0.4s per line
            if (bd.lineProgress >= 1) {
                // Finalize current line
                const line = bd.lines[bd.lineIndex];
                line.displayValue = line.value;
                bd.lineIndex++;
                bd.lineProgress = 0;
                this.services?.audio?.playSound?.('coin');

                if (bd.lineIndex >= bd.lines.length) {
                    bd.phase = 'waiting';
                }
            } else {
                // Animate current line's display value
                const line = bd.lines[bd.lineIndex];
                line.displayValue = Math.floor(line.value * bd.lineProgress);
            }
        } else if (bd.phase === 'waiting') {
            const input = this.services?.input;
            if (input?.isActionPressed?.()) {
                // Award the score and advance
                this.score += bd.levelTotal;

                // Save best score/time and unlock next level
                const lvl = this.currentLevel;
                this.levelBestScores[lvl] = Math.max(this.levelBestScores[lvl], bd.levelTotal);
                this.levelBestTimes[lvl] = Math.max(this.levelBestTimes[lvl], this.timeRemaining);
                if (lvl + 1 >= this.unlockedLevels) {
                    this.unlockedLevels = Math.min(ALL_LEVELS.length, lvl + 2);
                }
                this.saveProgress();

                this.scoreBreakdown = null;
                this.loadLevel(this.currentLevel + 1);
                this.gameState = 'level_intro';
                this.stateTimer = 0;
            }
        }
    }

    private updateDeathInterstitial(dt: number): void {
        if (!this.deathInterstitial) return;
        const di = this.deathInterstitial;
        di.timer += dt;

        // Animate particles
        for (const p of di.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            // Gravity for pit particles (falling down), upward for guard/trap
            if (di.cause === 'pit') {
                p.vy += 30 * dt;
            } else {
                p.vy -= 20 * dt;
            }
        }
        di.particles = di.particles.filter(p => p.life > 0);

        // Wait for SPACE press (after 0.5s minimum so player sees the screen)
        const input = this.services?.input;
        if (di.timer > 0.5 && input?.isActionPressed?.()) {
            this.completeDeathInterstitial();
        }
    }

    private completeDeathInterstitial(): void {
        this.deathInterstitial = null;
        this.gameState = 'game_over';
        this.stateTimer = 0;
    }

    private spawnDeathInterstitialParticles(cause: DeathCause): DeathInterstitialParticle[] {
        const particles: DeathInterstitialParticle[] = [];
        const cx = 400; // Canvas center x (GAME_CONFIG.CANVAS_WIDTH / 2)
        const cy = 200; // Slightly above center

        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 80;
            let color: string;
            let vy: number;

            switch (cause) {
                case 'guard':
                    color = `rgba(${200 + Math.random() * 55}, ${Math.random() * 60}, ${Math.random() * 30}, 0.8)`;
                    vy = -20 - Math.random() * 60; // Rise up like embers
                    break;
                case 'trap':
                    color = `rgba(${220 + Math.random() * 35}, ${150 + Math.random() * 80}, ${Math.random() * 40}, 0.8)`;
                    vy = Math.sin(angle) * speed; // Scatter
                    break;
                case 'pit':
                    color = `rgba(${60 + Math.random() * 40}, ${100 + Math.random() * 80}, ${200 + Math.random() * 55}, 0.7)`;
                    vy = 20 + Math.random() * 40; // Fall down like wisps
                    break;
                default:
                    color = `rgba(180, 180, 200, 0.6)`;
                    vy = -10 - Math.random() * 30;
            }

            particles.push({
                x: cx + (Math.random() - 0.5) * 120,
                y: cy + (Math.random() - 0.5) * 40,
                vx: Math.cos(angle) * speed * 0.5,
                vy,
                life: 1.5 + Math.random() * 1.5,
                maxLife: 2.5,
                size: 2 + Math.random() * 4,
                color,
            });
        }
        return particles;
    }

    private renderDeathInterstitial(ctx: CanvasRenderingContext2D): void {
        if (!this.deathInterstitial?.active) return;
        const di = this.deathInterstitial;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Fade in (0 to 1 over 0.3s)
        const fadeIn = Math.min(1, di.timer / 0.3);

        // Overlay color based on death type
        let overlayColor: string;
        switch (di.cause) {
            case 'guard': overlayColor = `rgba(60, 10, 10, ${0.85 * fadeIn})`; break;
            case 'trap':  overlayColor = `rgba(50, 30, 5, ${0.85 * fadeIn})`; break;
            case 'pit':   overlayColor = `rgba(10, 15, 50, ${0.85 * fadeIn})`; break;
            default:      overlayColor = `rgba(30, 30, 30, ${0.85 * fadeIn})`;
        }

        ctx.fillStyle = overlayColor;
        ctx.fillRect(0, 0, w, h);

        // Particles (behind text)
        for (const p of di.particles) {
            const alpha = (p.life / p.maxLife) * fadeIn;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Icon with pulse
        const iconAlpha = fadeIn;
        const iconPulse = 1 + Math.sin(di.timer * 4) * 0.08;
        ctx.save();
        ctx.translate(w / 2, h / 2 - 50);
        ctx.scale(iconPulse, iconPulse);
        ctx.globalAlpha = iconAlpha;
        this.drawDeathIcon(ctx, di.cause, di.trapType);
        ctx.restore();

        // Title (0.2s delay)
        if (di.timer > 0.2) {
            const titleAlpha = Math.min(1, (di.timer - 0.2) / 0.2);
            ctx.globalAlpha = titleAlpha * fadeIn;
            ctx.fillStyle = di.cause === 'guard' ? '#ff6644' : di.cause === 'trap' ? '#ffaa33' : '#6688ff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.getDeathTitle(di), w / 2, h / 2 + 15);
        }

        // Flavor text (0.5s delay)
        if (di.timer > 0.5) {
            const flavorAlpha = Math.min(1, (di.timer - 0.5) / 0.3);
            ctx.globalAlpha = flavorAlpha * fadeIn;
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(DEATH_FLAVOR_TEXT[di.cause][di.flavorIndex], w / 2, h / 2 + 50);
        }

        // -10s penalty indicator
        if (di.timer > 0.3) {
            const penAlpha = Math.min(1, (di.timer - 0.3) / 0.2);
            ctx.globalAlpha = penAlpha * fadeIn;
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('-10s', w / 2, h / 2 + 80);
        }

        // "SPACE to continue" prompt (after 0.8s, pulsing)
        if (di.timer > 0.8) {
            const promptAlpha = 0.5 + Math.sin(di.timer * 3) * 0.3;
            ctx.globalAlpha = promptAlpha;
            ctx.fillStyle = '#888888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('SPACE to continue', w / 2, h / 2 + 115);
        }

        ctx.globalAlpha = 1;
    }

    private drawDeathIcon(ctx: CanvasRenderingContext2D, cause: DeathCause, trapType?: TrapType): void {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        switch (cause) {
            case 'guard': {
                // Crossed swords
                const s = 22;
                ctx.strokeStyle = '#ff6644';
                // Sword 1 (top-left to bottom-right)
                ctx.beginPath();
                ctx.moveTo(-s, -s); ctx.lineTo(s, s);
                ctx.moveTo(-s + 6, -s); ctx.lineTo(-s, -s + 6); // guard
                ctx.stroke();
                // Sword 2 (top-right to bottom-left)
                ctx.beginPath();
                ctx.moveTo(s, -s); ctx.lineTo(-s, s);
                ctx.moveTo(s - 6, -s); ctx.lineTo(s, -s + 6); // guard
                ctx.stroke();
                break;
            }
            case 'trap': {
                // Spikes or jaws based on trap type
                ctx.strokeStyle = '#ffaa33';
                ctx.fillStyle = '#ffaa33';
                if (trapType === 'chomper') {
                    // Jaw shape
                    const jw = 24;
                    // Upper jaw
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const x = -jw + i * (jw * 2 / 4);
                        ctx.moveTo(x, -4); ctx.lineTo(x + jw / 4, 8); ctx.lineTo(x + jw / 2, -4);
                    }
                    ctx.stroke();
                    // Lower jaw
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const x = -jw + i * (jw * 2 / 4);
                        ctx.moveTo(x, 4); ctx.lineTo(x + jw / 4, -8); ctx.lineTo(x + jw / 2, 4);
                    }
                    ctx.stroke();
                } else {
                    // Spike triangles
                    const sw = 28;
                    for (let i = 0; i < 4; i++) {
                        const x = -sw + i * (sw * 2 / 3);
                        ctx.beginPath();
                        ctx.moveTo(x, 10);
                        ctx.lineTo(x + sw / 3, -14);
                        ctx.lineTo(x + sw * 2 / 3, 10);
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                break;
            }
            case 'pit': {
                // Downward chevrons
                ctx.strokeStyle = '#6688ff';
                for (let i = 0; i < 3; i++) {
                    const y = -12 + i * 14;
                    const alpha = 1 - i * 0.25;
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.moveTo(-16, y);
                    ctx.lineTo(0, y + 10);
                    ctx.lineTo(16, y);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                break;
            }
        }
    }

    private getDeathTitle(di: DeathInterstitial): string {
        switch (di.cause) {
            case 'guard': {
                const guardName = di.guardType
                    ? di.guardType.charAt(0).toUpperCase() + di.guardType.slice(1)
                    : 'Guard';
                return `SLAIN BY ${guardName.toUpperCase()}`;
            }
            case 'trap': {
                if (di.trapType === 'chomper') return 'CRUSHED';
                if (di.trapType === 'loose_floor') return 'GROUND COLLAPSED';
                return 'IMPALED';
            }
            case 'pit':
                return 'FELL INTO THE ABYSS';
            default:
                return 'FALLEN';
        }
    }

    private updateEndScreen(dt: number): void {
        this.stateTimer += dt;
        const input = this.services?.input;

        // Update achievement toast even on end screens
        if (this.achievementToast && this.achievementToast.timer > 0) {
            this.achievementToast.timer -= dt;
        }

        if (this.enteringName) {
            // Handle name input (victory or game_over)
            if (input?.isUpPressed?.() && !this.nameInputUpWasPressed) {
                this.nameInputChars[this.nameInputIndex] = this.nextChar(this.nameInputChars[this.nameInputIndex], 1);
            }
            if (input?.isDownPressed?.() && !this.nameInputDownWasPressed) {
                this.nameInputChars[this.nameInputIndex] = this.nextChar(this.nameInputChars[this.nameInputIndex], -1);
            }
            if (input?.isLeftPressed?.() && !this.nameInputLeftWasPressed) {
                this.nameInputIndex = Math.max(0, this.nameInputIndex - 1);
            }
            if (input?.isRightPressed?.() && !this.nameInputRightWasPressed) {
                this.nameInputIndex = Math.min(2, this.nameInputIndex + 1);
            }
            if (input?.isActionPressed?.() && !this.nameInputActionWasPressed) {
                // Submit name
                const name = this.nameInputChars.join('');
                this.addToLeaderboard({
                    name,
                    score: this.score,
                    timeRemaining: Math.floor(this.timeRemaining),
                    deaths: this.deaths,
                    date: Date.now(),
                });
                this.enteringName = false;
                this.services?.audio?.playSound?.('success');
            }

            // Update key states
            this.nameInputUpWasPressed = input?.isUpPressed?.() ?? false;
            this.nameInputDownWasPressed = input?.isDownPressed?.() ?? false;
            this.nameInputLeftWasPressed = input?.isLeftPressed?.() ?? false;
            this.nameInputRightWasPressed = input?.isRightPressed?.() ?? false;
            this.nameInputActionWasPressed = input?.isActionPressed?.() ?? false;
            return;
        }

        if (this.stateTimer > 2 && input?.isActionPressed?.()) {
            if (this.isHighScore(this.score) && !this.enteringName && !this.hasEnteredName) {
                // Enter name input mode (both victory and game_over)
                this.enteringName = true;
                this.nameInputIndex = 0;
                this.nameInputChars = ['A', 'A', 'A'];
                this.hasEnteredName = true;
                this.services?.audio?.playSound?.('coin');
            } else {
                this.endGame();
            }
        }
    }

    private nextChar(char: string, direction: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let index = chars.indexOf(char);
        if (index === -1) index = 0;
        index = (index + direction + chars.length) % chars.length;
        return chars[index];
    }

    private beginStory(event: StoryEvent): void {
        this.activeStory = event;
        this.storySeen.add(event.id);
        this.gameState = 'story';
        this.stateTimer = 0;
        this.storyCharIndex = 0;
        this.storyFullyRevealed = false;
    }

    private updateStory(dt: number): void {
        this.stateTimer += dt;

        // Advance typewriter
        if (!this.storyFullyRevealed && this.activeStory) {
            this.storyCharIndex += dt * 30;
            if (this.storyCharIndex >= this.activeStory.text.length) {
                this.storyFullyRevealed = true;
            }
        }

        const input = this.services?.input;
        if (this.stateTimer > 0.2 && input?.isActionPressed?.()) {
            if (!this.storyFullyRevealed) {
                // First press: reveal all text
                this.storyFullyRevealed = true;
                this.storyCharIndex = this.activeStory?.text.length ?? 0;
            } else {
                // Second press: advance to next story event
                if (this.storyQueue.length > 0) {
                    const nextEvent = this.storyQueue.shift()!;
                    // Check for victory transition marker
                    if (nextEvent.id === '__victory_transition__') {
                        this.activeStory = null;
                        this.gameState = 'victory';
                    } else {
                        this.beginStory(nextEvent);
                    }
                } else {
                    this.activeStory = null;
                    // Check if we should go to victory instead of playing
                    if (this.foundOwl) {
                        this.gameState = 'victory';
                    } else {
                        this.gameState = 'playing';
                        // Play item raise animation if pending
                        if (this.pendingItemRaise) {
                            this.pendingItemRaise = false;
                            this.player.startItemRaise();
                            this.services?.audio?.playSound?.('powerup');
                        }
                    }
                }
            }
        }
    }

    private checkStoryTriggers(): void {
        if (!this.level || this.activeStory) return;

        for (const event of this.levelStory) {
            if (this.storySeen.has(event.id)) continue;

            const trigger = event.trigger;

            // Handle position-based triggers (legacy)
            if (trigger.type === 'position') {
                const radius = trigger.radius ?? 1.5;
                const targetX = trigger.x * TILE_SIZE + TILE_SIZE * 0.5;
                const targetY = trigger.y * TILE_SIZE + TILE_SIZE * 0.5;
                const dx = this.player.centerX - targetX;
                const dy = this.player.centerY - targetY;
                const distSq = dx * dx + dy * dy;
                if (distSq <= (radius * TILE_SIZE) * (radius * TILE_SIZE)) {
                    this.beginStory(event);
                    break;
                }
            }

            // Handle tile proximity triggers - triggers follow the tile wherever it's placed
            if (trigger.type === 'tile_proximity') {
                const tilePositions = this.findTilePositions(trigger.tileType);
                if (tilePositions.length === 0) continue;

                // If index specified, use that specific tile; otherwise use first (index 0)
                const targetIndex = trigger.index ?? 0;
                if (targetIndex >= tilePositions.length) continue;

                const tilePos = tilePositions[targetIndex];
                const radius = trigger.radius ?? 1.5;
                const targetX = tilePos.x * TILE_SIZE + TILE_SIZE * 0.5;
                const targetY = tilePos.y * TILE_SIZE + TILE_SIZE * 0.5;
                const dx = this.player.centerX - targetX;
                const dy = this.player.centerY - targetY;
                const distSq = dx * dx + dy * dy;
                if (distSq <= (radius * TILE_SIZE) * (radius * TILE_SIZE)) {
                    this.beginStory(event);
                    break;
                }
            }
        }
    }

    // Find all positions of a specific tile type in the current level
    private findTilePositions(tileType: TileType): Array<{ x: number; y: number }> {
        if (!this.level) return [];

        const positions: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < this.level.height; y++) {
            for (let x = 0; x < this.level.width; x++) {
                if (getTileAt(this.level, x, y) === tileType) {
                    positions.push({ x, y });
                }
            }
        }
        // Sort by row (y) then column (x) for consistent ordering
        positions.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        return positions;
    }

    private triggerBossStory(triggerType: 'boss_alert' | 'boss_defeat' | 'boss_phase', bossType: GuardType, phase?: number): void {
        if (this.activeStory) return;

        for (const event of this.levelStory) {
            if (this.storySeen.has(event.id)) continue;

            const trigger = event.trigger;
            if (trigger.type !== triggerType) continue;

            if (triggerType === 'boss_alert' && trigger.type === 'boss_alert') {
                if (trigger.bossType === bossType) {
                    this.beginStory(event);
                    return;
                }
            } else if (triggerType === 'boss_defeat' && trigger.type === 'boss_defeat') {
                if (trigger.bossType === bossType) {
                    this.beginStory(event);
                    return;
                }
            } else if (triggerType === 'boss_phase' && trigger.type === 'boss_phase') {
                if (trigger.bossType === bossType && trigger.phase === phase) {
                    this.beginStory(event);
                    return;
                }
            }
        }
    }

    private triggerKaelResponse(phase: number): void {
        if (this.activeStory) return;

        for (const event of this.levelStory) {
            if (this.storySeen.has(event.id)) continue;
            const trigger = event.trigger;
            if (trigger.type === 'kael_response' && trigger.phase === phase) {
                this.beginStory(event);
                return;
            }
        }
    }

    private triggerEndingStory(triggerType: 'victory' | 'defeat'): void {
        // Check level-specific events first
        for (const event of this.levelStory) {
            if (this.storySeen.has(event.id)) continue;
            if (event.trigger.type === triggerType) {
                this.beginStory(event);
                // For victory, transition to victory screen after story
                if (triggerType === 'victory') {
                    this.storyQueue.push({
                        id: '__victory_transition__',
                        text: '',
                        trigger: { type: 'victory' },
                    });
                }
                return;
            }
        }

        // Check global events (for defeat)
        for (const event of GLOBAL_STORY_EVENTS) {
            if (this.storySeen.has(event.id)) continue;
            if (event.trigger.type === triggerType) {
                this.beginStory(event);
                return;
            }
        }

        // If no story found for victory, go directly to victory screen
        if (triggerType === 'victory') {
            this.gameState = 'victory';
        }
    }

    private queueItemStory(itemType: string): void {
        const events = STORY_BY_LEVEL[this.currentLevel] ?? [];
        for (const event of events) {
            if (this.storySeen.has(event.id)) continue;
            if (event.trigger.type === 'item_pickup' && (event.trigger as { itemType?: string }).itemType === itemType) {
                this.beginStory(event);
                return;
            }
        }
    }

    private triggerHitStop(duration: number): void {
        if (duration <= 0) return;
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }

    private triggerScreenShake(intensity: number, duration: number, frequency: number = 60): void {
        if (duration <= 0) return;
        this.camera.shake(intensity, duration, frequency);
    }

    private triggerScreenShakePreset(preset: ShakePreset): void {
        this.camera.shakePreset(preset);
    }

    /**
     * Trigger a screen flash effect
     * @param color CSS color string
     * @param duration Duration in seconds
     * @param initialAlpha Starting alpha (0-1), defaults to 0.5
     */
    private triggerScreenFlash(color: string, duration: number, initialAlpha: number = 0.5): void {
        this.screenFlash = {
            color,
            alpha: initialAlpha,
            timer: duration,
            duration,
        };
    }

    private updateScreenFlash(dt: number): void {
        if (!this.screenFlash) return;

        this.screenFlash.timer -= dt;
        if (this.screenFlash.timer <= 0) {
            this.screenFlash = null;
            return;
        }

        // Fade out over duration
        const progress = this.screenFlash.timer / this.screenFlash.duration;
        this.screenFlash.alpha = progress * 0.5; // Max alpha of 0.5
    }

    private spawnParticles(
        x: number,
        y: number,
        count: number,
        colors: string[],
        speed: number,
        lifetime: number,
        sizeRange: [number, number],
        gravity: number = 0
    ): void {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = speed * (0.5 + Math.random() * 0.5);
            const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                life: lifetime,
                maxLife: lifetime,
                size,
                color,
                gravity,
            });
        }
    }

    private updateParticles(dt: number): void {
        if (this.particles.length === 0) return;
        for (const p of this.particles) {
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        this.particles = this.particles.filter((p) => p.life > 0);
        // Performance cap: remove oldest particles if too many
        if (this.particles.length > 500) {
            this.particles = this.particles.slice(this.particles.length - 500);
        }
    }

    private renderParticles(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (this.particles.length === 0) return;
        ctx.save();
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.floor(p.x - camX), Math.floor(p.y - camY), p.size, p.size);
        }
        ctx.restore();
    }

    private spawnSwordClash(x: number, y: number, direction: number = 0): void {
        const colors = ['#ffffff', '#ffdd00', '#ffee88'];
        const count = 12;
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            // If direction specified, bias particles in that direction
            if (direction !== 0) {
                const baseAngle = direction > 0 ? 0 : Math.PI;
                angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.8;
            }
            const speed = 150 + Math.random() * 100;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0.3,
                maxLife: 0.3,
                size: 2 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                gravity: 300,
            });
        }
    }

    private spawnBloodBurst(x: number, y: number): void {
        this.spawnParticles(x, y, 8, ['#ff0000', '#aa0000'], 150, 0.5, [3, 8], 500);
    }

    private spawnDeathBurst(x: number, y: number, isBoss: boolean = false): void {
        this.spawnParticles(x, y, isBoss ? 50 : 30, ['#880000', '#440000', '#220000'], isBoss ? 350 : 300, isBoss ? 1.5 : 1.0, [5, isBoss ? 18 : 15], 300);
        // Boss dissolve: slow upward float of ethereal particles
        if (isBoss) {
            for (let i = 0; i < 35; i++) {
                this.particles.push({
                    x: x + (Math.random() - 0.5) * 40,
                    y: y + (Math.random() - 0.5) * 40,
                    vx: (Math.random() - 0.5) * 25,
                    vy: -60 - Math.random() * 40,
                    life: 2.5,
                    maxLife: 2.5,
                    size: 4 + Math.random() * 8,
                    color: Math.random() < 0.5 ? 'rgba(136, 0, 170, 0.7)' : 'rgba(68, 0, 255, 0.5)',
                    gravity: -20,
                });
            }
        }
    }

    // ===== PARTICLE ENHANCEMENT SYSTEM (P3-1.3) =====

    private updateAmbientDust(dt: number, camX: number, camY: number): void {
        this.ambientDustTimer -= dt;
        if (this.ambientDustTimer <= 0) {
            this.ambientDustTimer = 0.4;
            const canvasW = GAME_CONFIG.CANVAS_WIDTH;
            const canvasH = GAME_CONFIG.CANVAS_HEIGHT;
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: camX + Math.random() * canvasW,
                    y: camY + Math.random() * canvasH,
                    vx: (Math.random() - 0.5) * 12,
                    vy: -8 - Math.random() * 6,
                    life: 4.0 + Math.random() * 2.0,
                    maxLife: 6.0,
                    size: 1 + Math.random() * 1.5,
                    color: `rgba(180, 160, 140, ${0.15 + Math.random() * 0.15})`,
                    gravity: -3,
                });
            }
        }
    }

    private updateTorchSparks(dt: number, camX: number, camY: number): void {
        if (this.torches.length === 0) return;
        const canvasW = GAME_CONFIG.CANVAS_WIDTH;
        const canvasH = GAME_CONFIG.CANVAS_HEIGHT;
        // Spawn sparks from a random visible torch
        if (Math.random() < 0.12) {
            const torch = this.torches[Math.floor(Math.random() * this.torches.length)];
            // Cull off-screen torches
            if (torch.x < camX - 100 || torch.x > camX + canvasW + 100 ||
                torch.y < camY - 100 || torch.y > camY + canvasH + 100) return;
            const count = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: torch.x + (Math.random() - 0.5) * 8,
                    y: torch.y,
                    vx: (Math.random() - 0.5) * 25,
                    vy: -35 - Math.random() * 25,
                    life: 0.4 + Math.random() * 0.3,
                    maxLife: 0.7,
                    size: 1 + Math.random(),
                    color: Math.random() < 0.6 ? '#ff8833' : '#ffcc44',
                    gravity: 60,
                });
            }
        }
    }

    private updateCrystalShimmer(dt: number, camX: number, camY: number): void {
        if (this.crystalPositions.length === 0) return;
        const canvasW = GAME_CONFIG.CANVAS_WIDTH;
        const canvasH = GAME_CONFIG.CANVAS_HEIGHT;
        if (Math.random() < 0.1) {
            const crystal = this.crystalPositions[Math.floor(Math.random() * this.crystalPositions.length)];
            const cx = crystal.x + TILE_SIZE / 2;
            const cy = crystal.y + TILE_SIZE / 2;
            // Cull off-screen
            if (cx < camX - 100 || cx > camX + canvasW + 100 ||
                cy < camY - 100 || cy > camY + canvasH + 100) return;
            const count = 2 + Math.floor(Math.random() * 3);
            const colors = ['#8844ff', '#aa66ff', '#cc88ff', '#6622cc'];
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 20;
                this.particles.push({
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist,
                    vx: Math.cos(angle) * 8 + (Math.random() - 0.5) * 5,
                    vy: -12 - Math.random() * 8,
                    life: 0.6 + Math.random() * 0.4,
                    maxLife: 1.0,
                    size: 1.5 + Math.random() * 2,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    gravity: -10,
                });
            }
        }
    }

    private updateFootstepDust(dt: number): void {
        if (!this.player.isGrounded || this.player.state !== 'run') {
            this.footstepDustTimer = 0;
            return;
        }
        this.footstepDustTimer -= dt;
        if (this.footstepDustTimer <= 0) {
            this.footstepDustTimer = 0.18;
            const behindX = this.player.facingRight
                ? this.player.x
                : this.player.x + this.player.width;
            const count = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: behindX + (Math.random() - 0.5) * 10,
                    y: this.player.y + this.player.height - 2,
                    vx: (this.player.facingRight ? -1 : 1) * (15 + Math.random() * 20),
                    vy: -15 - Math.random() * 12,
                    life: 0.25 + Math.random() * 0.1,
                    maxLife: 0.35,
                    size: 2 + Math.random() * 2,
                    color: `rgba(140, 120, 90, ${0.3 + Math.random() * 0.2})`,
                    gravity: 150,
                });
            }
        }
    }

    private spawnLandingImpact(x: number, y: number): void {
        const count = 8 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            // Fan outward from landing point
            const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
            const speed = 60 + Math.random() * 80;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 16,
                y,
                vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1),
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.15,
                maxLife: 0.45,
                size: 2 + Math.random() * 3,
                color: `rgba(150, 130, 100, ${0.4 + Math.random() * 0.2})`,
                gravity: 350,
            });
        }
    }

    private spawnOwlRadiance(x: number, y: number): void {
        // Golden radiant burst
        for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 180;
            const lifetime = 2.0 + Math.random() * 1.5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: lifetime,
                maxLife: lifetime,
                size: 3 + Math.random() * 6,
                color: Math.random() < 0.7 ? '#ffd700' : '#ffea00',
                gravity: -40,
            });
        }
        // White sparkle accents
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 80,
                y: y + (Math.random() - 0.5) * 80,
                vx: (Math.random() - 0.5) * 40,
                vy: -30 - Math.random() * 30,
                life: 2.5 + Math.random() * 1.0,
                maxLife: 3.5,
                size: 1 + Math.random() * 2,
                color: '#ffffff',
                gravity: -15,
            });
        }
    }

    // ===== BOSS BATTLE SYSTEM =====

    private updateBossState(): void {
        // Find active boss (captain or shadow in combat)
        let foundBoss: Guard | null = null;

        for (const guard of this.guards) {
            if (guard.type !== 'captain' && guard.type !== 'shadow') continue;
            if (!guard.isAlive) continue;

            // Check if boss is engaged in combat
            const inCombat = guard.state === 'alert' || guard.state === 'combat_ready' ||
                guard.state === 'attacking' || guard.state === 'blocking' ||
                guard.state === 'stunned' || guard.state === 'retreating';

            if (inCombat) {
                foundBoss = guard;
                break;
            }
        }

        // Update active boss reference
        if (foundBoss && this.activeBoss !== foundBoss) {
            this.activeBoss = foundBoss;
            this.bossHealthBarTimer = 0;
            // Transition to boss music
            if (this.musicState !== 'boss' && this.musicState !== 'victory') {
                this.services?.audio?.playMusic?.('action_intense', 1.0);
                this.musicState = 'boss';
            }
            // Trigger boss alert dialogue
            this.triggerBossStory('boss_alert', foundBoss.type);
        } else if (!foundBoss && this.activeBoss) {
            // Boss left combat or died
            this.bossHealthBarTimer += 0.016; // ~60fps
            if (this.bossHealthBarTimer > 3) {
                // Return to exploration if boss disengaged (not defeated)
                if (this.activeBoss.isAlive && this.musicState === 'boss') {
                    this.services?.audio?.playMusic?.('epic_tension', 2.0);
                    this.musicState = 'exploration';
                }
                this.activeBoss = null;
            }
        }

        if (this.activeBoss) {
            this.bossHealthBarTimer = Math.min(1, this.bossHealthBarTimer + 0.05);
        }
    }

    private updateSlowmo(dt: number): void {
        if (this.slowmoTimer > 0) {
            this.slowmoTimer -= dt;
            if (this.slowmoTimer <= 0) {
                this.timeScale = 1.0;
            }
        }
    }

    private updateBanner(dt: number): void {
        if (this.bannerTimer > 0) {
            this.bannerTimer -= dt;
        }

        if (this.phaseFlashTimer > 0) {
            this.phaseFlashTimer -= dt;
        }
    }

    private onBossDefeat(guard: Guard): void {
        const isShadow = guard.type === 'shadow';
        const isCaptain = guard.type === 'captain';

        if (!isShadow && !isCaptain) return;

        // Epic slowdown
        this.timeScale = 0.25;
        this.slowmoTimer = isShadow ? 2.5 : 1.5;

        // Extended screen shake using presets
        this.triggerScreenShakePreset(isShadow ? 'SHADOW_DEATH' : 'CAPTAIN_DEATH');

        // Screen flash on boss death
        this.triggerScreenFlash(isShadow ? '#4400ff' : '#ff4400', isShadow ? 0.5 : 0.3);

        // Massive particle explosion with boss dissolve effect (P3-1.3 enhanced)
        this.spawnDeathBurst(guard.centerX, guard.y + guard.height * 0.5, true);
        // Extra themed particles on top
        this.spawnParticles(
            guard.centerX,
            guard.y + guard.height * 0.5,
            isShadow ? 40 : 25,
            isShadow ? ['#4400ff', '#8800ff', '#220066'] : ['#ff4400', '#ff6600', '#880000'],
            isShadow ? 350 : 250,
            isShadow ? 1.2 : 0.8,
            [4, 16],
            150
        );

        // Show victory banner
        const bannerText = isShadow ? 'THE SHADOW IS VANQUISHED' : 'THE CAPTAIN FALLS';
        this.showBanner(bannerText, isShadow ? 3.5 : 2.5);

        // Score bonus
        this.score += isShadow ? 2000 : 500;

        // Play victory music
        this.services?.audio?.playMusic?.('epic_heroic', 0.5);
        this.musicState = 'victory';

        // Achievement triggers (via platform service)
        if (isCaptain) {
            this.trackAchievement('captain_defeated', 1);
            // Unlock the door on Level 3
            this.doorLocked = false;
        }
        if (isShadow) {
            this.trackAchievement('shadow_defeated', 1);
        }

        // For Shadow: show secondary banner after delay
        if (isShadow) {
            setTimeout(() => {
                this.showBanner('THE PATH IS OPEN', 2.0);
            }, 2500);
        }

        // Trigger boss defeat dialogue after a short delay
        setTimeout(() => {
            this.triggerBossStory('boss_defeat', guard.type);
        }, isShadow ? 3500 : 2000);
    }

    private onShadowPhaseChange(newPhase: number, guard: Guard): void {
        // Screen flash effect (purple flash for Shadow phase)
        this.phaseFlashTimer = 0.3;
        this.triggerScreenFlash('#8800ff', 0.4, 0.4);

        // Brief slowdown
        this.timeScale = 0.3;
        this.slowmoTimer = 0.5;

        // Screen shake using preset
        this.triggerScreenShakePreset('PHASE_CHANGE');

        // Phase-specific effects
        if (newPhase === 2) {
            this.showBanner('THE FURY AWAKENS', 2.0);
            // Purple particles
            this.spawnParticles(guard.centerX, guard.y + 24, 20, ['#ff4400', '#ff8800', '#ffcc00'], 250, 0.8, [4, 12], 100);
        } else if (newPhase === 3) {
            this.showBanner('DESPERATION', 2.0);
            // Dark particles
            this.spawnParticles(guard.centerX, guard.y + 24, 25, ['#8800ff', '#4400aa', '#220055'], 300, 1.0, [5, 15], 80);
        }

        this.services?.audio?.playSound?.('unlock'); // Use existing sound for now

        // Trigger phase dialogue after banner fades
        setTimeout(() => {
            this.triggerBossStory('boss_phase', 'shadow', newPhase);
        }, 2200);

        // Trigger Kael's defiant response after Shadow's taunt
        setTimeout(() => {
            this.triggerKaelResponse(newPhase);
        }, 5000);
    }

    private showBanner(text: string, duration: number): void {
        this.bannerText = text;
        this.bannerTimer = duration;
        this.bannerDuration = duration;
    }

    private renderBossHealthBar(ctx: CanvasRenderingContext2D): void {
        if (!this.activeBoss) return;

        const boss = this.activeBoss;
        const w = ctx.canvas.width;

        // Fade in animation
        const alpha = Math.min(1, this.bossHealthBarTimer * 2);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Boss name
        const bossName = boss.type === 'shadow' ? 'SHADOW GUARDIAN' : 'THE CAPTAIN';
        ctx.fillStyle = boss.type === 'shadow' ? '#aa88ff' : '#ff6644';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(bossName, w / 2, 85);

        // Health bar background
        const barWidth = 200;
        const barHeight = 12;
        const barX = (w - barWidth) / 2;
        const barY = 92;

        ctx.fillStyle = '#222222';
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

        // Health segments
        const healthPercent = boss.health / boss.maxHealth;
        const filledWidth = Math.floor(barWidth * healthPercent);

        // Color based on health
        let barColor = '#44ff44'; // Green
        if (healthPercent < 0.6) barColor = '#ffcc00'; // Yellow
        if (healthPercent < 0.3) barColor = '#ff4444'; // Red

        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, filledWidth, barHeight);

        // Health segments overlay
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        const segmentWidth = barWidth / boss.maxHealth;
        for (let i = 1; i < boss.maxHealth; i++) {
            const segX = barX + i * segmentWidth;
            ctx.beginPath();
            ctx.moveTo(segX, barY);
            ctx.lineTo(segX, barY + barHeight);
            ctx.stroke();
        }

        // Border
        ctx.strokeStyle = boss.type === 'shadow' ? '#8866cc' : '#aa4422';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

        // HP text
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`${boss.health} / ${boss.maxHealth}`, w / 2, barY + barHeight + 14);

        ctx.restore();
    }

    private renderBanner(ctx: CanvasRenderingContext2D): void {
        if (this.bannerTimer <= 0 || !this.bannerText) return;

        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Fade in/out
        const fadeIn = Math.min(1, (this.bannerDuration - this.bannerTimer) * 4);
        const fadeOut = Math.min(1, this.bannerTimer * 2);
        const alpha = Math.min(fadeIn, fadeOut);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Banner background
        const bannerHeight = 60;
        const bannerY = h / 2 - bannerHeight / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, bannerY, w, bannerHeight);

        // Gold borders
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(0, bannerY, w, 3);
        ctx.fillRect(0, bannerY + bannerHeight - 3, w, 3);

        // Text
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bannerText, w / 2, h / 2);

        ctx.restore();
    }

    private renderPhaseFlash(ctx: CanvasRenderingContext2D): void {
        if (this.phaseFlashTimer <= 0) return;

        const alpha = this.phaseFlashTimer / 0.3;
        ctx.save();
        ctx.fillStyle = `rgba(136, 0, 255, ${alpha * 0.4})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    private renderScreenFlash(ctx: CanvasRenderingContext2D): void {
        if (!this.screenFlash || this.screenFlash.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.screenFlash.alpha;
        ctx.fillStyle = this.screenFlash.color;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    private renderVictoryScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = 'rgba(50, 40, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🦉 GOLDEN OWL FOUND! 🦉', w / 2, 60);

        // Stats
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText(`Final Score: ${this.score}`, w / 2, 100);
        ctx.fillText(`Time: ${Math.floor(this.timeRemaining)}s remaining`, w / 2, 125);

        if (this.enteringName) {
            // Name input mode
            this.renderNameInput(ctx, w, h);
        } else if (this.stateTimer > 2 && this.isHighScore(this.score)) {
            // Prompt to enter name
            ctx.fillStyle = '#ffdd44';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('NEW HIGH SCORE!', w / 2, 170);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText('Press SPACE to enter your name', w / 2, 200);
        } else if (this.stateTimer > 2) {
            // Show leaderboard and restart prompt
            this.renderLeaderboard(ctx, w, h);
            ctx.fillStyle = '#ffdd44';
            ctx.font = '18px Arial';
            ctx.fillText('Press SPACE to play again', w / 2, h - 40);
        }
    }

    private renderGameOverScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        // Background themed to last death cause
        let bgColor: string;
        let titleColor: string;
        let title: string;
        switch (this.lastDeathCause) {
            case 'guard':
                bgColor = 'rgba(50, 8, 8, 0.92)';
                titleColor = '#ff6644';
                title = 'FALLEN IN COMBAT';
                break;
            case 'trap':
                bgColor = 'rgba(45, 25, 5, 0.92)';
                titleColor = '#ffaa33';
                title = 'CLAIMED BY THE CAVERN';
                break;
            case 'pit':
                bgColor = 'rgba(8, 12, 45, 0.92)';
                titleColor = '#6688ff';
                title = 'LOST TO THE ABYSS';
                break;
            default:
                bgColor = 'rgba(30, 10, 10, 0.92)';
                titleColor = '#ff4444';
                title = 'TIME EXPIRED';
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = titleColor;
        ctx.font = 'bold 36px Arial';
        ctx.fillText(title, w / 2, 55);

        // Score + level
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`Score: ${this.score}`, w / 2, 95);
        ctx.fillStyle = '#cccccc';
        ctx.font = '18px Arial';
        ctx.fillText(`Reached Level ${this.currentLevel + 1}: ${this.level?.name ?? ''}`, w / 2, 120);

        // Death statistics
        const statsY = 155;
        ctx.fillStyle = '#ff6666';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('DEATH STATISTICS', w / 2, statsY);

        ctx.font = '16px Arial';
        const totalDeaths = this.deaths;
        const statLines = [
            { label: 'Total Deaths', value: `${totalDeaths}`, color: '#dddddd' },
            { label: 'Slain by Guards', value: `${this.deathsByGuard}`, color: '#ff8866' },
            { label: 'Killed by Traps', value: `${this.deathsByTrap}`, color: '#ffbb55' },
            { label: 'Fell into Pits', value: `${this.deathsByPit}`, color: '#88aaff' },
            { label: 'Time Lost to Deaths', value: `${this.timePenaltyTotal}s`, color: '#ff6666' },
        ];

        for (let i = 0; i < statLines.length; i++) {
            const y = statsY + 25 + i * 22;
            const stat = statLines[i];
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'right';
            ctx.fillText(stat.label + ':', w / 2 + 10, y);
            ctx.fillStyle = stat.color;
            ctx.textAlign = 'left';
            ctx.fillText(stat.value, w / 2 + 20, y);
        }

        // Session stats
        const sessionY = statsY + 25 + statLines.length * 22 + 15;
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SESSION', w / 2, sessionY);
        ctx.font = '15px Arial';
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'right';
        ctx.fillText('Guards Defeated:', w / 2 + 10, sessionY + 22);
        ctx.fillText('Gems Collected:', w / 2 + 10, sessionY + 42);
        ctx.fillStyle = '#cccccc';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.guardsDefeated}`, w / 2 + 20, sessionY + 22);
        ctx.fillText(`${this.gemsCollected}`, w / 2 + 20, sessionY + 42);

        // Name entry / high score / restart prompt
        if (this.enteringName) {
            this.renderNameInput(ctx, w, h);
        } else if (this.stateTimer > 2 && this.isHighScore(this.score) && !this.hasEnteredName) {
            ctx.fillStyle = '#ffdd44';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('NEW HIGH SCORE!', w / 2, h - 65);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.fillText('Press SPACE to enter your name', w / 2, h - 40);
        } else if (this.stateTimer > 2) {
            if (this.leaderboard.length > 0) {
                // Compact leaderboard hint
                ctx.fillStyle = '#888888';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Best: ${this.leaderboard[0].name} - ${this.leaderboard[0].score}`, w / 2, h - 60);
            }
            const promptAlpha = 0.5 + Math.sin(this.stateTimer * 3) * 0.3;
            ctx.globalAlpha = promptAlpha;
            ctx.fillStyle = '#ffdd44';
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Press SPACE to try again', w / 2, h - 35);
            ctx.globalAlpha = 1;
        }
    }

    private renderNameInput(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ENTER YOUR NAME', w / 2, 170);

        // Draw letter boxes
        const boxWidth = 50;
        const boxHeight = 60;
        const startX = w / 2 - (boxWidth * 3 + 20) / 2;
        const boxY = 190;

        for (let i = 0; i < 3; i++) {
            const x = startX + i * (boxWidth + 10);
            const isSelected = i === this.nameInputIndex;

            // Box background
            ctx.fillStyle = isSelected ? '#554400' : '#333333';
            ctx.fillRect(x, boxY, boxWidth, boxHeight);

            // Box border
            ctx.strokeStyle = isSelected ? '#ffd700' : '#666666';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(x, boxY, boxWidth, boxHeight);

            // Letter
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.nameInputChars[i], x + boxWidth / 2, boxY + 45);

            // Selection arrows
            if (isSelected) {
                ctx.fillStyle = '#ffd700';
                ctx.font = '16px Arial';
                ctx.fillText('▲', x + boxWidth / 2, boxY - 5);
                ctx.fillText('▼', x + boxWidth / 2, boxY + boxHeight + 18);
            }
        }

        // Instructions
        ctx.fillStyle = '#888888';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('UP/DOWN to change letter, LEFT/RIGHT to move', w / 2, boxY + boxHeight + 50);
        ctx.fillText('Press SPACE to confirm', w / 2, boxY + boxHeight + 70);
    }

    private renderLeaderboard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (this.leaderboard.length === 0) return;

        const startY = 170;
        const lineHeight = 24;

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEADERBOARD', w / 2, startY);

        // Header
        ctx.fillStyle = '#888888';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('RANK', w / 2 - 140, startY + 25);
        ctx.fillText('NAME', w / 2 - 80, startY + 25);
        ctx.fillText('SCORE', w / 2 + 40, startY + 25);

        // Entries
        const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        ctx.font = '16px Arial';
        for (let i = 0; i < Math.min(this.leaderboard.length, 10); i++) {
            const entry = this.leaderboard[i];
            const y = startY + 50 + i * lineHeight;

            // Highlight current score if it matches
            const isCurrentScore = entry.score === this.score && entry.date > Date.now() - 5000;
            if (isCurrentScore) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
                ctx.fillRect(w / 2 - 150, y - 16, 280, 22);
            }

            // Medal colors for top 3, gold highlight for current, white for rest
            if (isCurrentScore) {
                ctx.fillStyle = '#ffd700';
            } else if (i < 3) {
                ctx.fillStyle = medalColors[i];
            } else {
                ctx.fillStyle = '#ffffff';
            }

            ctx.textAlign = 'left';
            const rankLabel = i < 3 ? ['1st', '2nd', '3rd'][i] : `${i + 1}.`;
            ctx.fillText(rankLabel, w / 2 - 140, y);
            ctx.fillText(entry.name, w / 2 - 80, y);
            ctx.textAlign = 'right';
            ctx.fillText(`${entry.score}`, w / 2 + 120, y);
        }
    }

    private renderAchievementToast(ctx: CanvasRenderingContext2D): void {
        if (!this.achievementToast || this.achievementToast.timer <= 0) return;

        const w = ctx.canvas.width;
        const toastWidth = 280;
        const toastHeight = 60;
        const toastX = (w - toastWidth) / 2;
        const toastY = 120;

        // Fade in/out animation
        const fadeIn = Math.min(1, (3 - this.achievementToast.timer) * 4);
        const fadeOut = Math.min(1, this.achievementToast.timer * 2);
        const alpha = Math.min(fadeIn, fadeOut);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Toast background
        ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
        ctx.fillRect(toastX, toastY, toastWidth, toastHeight);

        // Gold border
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.strokeRect(toastX, toastY, toastWidth, toastHeight);

        // Trophy icon
        ctx.fillStyle = '#ffd700';
        ctx.font = '28px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🏆', toastX + 15, toastY + 40);

        // Achievement unlocked text
        ctx.fillStyle = '#888888';
        ctx.font = '12px Arial';
        ctx.fillText('ACHIEVEMENT UNLOCKED', toastX + 55, toastY + 22);

        // Achievement name
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(this.achievementToast.name, toastX + 55, toastY + 45);

        ctx.restore();
    }

    private updateCamera(dt: number): void {
        if (!this.level) return;

        // Set level bounds for camera clamping
        this.camera.setLevelBounds(
            this.level.width * TILE_SIZE,
            this.level.height * TILE_SIZE
        );

        // Update camera with player as target
        this.camera.update(dt, {
            centerX: this.player.centerX,
            centerY: this.player.centerY,
            facingRight: this.player.facingRight,
            vy: this.player.vy,
            isGrounded: this.player.isGrounded,
        });
    }

    /**
     * Snap camera to player position (used on level start)
     */
    private snapCameraToPlayer(): void {
        if (!this.level) return;

        this.camera.setLevelBounds(
            this.level.width * TILE_SIZE,
            this.level.height * TILE_SIZE
        );

        this.camera.snapTo({
            centerX: this.player.centerX,
            centerY: this.player.centerY,
            facingRight: this.player.facingRight,
            vy: this.player.vy,
            isGrounded: this.player.isGrounded,
        });
    }

    protected onRender(ctx: CanvasRenderingContext2D): void {
        if (this.gameState === 'menu') {
            this.renderMenu(ctx);
            return;
        }
        if (this.gameState === 'level_select') {
            this.renderLevelSelect(ctx);
            return;
        }

        if (!this.level) return;

        // Get camera offset (includes shake)
        const camOffset = this.camera.getOffset();
        const camX = camOffset.x;
        const camY = camOffset.y;

        // Background + parallax
        this.renderBackground(ctx, camX, camY);

        // Render tiles
        this.renderTiles(ctx, camX, camY);

        // Render gates
        this.renderGates(ctx, camX, camY);

        // Render traps
        for (const trap of this.traps) {
            trap.render(ctx, camX, camY);
        }

        // Render collectibles
        for (const c of this.collectibles) {
            c.render(ctx, camX, camY);
        }

        // Render guards
        for (const guard of this.guards) {
            guard.render(ctx, camX, camY);
        }

        // Render player
        this.player.render(ctx, camX, camY);

        // Render particles
        this.renderParticles(ctx, camX, camY);

        // Render score popups (world-space, before lighting)
        for (const popup of this.scorePopups) {
            const alpha = Math.min(1, popup.timer * 2);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = popup.color;
            ctx.font = `bold 16px Arial`;
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 3;
            ctx.strokeText(popup.text, popup.x - camX, popup.y - camY);
            ctx.fillText(popup.text, popup.x - camX, popup.y - camY);
            ctx.restore();
        }

        // Lighting overlay
        this.renderLighting(ctx, camX, camY);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        // Render the level-specific parallax background
        this.parallaxBackground.render(ctx, camX, camY);
    }

    private renderLighting(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        // Use the DynamicLighting system for sophisticated lighting effects
        this.lighting.renderLightingOverlay(ctx, camX, camY);
    }

    private renderTiles(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (!this.level) return;

        const startX = Math.floor(camX / TILE_SIZE);
        const startY = Math.floor(camY / TILE_SIZE);
        const endX = Math.ceil((camX + ctx.canvas.width) / TILE_SIZE);
        const endY = Math.ceil((camY + ctx.canvas.height) / TILE_SIZE);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = getTileAt(this.level, x, y);
                if (tile === 'empty' || tile === 'player' || tile === 'guard') continue;
                if (tile === 'potion_hp' || tile === 'potion_max' || tile === 'gem' || tile === 'time' || tile === 'owl') continue;
                if (tile === 'spikes' || tile === 'chomper' || tile === 'loose') continue;
                if (tile === 'gate') continue;

                const screenX = x * TILE_SIZE - camX;
                const screenY = y * TILE_SIZE - camY;
                const colors = TILE_COLORS[tile];
                const switchTile = tile === 'switch' ? this.getSwitchAt(x, y) : null;
                const switchPressed = switchTile?.pressed ?? false;
                const switchColor = switchTile?.color ?? DEFAULT_GATE_COLOR;

                this.renderTile(ctx, tile, screenX, screenY, colors, switchPressed, switchColor);
            }
        }
    }

    private renderTile(ctx: CanvasRenderingContext2D, tile: TileType, x: number, y: number,
        colors: { primary: string; secondary: string; accent: string }, switchPressed: boolean = false, switchColor: GateColor = DEFAULT_GATE_COLOR): void {
        switch (tile) {
            case 'floor':
            case 'platform':
                ctx.fillStyle = colors.primary;
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = colors.secondary;
                ctx.fillRect(x, y, TILE_SIZE, 4);
                // Stone texture
                ctx.fillStyle = colors.accent;
                ctx.fillRect(x + 8, y + 12, 12, 6);
                ctx.fillRect(x + 28, y + 20, 14, 8);
                break;

            case 'wall':
                ctx.fillStyle = colors.primary;
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                // Brick pattern
                ctx.strokeStyle = colors.accent;
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 2, y + 2, 20, 10);
                ctx.strokeRect(x + 24, y + 2, 20, 10);
                ctx.strokeRect(x + 12, y + 14, 20, 10);
                ctx.strokeRect(x + 2, y + 26, 20, 10);
                ctx.strokeRect(x + 24, y + 26, 20, 10);
                ctx.strokeRect(x + 12, y + 38, 20, 8);
                break;

            case 'torch':
                // Bracket
                ctx.fillStyle = '#443322';
                ctx.fillRect(x + 20, y + 10, 8, 20);
                // Flame (animated)
                const flicker = Math.random() * 4;
                ctx.fillStyle = colors.accent;
                ctx.beginPath();
                ctx.ellipse(x + 24, y + 8 - flicker, 6, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.ellipse(x + 24, y + 10 - flicker, 3, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                const glow = ctx.createRadialGradient(x + 24, y + 10, 0, x + 24, y + 10, 40);
                glow.addColorStop(0, 'rgba(255, 136, 51, 0.3)');
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.fillRect(x - 20, y - 30, 88, 78);
                break;

            case 'door':
                ctx.fillStyle = colors.primary;
                ctx.fillRect(x + 8, y, 32, TILE_SIZE);
                ctx.fillStyle = colors.secondary;
                ctx.fillRect(x + 12, y + 4, 24, 40);
                // Handle
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(x + 30, y + 24, 4, 4);

                // Locked door visual (Level 3 until Captain defeated)
                if (this.doorLocked && this.currentLevel === 2) {
                    // Red iron bars
                    ctx.fillStyle = '#661111';
                    for (let i = 0; i < 4; i++) {
                        ctx.fillRect(x + 14 + i * 6, y + 4, 3, 40);
                    }
                    // Horizontal chains
                    ctx.fillStyle = '#444444';
                    ctx.fillRect(x + 12, y + 14, 24, 3);
                    ctx.fillRect(x + 12, y + 30, 24, 3);
                    // Golden lock symbol
                    ctx.fillStyle = '#ffcc00';
                    ctx.fillRect(x + 20, y + 20, 8, 10);
                    ctx.fillStyle = '#cc9900';
                    ctx.fillRect(x + 22, y + 16, 4, 6);
                    ctx.beginPath();
                    ctx.arc(x + 24, y + 18, 3, Math.PI, 0);
                    ctx.stroke();
                }
                break;

            case 'switch':
                const switchStyle = GATE_STYLE[switchColor];
                if (switchPressed) {
                    ctx.fillStyle = switchStyle.switchPressedBase;
                    ctx.fillRect(x + 10, y + TILE_SIZE - 5, 28, 5);
                    ctx.fillStyle = switchStyle.switchPressedAccent;
                    ctx.fillRect(x + 16, y + TILE_SIZE - 4, 16, 3);
                } else {
                    ctx.fillStyle = switchStyle.switchBase;
                    ctx.fillRect(x + 12, y + TILE_SIZE - 8, 24, 8);
                    ctx.fillStyle = switchStyle.switchAccent;
                    ctx.fillRect(x + 18, y + TILE_SIZE - 6, 12, 4);
                }
                break;

            case 'ledge':
            case 'pillar':
                ctx.fillStyle = colors.primary;
                ctx.fillRect(x + 16, y, 16, TILE_SIZE);
                ctx.fillStyle = colors.secondary;
                ctx.fillRect(x + 18, y, 12, TILE_SIZE);
                break;

            case 'skeleton':
                // Skull
                ctx.fillStyle = '#cccccc';
                ctx.beginPath();
                ctx.arc(x + 16, y + 36, 8, 0, Math.PI * 2);
                ctx.fill();
                // Eye sockets
                ctx.fillStyle = '#222222';
                ctx.beginPath();
                ctx.arc(x + 13, y + 34, 2, 0, Math.PI * 2);
                ctx.arc(x + 19, y + 34, 2, 0, Math.PI * 2);
                ctx.fill();
                // Jaw
                ctx.fillStyle = '#aaaaaa';
                ctx.fillRect(x + 11, y + 40, 10, 4);
                // Ribcage/bones scattered
                ctx.fillStyle = '#bbbbbb';
                ctx.fillRect(x + 26, y + 38, 14, 3);
                ctx.fillRect(x + 28, y + 42, 10, 2);
                ctx.fillRect(x + 8, y + 44, 8, 2);
                // Arm bone
                ctx.fillRect(x + 30, y + 32, 12, 3);
                break;

            case 'inscription':
                // Carved stone tablet on wall
                ctx.fillStyle = '#445566';
                ctx.fillRect(x + 8, y + 8, 32, 32);
                ctx.fillStyle = '#334455';
                ctx.fillRect(x + 10, y + 10, 28, 28);
                // Carved text lines (stylized)
                ctx.fillStyle = '#5577aa';
                ctx.fillRect(x + 14, y + 16, 20, 2);
                ctx.fillRect(x + 14, y + 22, 16, 2);
                ctx.fillRect(x + 14, y + 28, 18, 2);
                // Glow when near
                const inscriptionGlow = ctx.createRadialGradient(x + 24, y + 24, 0, x + 24, y + 24, 30);
                inscriptionGlow.addColorStop(0, 'rgba(100, 136, 170, 0.2)');
                inscriptionGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = inscriptionGlow;
                ctx.fillRect(x - 6, y - 6, 60, 60);
                break;

            case 'spectral_crystal':
                // Glowing purple crystal
                const crystalPulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
                // Glow aura
                const crystalGlow = ctx.createRadialGradient(x + 24, y + 24, 0, x + 24, y + 24, 35);
                crystalGlow.addColorStop(0, `rgba(136, 68, 255, ${crystalPulse * 0.5})`);
                crystalGlow.addColorStop(0.5, `rgba(136, 68, 255, ${crystalPulse * 0.2})`);
                crystalGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = crystalGlow;
                ctx.fillRect(x - 11, y - 11, 70, 70);
                // Crystal body
                ctx.fillStyle = `rgba(136, 68, 255, ${crystalPulse})`;
                ctx.beginPath();
                ctx.moveTo(x + 24, y + 6);
                ctx.lineTo(x + 34, y + 20);
                ctx.lineTo(x + 30, y + 42);
                ctx.lineTo(x + 18, y + 42);
                ctx.lineTo(x + 14, y + 20);
                ctx.closePath();
                ctx.fill();
                // Inner highlight
                ctx.fillStyle = `rgba(170, 102, 255, ${crystalPulse})`;
                ctx.beginPath();
                ctx.moveTo(x + 24, y + 12);
                ctx.lineTo(x + 30, y + 22);
                ctx.lineTo(x + 24, y + 34);
                ctx.lineTo(x + 18, y + 22);
                ctx.closePath();
                ctx.fill();
                break;

            case 'journal':
                // Old leather-bound book
                const journalBob = Math.sin(Date.now() * 0.002) * 2;
                // Book cover
                ctx.fillStyle = '#6b4423';
                ctx.fillRect(x + 12, y + 26 + journalBob, 24, 18);
                // Pages
                ctx.fillStyle = '#d4c4a8';
                ctx.fillRect(x + 14, y + 28 + journalBob, 20, 14);
                // Spine
                ctx.fillStyle = '#4a2f15';
                ctx.fillRect(x + 12, y + 26 + journalBob, 3, 18);
                // Text lines on page
                ctx.fillStyle = '#8b7355';
                ctx.fillRect(x + 18, y + 31 + journalBob, 12, 1);
                ctx.fillRect(x + 18, y + 34 + journalBob, 10, 1);
                ctx.fillRect(x + 18, y + 37 + journalBob, 11, 1);
                // Glow
                const journalGlow = ctx.createRadialGradient(x + 24, y + 35, 0, x + 24, y + 35, 25);
                journalGlow.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
                journalGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = journalGlow;
                ctx.fillRect(x - 1, y + 10, 50, 40);
                break;

            case 'fallen_seeker':
                // Injured person lying on ground
                const breathe = Math.sin(Date.now() * 0.002) * 1;
                // Body (lying down)
                ctx.fillStyle = '#665544';
                ctx.fillRect(x + 8, y + 34, 32, 10);
                // Torso
                ctx.fillStyle = '#554433';
                ctx.fillRect(x + 16, y + 32 + breathe, 16, 12);
                // Head
                ctx.fillStyle = '#aa8866';
                ctx.beginPath();
                ctx.arc(x + 12, y + 36, 6, 0, Math.PI * 2);
                ctx.fill();
                // Hair
                ctx.fillStyle = '#443322';
                ctx.beginPath();
                ctx.arc(x + 12, y + 34, 5, Math.PI, 0);
                ctx.fill();
                // Arm reaching out
                ctx.fillStyle = '#aa8866';
                ctx.fillRect(x + 32, y + 36, 10, 4);
                // Crushed leg/rubble
                ctx.fillStyle = '#555555';
                ctx.fillRect(x + 24, y + 40, 16, 8);
                ctx.fillStyle = '#444444';
                ctx.fillRect(x + 28, y + 38, 8, 6);
                break;
        }
    }

    private renderGates(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        for (const gate of this.gates) {
            const screenX = gate.x - camX;
            const screenY = gate.y - camY;
            const barHeight = Math.max(0, Math.round((1 - gate.openProgress) * TILE_SIZE));
            const gateStyle = GATE_STYLE[gate.color];

            // Frame
            ctx.fillStyle = gateStyle.frame;
            ctx.fillRect(screenX, screenY, 4, TILE_SIZE);
            ctx.fillRect(screenX + TILE_SIZE - 4, screenY, 4, TILE_SIZE);

            if (barHeight > 0) {
                const barY = screenY + TILE_SIZE - barHeight;
                ctx.fillStyle = gateStyle.bars;
                ctx.fillRect(screenX, barY, TILE_SIZE, barHeight);
                ctx.fillStyle = gateStyle.barsDark;
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(screenX + 4 + i * 9, barY, 4, barHeight);
                }
            }
        }
    }

    protected onRenderUI(ctx: CanvasRenderingContext2D): void {
        if (this.gameState === 'menu' || this.gameState === 'level_select') return;

        // Screen flash overlay (rendered first, behind UI)
        this.renderScreenFlash(ctx);

        // Phase flash overlay (boss phase changes - purple tint)
        this.renderPhaseFlash(ctx);

        // Death interstitial overlay (skips HUD when active)
        if (this.deathInterstitial?.active) {
            this.renderDeathInterstitial(ctx);
            // Still render state overlay (for story if triggered) and banner/toast
            this.renderStateOverlay(ctx);
            this.renderBanner(ctx);
            this.renderAchievementToast(ctx);
            return;
        }

        // Health (with pulse on damage)
        ctx.save();
        if (this.healthPulseTimer > 0) {
            const pulseScale = 1 + Math.sin(this.healthPulseTimer / 0.3 * Math.PI) * 0.15;
            ctx.translate(20, 20);
            ctx.scale(pulseScale, pulseScale);
            ctx.translate(-20, -20);
        }
        for (let i = 0; i < this.player.maxHealth; i++) {
            const filled = i < this.player.health;
            ctx.fillStyle = filled ? (this.healthPulseTimer > 0 ? '#ff6666' : '#ff4444') : '#333333';
            ctx.fillRect(20 + i * 24, 20, 20, 20);
            if (filled) {
                ctx.fillStyle = '#ff8888';
                ctx.fillRect(22 + i * 24, 22, 8, 8);
            }
        }
        ctx.restore();

        // Timer (with flash when < 30s)
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        if (this.timeRemaining < 30) {
            const pulse = Math.sin(this.gameTime * 6) * 0.3 + 0.7;
            const fontSize = 28 + Math.sin(this.gameTime * 6) * 2;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ff4444';
            ctx.font = `bold ${Math.round(fontSize)}px Arial`;
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px Arial';
        }
        ctx.textAlign = 'center';
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, ctx.canvas.width / 2, 35);
        ctx.globalAlpha = 1;

        // Level name
        if (this.level) {
            ctx.fillStyle = '#888888';
            ctx.font = '16px Arial';
            ctx.fillText(`Level ${this.currentLevel + 1}: ${this.level.name}`, ctx.canvas.width / 2, 55);
        }

        // Score
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${this.score}`, ctx.canvas.width - 20, 35);

        // Gems (with bounce on pickup)
        ctx.save();
        if (this.gemBounceTimer > 0) {
            const bounceScale = 1 + Math.sin((0.3 - this.gemBounceTimer) / 0.3 * Math.PI) * 0.25;
            const gemX = ctx.canvas.width - 20;
            ctx.translate(gemX, 55);
            ctx.scale(bounceScale, bounceScale);
            ctx.translate(-gemX, -55);
        }
        ctx.fillStyle = '#4488ff';
        ctx.font = '16px Arial';
        ctx.fillText(`💎 ${this.gemsCollected}`, ctx.canvas.width - 20, 55);
        ctx.restore();

        // Boss health bar
        this.renderBossHealthBar(ctx);

        // DEBUG: Player state info
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        const p = this.player;
        ctx.fillText(`State: ${p?.state ?? 'N/A'} | animT: ${(p as any)?.animTimer?.toFixed(2) ?? '?'}`, 20, ctx.canvas.height - 80);
        ctx.fillText(`Grounded: ${p?.isGrounded ?? 'N/A'}`, 20, ctx.canvas.height - 65);
        ctx.fillText(`Vel: ${typeof p?.vx === 'number' ? p.vx.toFixed(0) : 'undef'}, ${typeof p?.vy === 'number' ? p.vy.toFixed(0) : 'undef'}`, 20, ctx.canvas.height - 50);
        ctx.fillText(`Pos: ${typeof p?.x === 'number' ? p.x.toFixed(0) : '?'}, ${typeof p?.y === 'number' ? p.y.toFixed(0) : '?'}`, 20, ctx.canvas.height - 35);

        // Sword indicator
        if (this.player.hasSword) {
            ctx.fillStyle = '#aaaacc';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('⚔ COMBAT MODE', 150, ctx.canvas.height - 20);
        }

        // State overlays
        this.renderStateOverlay(ctx);

        // Boss victory banner (on top of everything)
        this.renderBanner(ctx);

        // Achievement toast
        this.renderAchievementToast(ctx);
    }

    private renderStateOverlay(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        switch (this.gameState) {
            case 'level_intro':
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#ffdd44';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Level ${this.currentLevel + 1}`, w / 2, h / 2 - 20);
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.fillText(this.level?.name || '', w / 2, h / 2 + 20);
                break;

            case 'level_complete':
                this.renderScoreBreakdown(ctx, w, h);
                break;

            case 'victory':
                this.renderVictoryScreen(ctx, w, h);
                break;

            case 'game_over':
                this.renderGameOverScreen(ctx, w, h);
                break;
            case 'story':
                this.renderStoryOverlay(ctx);
                break;

            case 'paused':
                this.renderPauseMenu(ctx, w, h);
                break;
        }
    }

    private renderPauseMenu(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', w / 2, h / 2 - 80);

        // Menu options
        const options = ['Resume', 'Restart Level', 'Quit to Menu'];
        const menuY = h / 2 - 20;
        for (let i = 0; i < options.length; i++) {
            const y = menuY + i * 40;
            const selected = i === this.pauseMenuIndex;
            ctx.fillStyle = selected ? '#ffd700' : '#888888';
            ctx.font = selected ? 'bold 24px Arial' : '22px Arial';
            ctx.fillText(options[i], w / 2, y);

            if (selected) {
                // Arrow indicator
                ctx.fillText('▸', w / 2 - 100, y);
            }
        }

        // Controls hint
        ctx.fillStyle = '#555555';
        ctx.font = '14px Arial';
        ctx.fillText('↑↓ Navigate  •  SPACE Select  •  ESC Resume', w / 2, h / 2 + 120);
    }

    private renderScoreBreakdown(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = 'rgba(0, 30, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        if (!this.scoreBreakdown) {
            // Fallback
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL COMPLETE!', w / 2, h / 2);
            return;
        }

        const bd = this.scoreBreakdown;
        const startY = h / 2 - bd.lines.length * 16 - 30;

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${this.currentLevel + 1} Complete!`, w / 2, startY - 20);

        // Score lines
        const lineHeight = 30;
        for (let i = 0; i < bd.lines.length; i++) {
            const y = startY + 30 + i * lineHeight;
            const line = bd.lines[i];

            if (i > bd.lineIndex) continue; // Not yet revealed
            if (i === bd.lineIndex && bd.phase === 'counting') {
                // Currently counting - animated
                ctx.fillStyle = '#ffffff';
            } else {
                ctx.fillStyle = '#cccccc';
            }

            ctx.font = '18px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(line.label, w / 2 - 180, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(`+${line.displayValue}`, w / 2 + 180, y);
        }

        // Separator + totals (only when counting is done)
        const totalsY = startY + 30 + bd.lines.length * lineHeight + 10;
        if (bd.phase === 'waiting') {
            // Separator line
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(w / 2 - 180, totalsY - 5);
            ctx.lineTo(w / 2 + 180, totalsY - 5);
            ctx.stroke();

            // Level total
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('Level Bonus', w / 2 - 180, totalsY + 15);
            ctx.textAlign = 'right';
            ctx.fillText(`+${bd.levelTotal}`, w / 2 + 180, totalsY + 15);

            // Running total
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('Total Score', w / 2 - 180, totalsY + 48);
            ctx.textAlign = 'right';
            ctx.fillText(`${bd.runningTotal}`, w / 2 + 180, totalsY + 48);

            // Continue prompt (flashing)
            const flash = Math.sin(this.stateTimer * 4) * 0.3 + 0.7;
            ctx.globalAlpha = flash;
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Press SPACE to continue', w / 2, totalsY + 90);
            ctx.globalAlpha = 1;
        }
    }

    private renderStoryOverlay(ctx: CanvasRenderingContext2D): void {
        const story = this.activeStory;
        if (!story) return;

        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const panelHeight = Math.min(220, Math.floor(h * 0.35));
        const panelY = h - panelHeight - 20;
        const panelX = 30;
        const panelW = w - 60;

        ctx.save();
        ctx.fillStyle = 'rgba(5, 8, 12, 0.8)';
        ctx.fillRect(panelX, panelY, panelW, panelHeight);
        ctx.strokeStyle = 'rgba(255, 221, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelHeight);

        let textY = panelY + 32;
        if (story.title) {
            ctx.fillStyle = '#ffdd44';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(story.title, panelX + 20, textY);
            textY += 26;
        }

        ctx.fillStyle = '#e5e7eb';
        ctx.font = '16px Arial';
        const visibleText = story.text.substring(0, Math.floor(this.storyCharIndex));
        const lines = this.wrapText(ctx, visibleText, panelW - 40);
        lines.forEach((line) => {
            ctx.fillText(line, panelX + 20, textY);
            textY += 20;
        });

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        const prompt = this.storyFullyRevealed ? 'Press SPACE to continue' : 'Press SPACE to skip...';
        ctx.fillText(prompt, panelX + panelW - 20, panelY + panelHeight - 16);

        ctx.restore();
    }

    private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const lines: string[] = [];
        const paragraphs = text.split('\n');
        paragraphs.forEach((paragraph, index) => {
            const words = paragraph.split(' ');
            let line = '';
            words.forEach((word) => {
                const testLine = line ? `${line} ${word}` : word;
                if (ctx.measureText(testLine).width > maxWidth && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = testLine;
                }
            });
            if (line) lines.push(line);
            if (index < paragraphs.length - 1) lines.push('');
        });
        return lines;
    }

    private renderLevelSelect(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#0a0a15');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL SELECT', w / 2, 60);

        // Level cards
        const cardH = 52;
        const cardW = 400;
        const startY = 100;
        for (let i = 0; i < ALL_LEVELS.length; i++) {
            const y = startY + i * (cardH + 10);
            const selected = i === this.levelSelectIndex;
            const unlocked = i < this.unlockedLevels;

            // Card background
            if (selected) {
                ctx.fillStyle = unlocked ? 'rgba(255, 215, 0, 0.15)' : 'rgba(100, 100, 100, 0.15)';
            } else {
                ctx.fillStyle = 'rgba(30, 30, 50, 0.6)';
            }
            ctx.fillRect((w - cardW) / 2, y, cardW, cardH);

            // Card border
            ctx.strokeStyle = selected ? '#ffd700' : (unlocked ? '#444466' : '#333333');
            ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect((w - cardW) / 2, y, cardW, cardH);

            const textX = (w - cardW) / 2 + 16;

            if (unlocked) {
                // Level number and name
                ctx.fillStyle = selected ? '#ffd700' : '#ffffff';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(`Level ${i + 1}: ${ALL_LEVELS[i].name}`, textX, y + 22);

                // Best score and time
                ctx.fillStyle = '#888888';
                ctx.font = '14px Arial';
                if (this.levelBestScores[i] > 0) {
                    ctx.fillText(`Best: ${this.levelBestScores[i]}pts  |  ${Math.floor(this.levelBestTimes[i])}s remaining`, textX, y + 42);
                } else {
                    ctx.fillText('Not yet completed', textX, y + 42);
                }
            } else {
                // Locked
                ctx.fillStyle = '#555555';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(`Level ${i + 1}: ???`, textX, y + 22);
                ctx.font = '14px Arial';
                ctx.fillText('🔒 Complete previous level to unlock', textX, y + 42);
            }

            // Selection arrow
            if (selected) {
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'right';
                ctx.fillText('▸', (w - cardW) / 2 - 8, y + 30);
            }
        }

        // Controls hint
        ctx.fillStyle = '#555555';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('↑↓ Navigate  •  SPACE Play  •  ESC Back', w / 2, h - 30);
    }

    private renderMenu(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#0a0a15');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 44px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CRYSTAL CAVERNS', w / 2, 100);

        // Subtitle
        ctx.fillStyle = '#888888';
        ctx.font = '18px Arial';
        ctx.fillText('Quest for the Golden Owl', w / 2, 130);

        // Golden Owl decoration
        ctx.fillStyle = '#ffd700';
        ctx.font = '64px Arial';
        ctx.fillText('🦉', w / 2, 220);

        // Menu options
        const options = ['New Game', 'Level Select'];
        for (let i = 0; i < options.length; i++) {
            const y = 290 + i * 38;
            const selected = i === this.menuIndex;
            ctx.fillStyle = selected ? '#ffd700' : '#888888';
            ctx.font = selected ? 'bold 22px Arial' : '20px Arial';
            ctx.fillText(options[i], w / 2, y);
            if (selected) {
                ctx.fillText('▸', w / 2 - 90, y);
            }
        }

        // Controls
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText('Left/Right Move  |  Up Jump  |  Down Drop  |  Shift Fight  |  Ctrl Block/Dash', w / 2, h - 60);
        ctx.fillText('Navigate 5 levels. Avoid traps. Defeat guards. Find the Owl!', w / 2, h - 35);
    }

    protected onGameEnd(finalScore: GameScore): void {
        this.extendedGameData = {
            levels_completed: this.currentLevel,
            gems_collected: this.gemsCollected,
            guards_defeated: this.guardsDefeated,
            deaths: this.deaths,
            found_owl: this.foundOwl,
            time_remaining: Math.floor(this.timeRemaining),
        };
    }

    protected onRestart(): void {
        this.score = 0;
        this.timeRemaining = 180;
        this.gemsCollected = 0;
        this.guardsDefeated = 0;
        this.deaths = 0;
        this.pendingDeathRecord = null;
        this.lastDeathCause = 'time';
        this.deathsByGuard = 0;
        this.deathsByTrap = 0;
        this.deathsByPit = 0;
        this.timePenaltyTotal = 0;
        this.deathInterstitial = null;
        this.foundOwl = false;
        this.particles = [];
        this.scorePopups = [];
        this.scoreBreakdown = null;
        this.healthPulseTimer = 0;
        this.gemBounceTimer = 0;
        this.hitStopTimer = 0;
        this.camera.reset();
        this.screenFlash = null;
        this.footstepTimer = 0;
        this.activeBoss = null;
        this.bossHealthBarTimer = 0;
        this.bannerText = '';
        this.bannerTimer = 0;
        this.bannerDuration = 0;
        this.timeScale = 1.0;
        this.slowmoTimer = 0;
        this.phaseFlashTimer = 0;
        // Reset pause menu state
        this.pauseMenuIndex = 0;
        this.escKeyWasPressed = false;
        this.pauseUpWasPressed = false;
        this.pauseDownWasPressed = false;
        // Reset menu/level select state
        this.menuIndex = 0;
        this.menuUpWasPressed = false;
        this.menuDownWasPressed = false;
        this.levelSelectIndex = 0;
        this.levelSelectUpWasPressed = false;
        this.levelSelectDownWasPressed = false;
        this.menuActionWasPressed = false;
        // Reset name entry state
        this.enteringName = false;
        this.hasEnteredName = false;
        this.nameInputIndex = 0;
        this.nameInputChars = ['A', 'A', 'A'];
        // Reset game start time for speedrunner achievement
        this.gameStartTime = Date.now();
        // Reset music state
        this.musicState = 'none';
        this.loadLevel(0);
        this.gameState = 'level_intro';
        this.stateTimer = 0;
    }
}
