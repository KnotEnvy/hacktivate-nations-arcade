// ===== src/games/platform-adventure/PlatformGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';
import { TILE_SIZE, TileType, TILE_COLORS, TILE_DEFS } from './data/TileTypes';
import { Player } from './entities/Player';
import { Guard } from './entities/Guard';
import { Collectible, CollectibleType } from './entities/Collectible';
import { Trap, TrapType } from './entities/Trap';
import { ALL_LEVELS, LevelDefinition, getTileAt, isTileSolid, findPlayerSpawn, findDoorPosition, parseTile } from './levels/LevelData';

type GameState = 'menu' | 'playing' | 'level_intro' | 'level_complete' | 'victory' | 'game_over';

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
    private gates: { x: number; y: number; open: boolean; linkedSwitch: { x: number; y: number } | null }[] = [];

    // Camera
    private camX: number = 0;
    private camY: number = 0;

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

        // Parse level tiles for entities
        for (let y = 0; y < this.level.height; y++) {
            for (let x = 0; x < this.level.width; x++) {
                const tile = getTileAt(this.level, x, y);
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                switch (tile) {
                    case 'guard':
                        this.guards.push(new Guard(px + 12, py));
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
                        this.gates.push({ x: px, y: py, open: false, linkedSwitch: null });
                        break;
                }
            }
        }

        // Link switches to gates (simple: each switch opens next gate in order)
        let switchIndex = 0;
        for (let y = 0; y < this.level.height; y++) {
            for (let x = 0; x < this.level.width; x++) {
                if (getTileAt(this.level, x, y) === 'switch') {
                    if (this.gates[switchIndex]) {
                        this.gates[switchIndex].linkedSwitch = { x: x * TILE_SIZE, y: y * TILE_SIZE };
                    }
                    switchIndex++;
                }
            }
        }

        // Spawn player
        const spawn = findPlayerSpawn(this.level);
        this.player.x = spawn.x;
        this.player.y = spawn.y;
        this.player.setCheckpoint(spawn.x, spawn.y);
        this.player.respawn();

        // Reset camera
        this.updateCamera();
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
        for (const guard of this.guards) {
            guard.update(safeDt, this.player.x, this.player.y, playerAttacking);
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
        this.checkDoor();

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
        const groundTileL = isTileSolid(this.level, tileXLeft, tileYFeet);
        const groundTileC = isTileSolid(this.level, tileXCenter, tileYFeet);
        const groundTileR = isTileSolid(this.level, tileXRight, tileYFeet);
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
            const ceilTileL = isTileSolid(this.level, tileXLeft, tileYHead);
            const ceilTileR = isTileSolid(this.level, tileXRight, tileYHead);
            if (ceilTileL || ceilTileR) {
                this.player.vy = 0;
                this.player.y = (tileYHead + 1) * TILE_SIZE;
            }
        }

        // Wall collision - left
        if (this.player.vx < 0) {
            const wallL = isTileSolid(this.level, tileXLeft, tileYBody);
            if (wallL) {
                this.player.x = (tileXLeft + 1) * TILE_SIZE;
                this.player.vx = 0;
            }
        }

        // Wall collision - right
        if (this.player.vx > 0) {
            const wallR = isTileSolid(this.level, tileXRight, tileYBody);
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
                    } else {
                        guard.takeDamage();
                        this.services?.audio?.playSound?.('hit');
                        if (!guard.isAlive) {
                            this.guardsDefeated++;
                            this.score += 100;
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
                if (this.player.isBlocking) {
                    this.services?.audio?.playSound?.('collision');
                } else {
                    this.player.takeDamage();
                    this.services?.audio?.playSound?.('hit');
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

        for (const gate of this.gates) {
            if (!gate.linkedSwitch || gate.open) continue;

            const sx = gate.linkedSwitch.x;
            const sy = gate.linkedSwitch.y;

            // Player on switch?
            if (this.player.centerX >= sx && this.player.centerX < sx + TILE_SIZE &&
                this.player.feetY >= sy && this.player.feetY < sy + TILE_SIZE) {
                gate.open = true;
                this.services?.audio?.playSound?.('click');
            }
        }
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
        // Background
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if (this.gameState === 'menu') {
            this.renderMenu(ctx);
            return;
        }

        if (!this.level) return;

        // Render tiles
        this.renderTiles(ctx);

        // Render gates
        this.renderGates(ctx);

        // Render traps
        for (const trap of this.traps) {
            trap.render(ctx, this.camX, this.camY);
        }

        // Render collectibles
        for (const c of this.collectibles) {
            c.render(ctx, this.camX, this.camY);
        }

        // Render guards
        for (const guard of this.guards) {
            guard.render(ctx, this.camX, this.camY);
        }

        // Render player
        this.player.render(ctx, this.camX, this.camY);
    }

    private renderTiles(ctx: CanvasRenderingContext2D): void {
        if (!this.level) return;

        const startX = Math.floor(this.camX / TILE_SIZE);
        const startY = Math.floor(this.camY / TILE_SIZE);
        const endX = Math.ceil((this.camX + ctx.canvas.width) / TILE_SIZE);
        const endY = Math.ceil((this.camY + ctx.canvas.height) / TILE_SIZE);

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = getTileAt(this.level, x, y);
                if (tile === 'empty' || tile === 'player' || tile === 'guard') continue;
                if (tile === 'potion_hp' || tile === 'potion_max' || tile === 'gem' || tile === 'time' || tile === 'owl') continue;
                if (tile === 'spikes' || tile === 'chomper' || tile === 'loose') continue;
                if (tile === 'gate') continue;

                const screenX = x * TILE_SIZE - this.camX;
                const screenY = y * TILE_SIZE - this.camY;
                const colors = TILE_COLORS[tile];

                this.renderTile(ctx, tile, screenX, screenY, colors);
            }
        }
    }

    private renderTile(ctx: CanvasRenderingContext2D, tile: TileType, x: number, y: number,
        colors: { primary: string; secondary: string; accent: string }): void {
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
                ctx.fillStyle = colors.primary;
                ctx.fillRect(x + 12, y + TILE_SIZE - 8, 24, 8);
                ctx.fillStyle = colors.accent;
                ctx.fillRect(x + 18, y + TILE_SIZE - 6, 12, 4);
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

    private renderGates(ctx: CanvasRenderingContext2D): void {
        for (const gate of this.gates) {
            const screenX = gate.x - this.camX;
            const screenY = gate.y - this.camY;

            if (gate.open) {
                // Open gate - just show frame
                ctx.fillStyle = '#444433';
                ctx.fillRect(screenX, screenY, 4, TILE_SIZE);
                ctx.fillRect(screenX + TILE_SIZE - 4, screenY, 4, TILE_SIZE);
            } else {
                // Closed gate - bars
                ctx.fillStyle = '#555544';
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#333322';
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(screenX + 4 + i * 9, screenY, 4, TILE_SIZE);
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
        ctx.fillText('← → Move  |  ↑ Jump/Climb  |  ↓ Drop  |  S Sword  |  D Block', w / 2, h - 60);
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
        this.loadLevel(0);
        this.gameState = 'level_intro';
        this.stateTimer = 0;
    }
}
