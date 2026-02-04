// ===== src/games/platform-adventure/PlatformGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import { TILE_SIZE, TileType, TILE_COLORS } from './data/TileTypes';
import { Player } from './entities/Player';
import { Guard, GuardSense, GuardType } from './entities/Guard';
import { Collectible } from './entities/Collectible';
import { Trap } from './entities/Trap';
import { ALL_LEVELS, LevelDefinition, getTileAt, findPlayerSpawn, findDoorPosition } from './levels/LevelData';
import { STORY_BY_LEVEL, GLOBAL_STORY_EVENTS, StoryEvent } from './levels/StoryData';

type GameState = 'menu' | 'playing' | 'level_intro' | 'story' | 'level_complete' | 'victory' | 'game_over';

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
    private camX: number = 0;
    private camY: number = 0;

    // Combat feel
    private hitStopTimer: number = 0;
    private shakeTimer: number = 0;
    private shakeDuration: number = 0;
    private shakeIntensity: number = 0;
    private shakeOffsetX: number = 0;
    private shakeOffsetY: number = 0;
    private particles: Particle[] = [];
    private footstepTimer: number = 0;

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

    protected renderBaseHud: boolean = false;

    protected onInit(): void {
        this.player = new Player(100, 200);
        this.loadPersistentStats();
        this.loadLeaderboard();
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
        const guardSpawns: Array<{ x: number; y: number }> = [];
        let owlPosition: { x: number; y: number } | null = null;
        let gemCount = 0;
        this.particles = [];
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
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
        this.swordEverDrawn = false;
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
                        break;
                    case 'torch':
                        this.torches.push({ x: px + TILE_SIZE / 2, y: py + 12, flicker: Math.random() * Math.PI * 2 });
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
                }
            }
        }

        this.linkSwitchesToGates();

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

        // Reset camera
        this.updateCamera();
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
        switch (this.gameState) {
            case 'menu':
                this.updateMenu(dt);
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
            case 'victory':
            case 'game_over':
                this.updateEndScreen(dt);
                break;
        }
    }

    private updateMenu(dt: number): void {
        const input = this.services?.input;
        if (input?.isActionPressed?.()) {
            this.gameState = 'level_intro';
            this.stateTimer = 0;
            this.services?.audio?.playSound?.('powerup');
        }
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

        // Update screen shake + hit stop
        this.updateScreenShake(safeDt);
        if (this.hitStopTimer > 0) {
            this.hitStopTimer = Math.max(0, this.hitStopTimer - safeDt);
            return;
        }

        // Update timer
        this.timeRemaining -= safeDt;
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
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

        // Handle sword toggle (edge triggered)
        if (shiftKey && !this.swordKeyWasPressed) {
            this.player.toggleSword();
            if (this.player.hasSword) {
                this.swordEverDrawn = true;
            }
            this.services?.audio?.playSound?.(this.player.hasSword ? 'sword_draw' : 'sword_sheathe');
        }
        this.swordKeyWasPressed = shiftKey;

        // Handle combat
        if (this.player.hasSword) {
            if (action) {
                if (this.player.tryAttack()) {
                    this.services?.audio?.playSound?.('sword_swing');
                }
            } else if (ctrlKey) {
                this.player.tryBlock();
            }
        }

        // Handle movement - direct calls like TapDodge!
        if (left) {
            this.player.moveLeft();
        } else if (right) {
            this.player.moveRight();
        } else {
            this.player.stopMoving();
        }

        const wasGrounded = this.player.isGrounded;

        // Handle jump
        if (up) {
            if (this.player.jump()) {
                this.services?.audio?.playSound?.('jump');
            }
        }

        // Update player physics
        this.player.update(safeDt * this.timeScale);

        // Collision detection
        this.handlePlayerCollision();

        if (!wasGrounded && this.player.isGrounded) {
            this.services?.audio?.playSound?.('land');
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

        // Update particles
        this.updateParticles(safeDt * this.timeScale);

        // Update achievement toast timer
        if (this.achievementToast && this.achievementToast.timer > 0) {
            this.achievementToast.timer -= safeDt;
        }

        // Check death
        if (this.player.state === 'dead') {
            this.deaths++;
            this.timeRemaining -= 10;
            // On Level 5 during Shadow fight, show defeat taunt
            if (this.currentLevel === 4 && this.activeBoss?.type === 'shadow') {
                this.triggerEndingStory('defeat');
            }
            setTimeout(() => this.player.respawn(), 1000);
        }

        // Update camera
        this.updateCamera();
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
                this.player.die();
                this.services?.audio?.playSound?.('death_cry');
            }
        }
    }

    private checkCombat(): void {
        // Player attacks guard
        if (this.player.attackHitbox) {
            const ph = this.player.attackHitbox;
            for (const guard of this.guards) {
                if (!guard.isAlive) continue;

                if (ph.x < guard.right && ph.x + ph.w > guard.left &&
                    ph.y < guard.bottom && ph.y + ph.h > guard.top) {
                    if (guard.isBlocking) {
                        // Blocked!
                        this.services?.audio?.playSound?.('sword_clash');
                        this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5);
                        this.triggerHitStop(0.02);
                        this.triggerScreenShake(3, 0.08);
                    } else {
                        guard.takeDamage();
                        this.services?.audio?.playSound?.('hit');
                        this.services?.audio?.playSound?.('hurt_grunt');
                        this.spawnBloodBurst(guard.centerX, guard.y + guard.height * 0.5);
                        this.triggerHitStop(0.03);
                        this.triggerScreenShake(6, 0.12);
                        if (!guard.isAlive) {
                            this.guardsDefeated++;
                            this.score += SCORING.GUARD_KILL;
                            this.services?.audio?.playSound?.('death_cry');
                            this.spawnDeathBurst(guard.centerX, guard.y + guard.height * 0.5);
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
                if (this.player.isBlocking && !guard.attackIgnoresBlock) {
                    this.services?.audio?.playSound?.('sword_clash');
                    guard.onAttackBlocked();
                    this.spawnSwordClash(this.player.centerX, this.player.centerY);
                    this.triggerHitStop(0.02);
                    this.triggerScreenShake(3, 0.08);
                    // Track perfect block and award points
                    this.levelPerfectBlocks++;
                    this.totalBlocksEver++;
                    this.score += SCORING.PERFECT_BLOCK;
                } else {
                    const died = this.player.takeDamage(guard.attackDamage, guard.attackIgnoresBlock);
                    this.services?.audio?.playSound?.('hit');
                    this.services?.audio?.playSound?.(died ? 'death_cry' : 'hurt_grunt');
                    this.spawnBloodBurst(this.player.centerX, this.player.centerY);
                    this.triggerHitStop(0.03 * guard.attackDamage);
                    this.triggerScreenShake(7, 0.14);
                    // Track damage taken
                    this.levelDamagesTaken++;
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
                this.triggerHitStop(0.04);
                this.triggerScreenShake(10, 0.18);
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
                        break;
                    case 'time':
                        this.timeRemaining = Math.min(this.MAX_TIME, this.timeRemaining + 15);
                        this.score += 25;
                        this.services?.audio?.playSound?.('coin');
                        break;
                    case 'owl':
                        this.foundOwl = true;
                        // Calculate final level bonus
                        const finalBonus = this.calculateLevelBonus();
                        this.score += finalBonus;
                        this.score += 1000; // Owl bonus
                        // Check all achievements
                        this.checkAchievements();
                        this.checkVictoryAchievements();
                        this.stateTimer = 0;
                        this.services?.audio?.playSound?.('success');
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
                // Calculate and award level bonus
                const bonus = this.calculateLevelBonus();
                this.score += bonus;

                // Check achievements before transitioning
                this.checkAchievements();

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
        if (this.stateTimer > 2) {
            this.loadLevel(this.currentLevel + 1);
            this.gameState = 'level_intro';
            this.stateTimer = 0;
        }
    }

    private updateEndScreen(dt: number): void {
        this.stateTimer += dt;
        const input = this.services?.input;

        // Update achievement toast even on end screens
        if (this.achievementToast && this.achievementToast.timer > 0) {
            this.achievementToast.timer -= dt;
        }

        if (this.gameState === 'victory' && this.enteringName) {
            // Handle name input
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
            if (this.gameState === 'victory' && this.isHighScore(this.score) && !this.enteringName && !this.hasEnteredName) {
                // Enter name input mode
                this.enteringName = true;
                this.nameInputIndex = 0;
                this.nameInputChars = ['A', 'A', 'A'];
                this.hasEnteredName = true;
                this.services?.audio?.playSound?.('coin');
            } else {
                this.onRestart();
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
    }

    private updateStory(dt: number): void {
        this.stateTimer += dt;
        const input = this.services?.input;
        if (this.stateTimer > 0.2 && input?.isActionPressed?.()) {
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
                }
            }
        }
    }

    private checkStoryTriggers(): void {
        if (!this.level || this.activeStory) return;

        for (const event of this.levelStory) {
            if (this.storySeen.has(event.id)) continue;
            if (event.trigger.type !== 'position') continue;

            const radius = event.trigger.radius ?? 1.5;
            const targetX = event.trigger.x * TILE_SIZE + TILE_SIZE * 0.5;
            const targetY = event.trigger.y * TILE_SIZE + TILE_SIZE * 0.5;
            const dx = this.player.centerX - targetX;
            const dy = this.player.centerY - targetY;
            const distSq = dx * dx + dy * dy;
            if (distSq <= (radius * TILE_SIZE) * (radius * TILE_SIZE)) {
                this.beginStory(event);
                break;
            }
        }
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

    private triggerHitStop(duration: number): void {
        if (duration <= 0) return;
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }

    private triggerScreenShake(intensity: number, duration: number): void {
        if (duration <= 0) return;
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
        this.shakeTimer = Math.max(this.shakeTimer, duration);
    }

    private updateScreenShake(dt: number): void {
        if (this.shakeTimer <= 0) {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            return;
        }

        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        const progress = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
        const shake = progress * progress;
        this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * shake;
        this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * shake;
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

    private spawnSwordClash(x: number, y: number): void {
        this.spawnParticles(x, y, 12, ['#ffffff', '#ffdd00'], 200, 0.3, [2, 6]);
    }

    private spawnBloodBurst(x: number, y: number): void {
        this.spawnParticles(x, y, 8, ['#ff0000', '#aa0000'], 150, 0.5, [3, 8], 500);
    }

    private spawnDeathBurst(x: number, y: number): void {
        this.spawnParticles(x, y, 30, ['#880000', '#440000', '#220000'], 300, 1.0, [5, 15], 300);
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

        // Extended screen shake
        this.triggerScreenShake(isShadow ? 20 : 12, isShadow ? 2.0 : 1.0);

        // Massive particle explosion
        this.spawnParticles(
            guard.centerX,
            guard.y + guard.height * 0.5,
            isShadow ? 60 : 40,
            isShadow ? ['#4400ff', '#8800ff', '#220066', '#000033'] : ['#880000', '#660000', '#440000'],
            isShadow ? 400 : 300,
            isShadow ? 1.5 : 1.0,
            [6, 20],
            200
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
        // Screen flash effect
        this.phaseFlashTimer = 0.3;

        // Brief slowdown
        this.timeScale = 0.3;
        this.slowmoTimer = 0.5;

        // Screen shake
        this.triggerScreenShake(10, 0.4);

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
        ctx.font = '16px Arial';
        for (let i = 0; i < Math.min(this.leaderboard.length, 10); i++) {
            const entry = this.leaderboard[i];
            const y = startY + 50 + i * lineHeight;

            // Highlight current score if it matches
            const isCurrentScore = entry.score === this.score && entry.date > Date.now() - 5000;
            ctx.fillStyle = isCurrentScore ? '#ffd700' : '#ffffff';

            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}.`, w / 2 - 140, y);
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

    private updateCamera(): void {
        if (!this.level) return;

        const targetX = this.player.centerX - GAME_CONFIG.CANVAS_WIDTH / 2;
        const targetY = this.player.centerY - GAME_CONFIG.CANVAS_HEIGHT / 2;

        // Clamp to level bounds
        const maxX = this.level.width * TILE_SIZE - GAME_CONFIG.CANVAS_WIDTH;
        const maxY = this.level.height * TILE_SIZE - GAME_CONFIG.CANVAS_HEIGHT;

        this.camX += (targetX - this.camX) * 0.1;
        this.camY += (targetY - this.camY) * 0.1;

        this.camX = Math.max(0, Math.min(maxX, this.camX));
        this.camY = Math.max(0, Math.min(maxY, this.camY));
    }

    protected onRender(ctx: CanvasRenderingContext2D): void {
        if (this.gameState === 'menu') {
            this.renderMenu(ctx);
            return;
        }

        if (!this.level) return;

        const camX = this.camX - this.shakeOffsetX;
        const camY = this.camY - this.shakeOffsetY;

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

        // Lighting overlay
        this.renderLighting(ctx, camX, camY);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#141a33');
        grad.addColorStop(1, '#0b0d16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        this.drawCaveLayer(ctx, camX * 0.1, camY * 0.1, w, h);
        this.drawStalactites(ctx, camX * 0.3, camY * 0.2, w);
        this.drawCrystalGlints(ctx, camX * 0.15, camY * 0.1, w, h);
        this.drawChains(ctx, camX * 0.6, w);
    }

    private hashNoise(seed: number): number {
        const s = Math.sin(seed * 12.9898) * 43758.5453;
        return s - Math.floor(s);
    }

    private drawCaveLayer(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, w: number, h: number): void {
        const step = 120;
        const shift = ((offsetX % step) + step) % step;
        let x = -shift - step * 2;
        const baseY = h * 0.5 + offsetY * 0.2;

        ctx.fillStyle = '#141a33';
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, baseY);

        let idx = Math.floor((x + offsetX) / step);
        while (x < w + step * 2) {
            const height = 30 + this.hashNoise(idx) * 50;
            ctx.lineTo(x, baseY + height);
            x += step;
            idx += 1;
        }

        ctx.lineTo(w + step * 2, h);
        ctx.closePath();
        ctx.fill();
    }

    private drawStalactites(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, w: number): void {
        const step = 160;
        const shift = ((offsetX % step) + step) % step;
        let x = -shift - step;
        let idx = Math.floor((x + offsetX) / step);

        ctx.fillStyle = '#1c2238';
        while (x < w + step) {
            const height = 30 + this.hashNoise(idx) * 50;
            const width = 20 + this.hashNoise(idx + 3) * 30;
            const tipY = 20 + offsetY * 0.2;
            ctx.beginPath();
            ctx.moveTo(x, tipY);
            ctx.lineTo(x + width * 0.5, tipY + height);
            ctx.lineTo(x + width, tipY);
            ctx.closePath();
            ctx.fill();
            x += step;
            idx += 1;
        }
    }

    private drawChains(ctx: CanvasRenderingContext2D, offsetX: number, w: number): void {
        const step = 220;
        const shift = ((offsetX % step) + step) % step;
        let x = -shift - step;
        let idx = Math.floor((x + offsetX) / step);

        ctx.strokeStyle = 'rgba(120, 120, 140, 0.55)';
        ctx.lineWidth = 2;

        while (x < w + step) {
            const length = 80 + this.hashNoise(idx) * 140;
            const sway = Math.sin(this.gameTime * 2 + idx) * 2;
            ctx.beginPath();
            ctx.moveTo(x + sway, -20);
            ctx.lineTo(x + sway, length);
            ctx.stroke();
            x += step;
            idx += 1;
        }
    }

    private renderLighting(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';

        const playerGradient = ctx.createRadialGradient(
            this.player.centerX - camX,
            this.player.centerY - camY,
            0,
            this.player.centerX - camX,
            this.player.centerY - camY,
            140
        );
        playerGradient.addColorStop(0, 'rgba(210, 230, 255, 0.65)');
        playerGradient.addColorStop(0.5, 'rgba(160, 200, 255, 0.3)');
        playerGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = playerGradient;
        ctx.fillRect(0, 0, w, h);

        for (const torch of this.torches) {
            const flicker = Math.sin(this.gameTime * 8 + torch.flicker);
            const radius = 120 + flicker * 10;
            const intensity = 0.85 + flicker * 0.1;
            const gx = torch.x - camX;
            const gy = torch.y - camY;

            const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
            gradient.addColorStop(0, `rgba(255, 210, 140, ${intensity})`);
            gradient.addColorStop(0.5, `rgba(255, 140, 60, ${intensity * 0.45})`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
        }

        ctx.restore();
    }

    private drawCrystalGlints(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, w: number, h: number): void {
        const stepX = 180;
        const stepY = 140;
        const shiftX = ((offsetX % stepX) + stepX) % stepX;
        const shiftY = ((offsetY % stepY) + stepY) % stepY;

        ctx.save();
        for (let y = -shiftY; y < h + stepY; y += stepY) {
            for (let x = -shiftX; x < w + stepX; x += stepX) {
                const seed = (x + offsetX) * 0.01 + (y + offsetY) * 0.02;
                const glow = this.hashNoise(seed);
                if (glow < 0.55) continue;
                const size = 2 + glow * 3;
                ctx.fillStyle = `rgba(90, 140, 255, ${0.25 + glow * 0.25})`;
                ctx.fillRect(x + 20 * glow, y + 12 * glow, size, size);
            }
        }
        ctx.restore();
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
        if (this.gameState === 'menu') return;

        // Phase flash overlay (rendered first, behind UI)
        this.renderPhaseFlash(ctx);

        // Health
        for (let i = 0; i < this.player.maxHealth; i++) {
            const filled = i < this.player.health;
            ctx.fillStyle = filled ? '#ff4444' : '#333333';
            ctx.fillRect(20 + i * 24, 20, 20, 20);
            if (filled) {
                ctx.fillStyle = '#ff8888';
                ctx.fillRect(22 + i * 24, 22, 8, 8);
            }
        }

        // Timer
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        ctx.fillStyle = this.timeRemaining < 30 ? '#ff4444' : '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, ctx.canvas.width / 2, 35);

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

        // Gems
        ctx.fillStyle = '#4488ff';
        ctx.font = '16px Arial';
        ctx.fillText(`💎 ${this.gemsCollected}`, ctx.canvas.width - 20, 55);

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
                ctx.fillStyle = 'rgba(0, 50, 0, 0.8)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#44ff44';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('LEVEL COMPLETE!', w / 2, h / 2);
                break;

            case 'victory':
                this.renderVictoryScreen(ctx, w, h);
                break;

            case 'game_over':
                ctx.fillStyle = 'rgba(50, 0, 0, 0.9)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#ff4444';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('TIME EXPIRED', w / 2, h / 2 - 40);
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 + 10);
                ctx.fillText(`Reached Level ${this.currentLevel + 1}`, w / 2, h / 2 + 40);
                break;
            case 'story':
                this.renderStoryOverlay(ctx);
                break;
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
        const lines = this.wrapText(ctx, story.text, panelW - 40);
        lines.forEach((line) => {
            ctx.fillText(line, panelX + 20, textY);
            textY += 20;
        });

        ctx.fillStyle = '#a1a1aa';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('Press SPACE to continue', panelX + panelW - 20, panelY + panelHeight - 16);

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

        // Instructions
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Press SPACE to begin', w / 2, 300);

        // Controls
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText('Left/Right Move  |  Up Jump  |  Down Drop  |  Shift Sword  |  Ctrl Block', w / 2, h - 60);
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
        this.foundOwl = false;
        this.particles = [];
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.footstepTimer = 0;
        this.activeBoss = null;
        this.bossHealthBarTimer = 0;
        this.bannerText = '';
        this.bannerTimer = 0;
        this.bannerDuration = 0;
        this.timeScale = 1.0;
        this.slowmoTimer = 0;
        this.phaseFlashTimer = 0;
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
