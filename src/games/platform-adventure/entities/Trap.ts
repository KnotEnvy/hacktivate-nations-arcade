// ===== src/games/platform-adventure/entities/Trap.ts =====
import { TILE_SIZE } from '../data/TileTypes';

export type TrapType = 'spikes' | 'chomper' | 'loose_floor';

export class Trap {
    x: number;
    y: number;
    type: TrapType;
    width: number;
    height: number;

    // State
    active: boolean = true;
    triggered: boolean = false;
    deadly: boolean = false;

    // Animation
    private animTimer: number = 0;
    private animFrame: number = 0;

    // Type-specific timings
    private cycleTime: number = 0;    // For chompers
    private triggerDelay: number = 0; // Time before spikes pop up
    private collapseTimer: number = 0; // For loose floors

    // Loose floor
    private fallen: boolean = false;
    private shaking: boolean = false;

    constructor(x: number, y: number, type: TrapType) {
        this.x = x;
        this.y = y;
        this.type = type;

        switch (type) {
            case 'spikes':
                this.width = TILE_SIZE;
                this.height = TILE_SIZE / 2;
                this.triggerDelay = 0;
                break;
            case 'chomper':
                this.width = TILE_SIZE;
                this.height = TILE_SIZE;
                this.cycleTime = Math.random() * 0.5; // Offset cycle times
                break;
            case 'loose_floor':
                this.width = TILE_SIZE;
                this.height = 8;
                this.collapseTimer = 0;
                break;
        }
    }

    update(dt: number, playerX: number, playerY: number): void {
        this.animTimer += dt;

        switch (this.type) {
            case 'spikes':
                this.updateSpikes(dt, playerX, playerY);
                break;
            case 'chomper':
                this.updateChomper(dt);
                break;
            case 'loose_floor':
                this.updateLooseFloor(dt, playerX, playerY);
                break;
        }
    }

    private updateSpikes(dt: number, playerX: number, playerY: number): void {
        // Spikes are always deadly when extended
        const playerNearby = Math.abs(playerX - this.x - this.width / 2) < TILE_SIZE * 1.5 &&
            playerY >= this.y - TILE_SIZE && playerY <= this.y + TILE_SIZE;

        if (playerNearby && !this.triggered) {
            this.triggered = true;
            this.triggerDelay = 0.2; // Brief delay before spikes pop up
        }

        if (this.triggered) {
            this.triggerDelay -= dt;
            if (this.triggerDelay <= 0) {
                this.deadly = true;
                // Retract after a moment
                if (this.animTimer > 1.5) {
                    this.triggered = false;
                    this.deadly = false;
                    this.animTimer = 0;
                }
            }
        }
    }

    private updateChomper(dt: number): void {
        this.cycleTime += dt;
        const cycle = 1.5; // Full cycle time in seconds
        const openTime = 0.8; // Time blades are open

        const phase = this.cycleTime % cycle;

        // Deadly during open phase
        this.deadly = phase >= 0.2 && phase < openTime;
        this.animFrame = this.deadly ? 1 : 0;
    }

    private updateLooseFloor(dt: number, playerX: number, playerY: number): void {
        if (this.fallen) {
            this.active = false;
            return;
        }

        // Check if player is standing on this tile
        const onTile = playerX >= this.x && playerX < this.x + this.width &&
            playerY >= this.y - TILE_SIZE && playerY <= this.y;

        if (onTile && !this.shaking) {
            this.shaking = true;
            this.collapseTimer = 0;
        }

        if (this.shaking) {
            this.collapseTimer += dt;

            if (this.collapseTimer > 0.4) {
                this.fallen = true;
                this.active = false;
            }
        }
    }

    trigger(): void {
        if (this.type === 'spikes' && !this.triggered) {
            this.triggered = true;
            this.triggerDelay = 0.15;
            this.animTimer = 0;
        }
    }

    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (!this.active && this.type === 'loose_floor') return;

        const screenX = Math.floor(this.x - camX);
        const screenY = Math.floor(this.y - camY);

        ctx.save();

        switch (this.type) {
            case 'spikes':
                this.renderSpikes(ctx, screenX, screenY);
                break;
            case 'chomper':
                this.renderChomper(ctx, screenX, screenY);
                break;
            case 'loose_floor':
                this.renderLooseFloor(ctx, screenX, screenY);
                break;
        }

        ctx.restore();
    }

    private renderSpikes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        const extended = this.deadly ? 1 : (this.triggered ? 0.5 : 0.2);
        const spikeHeight = 16 * extended;

        // Base
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x, y + TILE_SIZE - 6, TILE_SIZE, 6);

        // Spikes
        ctx.fillStyle = this.deadly ? '#cc4444' : '#666666';
        for (let i = 0; i < 5; i++) {
            const sx = x + 4 + i * 9;
            const sy = y + TILE_SIZE - 6 - spikeHeight;

            ctx.beginPath();
            ctx.moveTo(sx, sy + spikeHeight);
            ctx.lineTo(sx + 4, sy);
            ctx.lineTo(sx + 8, sy + spikeHeight);
            ctx.closePath();
            ctx.fill();
        }
    }

    private renderChomper(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        const open = this.deadly;

        // Frame
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x, y, TILE_SIZE, 8);
        ctx.fillRect(x, y + TILE_SIZE - 8, TILE_SIZE, 8);

        if (open) {
            // Blades extended
            ctx.fillStyle = '#888888';
            // Top blade
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 8);
            ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
            ctx.lineTo(x + TILE_SIZE - 4, y + 8);
            ctx.closePath();
            ctx.fill();

            // Bottom blade
            ctx.beginPath();
            ctx.moveTo(x + 4, y + TILE_SIZE - 8);
            ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
            ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE - 8);
            ctx.closePath();
            ctx.fill();

            // Edge highlights
            ctx.strokeStyle = '#aaaaaa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2);
            ctx.lineTo(x + TILE_SIZE / 2 + 2, y + TILE_SIZE / 2);
            ctx.stroke();
        } else {
            // Blades retracted - show mechanism
            ctx.fillStyle = '#555555';
            ctx.fillRect(x + 10, y + 8, 28, 4);
            ctx.fillRect(x + 10, y + TILE_SIZE - 12, 28, 4);
        }
    }

    private renderLooseFloor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        // Shake effect
        const shakeX = this.shaking ? (Math.random() - 0.5) * 4 : 0;
        const shakeY = this.shaking ? (Math.random() - 0.5) * 2 : 0;

        // Cracked floor tile
        ctx.fillStyle = this.shaking ? '#6a5a4a' : '#5a4a3a';
        ctx.fillRect(x + shakeX, y + shakeY, TILE_SIZE, 8);

        // Cracks
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10 + shakeX, y + shakeY);
        ctx.lineTo(x + 15 + shakeX, y + 8 + shakeY);
        ctx.moveTo(x + 30 + shakeX, y + shakeY);
        ctx.lineTo(x + 25 + shakeX, y + 6 + shakeY);
        ctx.lineTo(x + 35 + shakeX, y + 8 + shakeY);
        ctx.stroke();

        if (this.shaking) {
            // Debris particles
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(x + 8 + shakeX, y + 10, 3, 3);
            ctx.fillRect(x + 35 + shakeX, y + 12, 2, 2);
        }
    }

    get left(): number { return this.x; }
    get right(): number { return this.x + this.width; }
    get top(): number { return this.y; }
    get bottom(): number { return this.y + this.height; }
    get centerX(): number { return this.x + this.width / 2; }
}
