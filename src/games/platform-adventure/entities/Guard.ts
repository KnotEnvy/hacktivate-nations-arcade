// ===== src/games/platform-adventure/entities/Guard.ts =====
import { TILE_SIZE } from '../data/TileTypes';

export type GuardState = 'patrol' | 'alert' | 'combat_idle' | 'advance' | 'attack' | 'block' | 'retreat' | 'hurt' | 'dying' | 'dead';

export class Guard {
    x: number;
    y: number;
    readonly width = 24;
    readonly height = 48;

    state: GuardState = 'patrol';
    facingRight: boolean = false;
    health: number = 2;

    // Patrol
    private patrolLeft: number;
    private patrolRight: number;
    private patrolDir: number = 1;

    // Animation
    private animFrame: number = 0;
    private animTimer: number = 0;

    // Combat
    isBlocking: boolean = false;
    attackHitbox: { x: number, y: number, w: number, h: number } | null = null;
    private combatCooldown: number = 0;
    private blockChance: number = 0.4;

    // AI
    private alertTimer: number = 0;
    private actionTimer: number = 0;

    constructor(x: number, y: number, patrolDistance: number = 3) {
        this.x = x;
        this.y = y;
        this.patrolLeft = x - patrolDistance * TILE_SIZE;
        this.patrolRight = x + patrolDistance * TILE_SIZE;
    }

    update(dt: number, playerX: number, playerY: number, playerInCombat: boolean): void {
        this.animTimer += dt;
        if (this.combatCooldown > 0) this.combatCooldown -= dt;

        const distToPlayer = Math.abs(playerX - this.x);
        const sameLevel = Math.abs(playerY - this.y) < TILE_SIZE;
        const inRange = distToPlayer < TILE_SIZE * 5 && sameLevel;
        const inCombatRange = distToPlayer < TILE_SIZE * 2 && sameLevel;

        // Face player when aware
        if (this.state !== 'patrol' && this.state !== 'dying' && this.state !== 'dead') {
            this.facingRight = playerX > this.x;
        }

        switch (this.state) {
            case 'patrol':
                this.updatePatrol(dt, inRange);
                break;
            case 'alert':
                this.updateAlert(dt, inCombatRange);
                break;
            case 'combat_idle':
                this.updateCombat(dt, distToPlayer, playerInCombat);
                break;
            case 'advance':
                this.updateAdvance(dt, distToPlayer);
                break;
            case 'attack':
            case 'block':
            case 'retreat':
            case 'hurt':
                this.updateAnimated(dt);
                break;
            case 'dying':
                this.updateDying(dt);
                break;
        }

        // Update animation
        if (this.animTimer >= 0.15) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    private updatePatrol(dt: number, inRange: boolean): void {
        if (inRange) {
            this.setState('alert');
            return;
        }

        // Move back and forth
        const speed = 1;
        this.x += speed * this.patrolDir;
        this.facingRight = this.patrolDir > 0;

        if (this.x <= this.patrolLeft || this.x >= this.patrolRight) {
            this.patrolDir *= -1;
        }
    }

    private updateAlert(dt: number, inCombatRange: boolean): void {
        this.alertTimer += dt;

        if (this.alertTimer > 0.5) {
            this.alertTimer = 0;
            this.setState('combat_idle');
        }
    }

    private updateCombat(dt: number, distToPlayer: number, playerAttacking: boolean): void {
        this.actionTimer += dt;

        // React to player attacks
        if (playerAttacking && this.combatCooldown <= 0) {
            if (Math.random() < this.blockChance) {
                this.setState('block');
                this.combatCooldown = 0.8;
                return;
            } else {
                // Get hit
                this.takeDamage();
                return;
            }
        }

        // Decide action
        if (this.actionTimer > 1 && this.combatCooldown <= 0) {
            this.actionTimer = 0;

            if (distToPlayer > TILE_SIZE * 1.5) {
                this.setState('advance');
            } else if (Math.random() < 0.5) {
                this.setState('attack');
            } else if (Math.random() < 0.3) {
                this.setState('retreat');
            }
        }
    }

    private updateAdvance(dt: number, distToPlayer: number): void {
        const dir = this.facingRight ? 1 : -1;
        this.x += dir * 2;

        this.actionTimer += dt;
        if (this.actionTimer > 0.4 || distToPlayer < TILE_SIZE) {
            this.actionTimer = 0;
            this.setState('combat_idle');
        }
    }

    private updateAnimated(dt: number): void {
        this.actionTimer += dt;

        // Attack hitbox on frame 1
        if (this.state === 'attack' && this.actionTimer > 0.1 && this.actionTimer < 0.25) {
            this.attackHitbox = {
                x: this.x + (this.facingRight ? this.width : -30),
                y: this.y + 10,
                w: 30,
                h: 30,
            };
        } else {
            this.attackHitbox = null;
        }

        // Animation complete
        const durations: Record<string, number> = {
            attack: 0.4,
            block: 0.3,
            retreat: 0.3,
            hurt: 0.4,
        };

        if (this.actionTimer > (durations[this.state] || 0.3)) {
            this.actionTimer = 0;
            this.combatCooldown = 0.5;

            if (this.state === 'retreat') {
                const dir = this.facingRight ? -1 : 1;
                this.x += dir * TILE_SIZE / 2;
            }

            this.setState('combat_idle');
        }

        this.isBlocking = this.state === 'block';
    }

    private updateDying(dt: number): void {
        this.actionTimer += dt;
        if (this.actionTimer > 0.8) {
            this.setState('dead');
        }
    }

    private setState(newState: GuardState): void {
        this.state = newState;
        this.actionTimer = 0;
        this.attackHitbox = null;
        this.isBlocking = false;
    }

    takeDamage(): void {
        this.health--;
        if (this.health <= 0) {
            this.setState('dying');
        } else {
            this.setState('hurt');
        }
    }

    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (this.state === 'dead') return;

        const screenX = Math.floor(this.x - camX);
        const screenY = Math.floor(this.y - camY);

        ctx.save();

        if (!this.facingRight) {
            ctx.translate(screenX + this.width, screenY);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(screenX, screenY);
        }

        this.drawBody(ctx);

        ctx.restore();
    }

    private drawBody(ctx: CanvasRenderingContext2D): void {
        const isHurt = this.state === 'hurt' || this.state === 'dying';
        const isDying = this.state === 'dying';

        // Legs
        ctx.fillStyle = '#2a2a2a';
        if (this.state === 'advance') {
            const legOffset = Math.sin(this.animFrame * Math.PI / 2) * 4;
            ctx.fillRect(4, 32 + legOffset, 6, 14 - legOffset);
            ctx.fillRect(14, 32 - legOffset, 6, 14 + legOffset);
        } else if (isDying) {
            ctx.fillRect(0, 44, 24, 4);
        } else {
            ctx.fillRect(4, 34, 6, 14);
            ctx.fillRect(14, 34, 6, 14);
        }

        // Torso (red armor)
        ctx.fillStyle = isHurt ? '#ff6666' : '#aa3333';
        if (isDying) {
            ctx.fillRect(0, 36, 24, 8);
        } else {
            ctx.fillRect(4, 14, 16, 20);
        }

        // Arms
        ctx.fillStyle = '#aa3333';
        if (this.state === 'attack') {
            ctx.fillRect(20, 16, 16, 4);
        } else if (this.state === 'block') {
            ctx.fillRect(18, 6, 6, 16);
        } else if (isDying) {
            ctx.fillRect(0, 32, 4, 4);
            ctx.fillRect(20, 32, 4, 4);
        } else {
            ctx.fillRect(0, 16, 4, 12);
            ctx.fillRect(20, 16, 4, 12);
        }

        // Helmet
        ctx.fillStyle = '#333333';
        if (isDying) {
            ctx.fillRect(0, 28, 10, 8);
        } else {
            ctx.fillRect(4, 0, 16, 14);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(12, 4, 6, 6); // Visor
        }

        // Sword
        ctx.fillStyle = '#888899';
        if (this.state === 'attack') {
            ctx.fillRect(36, 14, 20, 3);
        } else if (this.state === 'block') {
            // Shield up
            ctx.fillRect(22, 4, 4, 18);
        } else if (!isDying) {
            ctx.fillRect(22, 20, 14, 2);
        }
    }

    get left(): number { return this.x; }
    get right(): number { return this.x + this.width; }
    get top(): number { return this.y; }
    get bottom(): number { return this.y + this.height; }
    get centerX(): number { return this.x + this.width / 2; }
    get isAlive(): boolean { return this.state !== 'dead'; }
    get isDying(): boolean { return this.state === 'dying'; }
}
