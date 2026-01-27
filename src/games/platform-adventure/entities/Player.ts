// ===== src/games/platform-adventure/entities/Player.ts =====
// Simplified player with direct movement (like TapDodge pattern)
import { TILE_SIZE } from '../data/TileTypes';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'combat_idle' | 'attack' | 'block' | 'hurt' | 'dying' | 'dead';

export class Player {
    // Position
    x: number;
    y: number;

    // Dimensions
    readonly width = 24;
    readonly height = 48;

    // Movement
    private readonly MOVE_SPEED = 150;  // pixels per second
    private readonly JUMP_VELOCITY = 350;
    private readonly GRAVITY = 900;

    // Velocity - now properly typed
    public vx: number = 0;
    public vy: number = 0;

    // State
    public state: PlayerState = 'idle';
    public facingRight: boolean = true;
    public hasSword: boolean = false;
    public isGrounded: boolean = true;

    // Combat
    public isBlocking: boolean = false;
    public attackHitbox: { x: number, y: number, w: number, h: number } | null = null;
    private attackTimer: number = 0;
    private blockTimer: number = 0;

    // Animation (public for debug)
    public animTimer: number = 0;
    private animFrame: number = 0;

    // Health
    public health: number = 3;
    public maxHealth: number = 3;
    public invulnTimer: number = 0;

    // Spawn
    private spawnX: number;
    private spawnY: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.spawnX = x;
        this.spawnY = y;
    }

    // Simple update - just handles timers and applies physics
    update(dt: number): void {
        // Update all timers
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.attackTimer > 0) this.attackTimer -= dt;
        if (this.blockTimer > 0) this.blockTimer -= dt;
        this.animTimer += dt;

        // Handle attack state exit
        if (this.state === 'attack' && this.attackTimer <= 0) {
            this.attackHitbox = null;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
        }

        // Handle block state exit
        if (this.state === 'block' && this.blockTimer <= 0) {
            this.isBlocking = false;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
        }

        // Handle dying
        if (this.state === 'dying' && this.animTimer > 1) {
            this.state = 'dead';
        }

        // Apply gravity when not grounded
        if (!this.isGrounded) {
            this.vy += this.GRAVITY * dt;
            if (this.vy > 600) this.vy = 600; // Terminal velocity
        }

        // Apply velocity to position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update animation frame for running
        if (this.state === 'run' && this.animTimer > 0.1) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    // Direct movement methods - called from game input handler
    moveLeft(): void {
        if (this.canMove()) {
            this.vx = -this.MOVE_SPEED;
            this.facingRight = false;
            if (this.isGrounded && this.state !== 'run') {
                this.state = 'run';
            }
        }
    }

    moveRight(): void {
        if (this.canMove()) {
            this.vx = this.MOVE_SPEED;
            this.facingRight = true;
            if (this.isGrounded && this.state !== 'run') {
                this.state = 'run';
            }
        }
    }

    stopMoving(): void {
        this.vx = 0;
        if (this.isGrounded && this.state === 'run') {
            this.state = this.hasSword ? 'combat_idle' : 'idle';
        }
    }

    jump(): void {
        if (this.canMove() && this.isGrounded) {
            this.vy = -this.JUMP_VELOCITY;
            this.isGrounded = false;
            this.state = 'jump';
        }
    }

    private canMove(): boolean {
        return this.state !== 'attack' && this.state !== 'block' &&
            this.state !== 'hurt' && this.state !== 'dying' && this.state !== 'dead';
    }

    // Called by collision system when landing
    land(): void {
        if (!this.isGrounded) {
            this.isGrounded = true;
            this.vy = 0;
            if (this.state === 'jump' || this.state === 'fall') {
                this.state = this.hasSword ? 'combat_idle' : 'idle';
            }
        }
    }

    // Called when walking off a ledge
    startFall(): void {
        if (this.isGrounded && this.state !== 'jump') {
            this.isGrounded = false;
            this.state = 'fall';
        }
    }

    // Combat
    toggleSword(): void {
        if (this.canMove()) {
            this.hasSword = !this.hasSword;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
        }
    }

    tryAttack(): boolean {
        // Must have sword and not already attacking
        if (!this.hasSword) return false;
        if (this.state === 'attack' || this.state === 'block' ||
            this.state === 'hurt' || this.state === 'dying' || this.state === 'dead') return false;

        this.state = 'attack';
        this.attackTimer = 0.35;
        this.animTimer = 0;
        // Create hitbox in front
        this.attackHitbox = {
            x: this.x + (this.facingRight ? this.width : -25),
            y: this.y + 10,
            w: 25,
            h: 30
        };
        return true;
    }

    tryBlock(): boolean {
        if (!this.hasSword || this.state === 'block') return false;
        if (!this.canMove()) return false;

        this.state = 'block';
        this.blockTimer = 0.4;
        this.isBlocking = true;
        this.animTimer = 0;
        return true;
    }

    takeDamage(amount: number = 1): boolean {
        if (this.invulnTimer > 0 || this.isBlocking) return false;
        if (this.state === 'dying' || this.state === 'dead') return false;

        this.health -= amount;
        this.invulnTimer = 1.5;

        if (this.health <= 0) {
            this.state = 'dying';
            this.animTimer = 0;
            return true;
        }

        this.state = 'hurt';
        return false;
    }

    heal(amount: number = 1): void {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

    increaseMaxHealth(): void {
        this.maxHealth++;
        this.health = this.maxHealth;
    }

    die(): void {
        this.state = 'dying';
        this.animTimer = 0;
    }

    respawn(): void {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.state = 'idle';
        this.animFrame = 0;
        this.animTimer = 0;
        this.isGrounded = true;
        this.hasSword = false;
        this.isBlocking = false;
        this.attackHitbox = null;
        this.attackTimer = 0;
        this.blockTimer = 0;
    }

    setCheckpoint(x: number, y: number): void {
        this.spawnX = x;
        this.spawnY = y;
    }

    // Rendering
    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        const screenX = Math.floor(this.x - camX);
        const screenY = Math.floor(this.y - camY);

        // Blink when invulnerable
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 8) % 2 === 0) return;

        ctx.save();

        if (!this.facingRight) {
            ctx.translate(screenX + this.width, screenY);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(screenX, screenY);
        }

        this.drawSprite(ctx);

        ctx.restore();
    }

    private drawSprite(ctx: CanvasRenderingContext2D): void {
        const isDead = this.state === 'dying' || this.state === 'dead';

        if (isDead) {
            // Fallen body
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 40, 24, 8);
            ctx.fillStyle = '#4466aa';
            ctx.fillRect(0, 32, 24, 8);
            return;
        }

        // Legs
        ctx.fillStyle = '#333';
        if (this.state === 'run') {
            const phase = this.animFrame * Math.PI / 2;
            const off = Math.sin(phase) * 5;
            ctx.fillRect(6, 32 + off, 5, 14 - Math.abs(off));
            ctx.fillRect(13, 32 - off, 5, 14 - Math.abs(off));
        } else if (this.state === 'jump' || this.state === 'fall') {
            ctx.fillRect(6, 30, 5, 16);
            ctx.fillRect(13, 34, 5, 12);
        } else {
            ctx.fillRect(6, 32, 5, 16);
            ctx.fillRect(13, 32, 5, 16);
        }

        // Torso
        ctx.fillStyle = this.state === 'hurt' ? '#aa4444' : '#4466aa';
        ctx.fillRect(4, 14, 16, 18);

        // Belt
        ctx.fillStyle = '#664422';
        ctx.fillRect(4, 31, 16, 2);

        // Arms
        ctx.fillStyle = '#ffcc99';
        if (this.state === 'attack') {
            // Extended arm thrust forward
            ctx.fillRect(20, 14, 20, 4);
        } else if (this.state === 'block') {
            // Arm raised to block
            ctx.fillRect(18, 6, 4, 18);
        } else if (this.state === 'run') {
            const phase = this.animFrame * Math.PI / 2;
            const off = Math.sin(phase) * 3;
            ctx.fillRect(0, 16 - off, 4, 10);
            ctx.fillRect(20, 16 + off, 4, 10);
        } else {
            // Idle arms at sides
            ctx.fillRect(0, 16, 4, 10);
            ctx.fillRect(20, 16, 4, 10);
        }

        // Head
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(6, 0, 12, 14);

        // Hair
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(6, 0, 12, 4);
        ctx.fillRect(4, 2, 4, 5);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(14, 6, 2, 2);

        // Sword
        if (this.hasSword) {
            ctx.fillStyle = '#c0d0e0'; // Bright steel color
            if (this.state === 'attack') {
                // Sword thrust forward - long blade
                ctx.fillRect(28, 14, 20, 3);
                // Blade tip
                ctx.fillRect(46, 13, 4, 5);
            } else if (this.state === 'block') {
                // Sword held vertically for defense
                ctx.fillRect(20, 2, 3, 22);
            } else {
                // Sword held at ready (diagonal)
                ctx.fillRect(22, 18, 14, 2);
            }
            // Hilt/guard
            ctx.fillStyle = '#886633';
            if (this.state === 'attack') {
                ctx.fillRect(24, 12, 5, 8);
            } else if (this.state === 'block') {
                ctx.fillRect(18, 22, 8, 4);
            } else {
                ctx.fillRect(20, 16, 5, 6);
            }
        }
    }

    // Collision getters
    get left(): number { return this.x; }
    get right(): number { return this.x + this.width; }
    get top(): number { return this.y; }
    get bottom(): number { return this.y + this.height; }
    get centerX(): number { return this.x + this.width / 2; }
    get centerY(): number { return this.y + this.height / 2; }
    get feetY(): number { return this.y + this.height; }
    get tileX(): number { return Math.floor(this.centerX / TILE_SIZE); }
    get tileY(): number { return Math.floor(this.feetY / TILE_SIZE); }
}
