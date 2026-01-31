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

type GameState = 'menu' | 'playing' | 'level_intro' | 'level_complete' | 'victory' | 'game_over';

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

    // Stats
    private gemsCollected: number = 0;
    private guardsDefeated: number = 0;
    private deaths: number = 0;
    private foundOwl: boolean = false;

    // Input state for edge detection
    private swordKeyWasPressed: boolean = false;

    protected renderBaseHud: boolean = false;

    protected onInit(): void {
        this.player = new Player(100, 200);
        this.loadLevel(0);
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
        this.particles = [];
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;

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
            this.guards.push(new Guard(spawn.x, groundY, 3, type));
        });

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
            this.gameState = 'playing';
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
            this.gameState = 'game_over';
            this.stateTimer = 0;
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
        }
        this.swordKeyWasPressed = shiftKey;

        // Handle combat
        if (this.player.hasSword) {
            if (action) {
                this.player.tryAttack();
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

        // Handle jump
        if (up) {
            this.player.jump();
        }

        // Update player physics
        this.player.update(safeDt);

        // Collision detection
        this.handlePlayerCollision();

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
            guard.update(safeDt, guardSense);
        }

        // Update traps
        for (const trap of this.traps) {
            trap.update(safeDt, this.player.centerX, this.player.feetY);
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
        this.checkDoor();

        // Update particles
        this.updateParticles(safeDt);

        // Check death
        if (this.player.state === 'dead') {
            this.deaths++;
            this.timeRemaining -= 10;
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
            this.player.die();
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
                        this.services?.audio?.playSound?.('collision');
                        this.spawnSwordClash(guard.centerX, guard.y + guard.height * 0.5);
                        this.triggerHitStop(0.02);
                        this.triggerScreenShake(3, 0.08);
                    } else {
                        guard.takeDamage();
                        this.services?.audio?.playSound?.('hit');
                        this.spawnBloodBurst(guard.centerX, guard.y + guard.height * 0.5);
                        this.triggerHitStop(0.03);
                        this.triggerScreenShake(6, 0.12);
                        if (!guard.isAlive) {
                            this.guardsDefeated++;
                            this.score += 100;
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
                    this.services?.audio?.playSound?.('collision');
                    guard.onAttackBlocked();
                    this.spawnSwordClash(this.player.centerX, this.player.centerY);
                    this.triggerHitStop(0.02);
                    this.triggerScreenShake(3, 0.08);
                } else {
                    this.player.takeDamage(guard.attackDamage, guard.attackIgnoresBlock);
                    this.services?.audio?.playSound?.('hit');
                    this.spawnBloodBurst(this.player.centerX, this.player.centerY);
                    this.triggerHitStop(0.03 * guard.attackDamage);
                    this.triggerScreenShake(7, 0.14);
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
                this.player.takeDamage(3); // Traps are deadly!
                this.services?.audio?.playSound?.('hit');
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
                        this.score += 50;
                        this.services?.audio?.playSound?.('coin');
                        break;
                    case 'time':
                        this.timeRemaining = Math.min(this.MAX_TIME, this.timeRemaining + 15);
                        this.score += 25;
                        this.services?.audio?.playSound?.('coin');
                        break;
                    case 'owl':
                        this.foundOwl = true;
                        this.gameState = 'victory';
                        this.stateTimer = 0;
                        this.score += 1000;
                        this.services?.audio?.playSound?.('success');
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
                this.services?.audio?.playSound?.('click');
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
                this.services?.audio?.playSound?.('unlock');
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

        if (this.player.centerX >= door.x && this.player.centerX < door.x + TILE_SIZE &&
            this.player.feetY >= door.y && this.player.feetY < door.y + TILE_SIZE) {
            // Level complete!
            if (this.currentLevel < ALL_LEVELS.length - 1) {
                this.gameState = 'level_complete';
                this.stateTimer = 0;
                this.services?.audio?.playSound?.('success');
            }
        }
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
        if (this.stateTimer > 2 && input?.isActionPressed?.()) {
            this.onRestart();
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
                ctx.fillStyle = 'rgba(50, 40, 0, 0.9)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('🦉 GOLDEN OWL FOUND! 🦉', w / 2, h / 2 - 40);
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.fillText(`Final Score: ${this.score}`, w / 2, h / 2 + 20);
                ctx.fillText(`Time: ${Math.floor(this.timeRemaining)}s remaining`, w / 2, h / 2 + 50);
                if (this.stateTimer > 2) {
                    ctx.fillStyle = '#ffdd44';
                    ctx.fillText('Press SPACE to play again', w / 2, h / 2 + 100);
                }
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
                if (this.stateTimer > 2) {
                    ctx.fillStyle = '#ffdd44';
                    ctx.fillText('Press SPACE to retry', w / 2, h / 2 + 90);
                }
                break;
        }
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
        this.loadLevel(0);
        this.gameState = 'level_intro';
        this.stateTimer = 0;
    }
}
