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

    // Coyote time - allows jumping briefly after leaving platform
    private readonly coyoteTime: number = 0.1;  // 100ms window
    private timeSinceGrounded: number = 0;

    // Jump buffering - registers jump input just before landing
    private readonly jumpBufferTime: number = 0.1;  // 100ms window
    private timeSinceJumpPressed: number = Infinity;

    // Variable jump height - release early for lower jump
    private jumpReleased: boolean = true;
    private readonly JUMP_CUT_MULTIPLIER = 0.65;

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
    private hurtTimer: number = 0;

    // Animation (public for debug)
    public animTimer: number = 0;
    private animFrame: number = 0;
    private readonly ANIM = {
        idleFrames: 4,
        idleDuration: 2.0,
        runFrames: 6,
        runDuration: 0.6,
        jumpFrames: 3,
        jumpDuration: 0.6,
        attackFrames: 5,
        attackDuration: 0.35,
        blockFrames: 3,
        blockDuration: 0.4,
        hurtFrames: 3,
        hurtDuration: 0.5,
    };

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
        if (this.hurtTimer > 0) this.hurtTimer -= dt;
        this.animTimer += dt;

        // Update coyote time tracking
        if (this.isGrounded) {
            this.timeSinceGrounded = 0;
        } else {
            this.timeSinceGrounded += dt;
        }

        // Update jump buffer timer
        this.timeSinceJumpPressed += dt;

        // NOTE: Buffered jump check is handled by PlatformGame AFTER collision
        // resolution to avoid wall-sticking and block-phasing issues.

        // Handle attack state exit
        if (this.state === 'attack' && this.attackTimer <= 0) {
            this.attackHitbox = null;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
            this.animTimer = 0;
        }

        // Handle block state exit
        if (this.state === 'block' && this.blockTimer <= 0) {
            this.isBlocking = false;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
            this.animTimer = 0;
        }

        // Handle dying
        if (this.state === 'dying' && this.animTimer > 1) {
            this.state = 'dead';
        }

        if (this.state === 'hurt' && this.hurtTimer <= 0) {
            this.state = this.hasSword ? 'combat_idle' : (this.isGrounded ? 'idle' : 'fall');
            this.animTimer = 0;
        }

        // Apply gravity when not grounded
        if (!this.isGrounded) {
            this.vy += this.GRAVITY * dt;
            if (this.vy > 600) this.vy = 600; // Terminal velocity
        }

        // Apply velocity to position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.updateAnimationFrame();
    }

    private updateAnimationFrame(): void {
        switch (this.state) {
            case 'idle':
            case 'combat_idle': {
                const frameDuration = this.ANIM.idleDuration / this.ANIM.idleFrames;
                this.animFrame = Math.floor((this.animTimer / frameDuration) % this.ANIM.idleFrames);
                break;
            }
            case 'run': {
                const frameDuration = this.ANIM.runDuration / this.ANIM.runFrames;
                this.animFrame = Math.floor((this.animTimer / frameDuration) % this.ANIM.runFrames);
                break;
            }
            case 'jump':
            case 'fall': {
                const frameDuration = this.ANIM.jumpDuration / this.ANIM.jumpFrames;
                this.animFrame = Math.min(this.ANIM.jumpFrames - 1, Math.floor(this.animTimer / frameDuration));
                break;
            }
            case 'attack': {
                const frameDuration = this.ANIM.attackDuration / this.ANIM.attackFrames;
                this.animFrame = Math.min(this.ANIM.attackFrames - 1, Math.floor(this.animTimer / frameDuration));
                break;
            }
            case 'block': {
                const frameDuration = this.ANIM.blockDuration / this.ANIM.blockFrames;
                this.animFrame = Math.min(this.ANIM.blockFrames - 1, Math.floor(this.animTimer / frameDuration));
                break;
            }
            case 'hurt': {
                const frameDuration = this.ANIM.hurtDuration / this.ANIM.hurtFrames;
                this.animFrame = Math.min(this.ANIM.hurtFrames - 1, Math.floor(this.animTimer / frameDuration));
                break;
            }
            default:
                break;
        }
    }

    // Direct movement methods - called from game input handler
    moveLeft(): void {
        if (this.canMove()) {
            this.vx = -this.MOVE_SPEED;
            this.facingRight = false;
            if (this.isGrounded && this.state !== 'run') {
                this.state = 'run';
                this.animTimer = 0;
            }
        }
    }

    moveRight(): void {
        if (this.canMove()) {
            this.vx = this.MOVE_SPEED;
            this.facingRight = true;
            if (this.isGrounded && this.state !== 'run') {
                this.state = 'run';
                this.animTimer = 0;
            }
        }
    }

    stopMoving(): void {
        this.vx = 0;
        if (this.isGrounded && this.state === 'run') {
            this.state = this.hasSword ? 'combat_idle' : 'idle';
            this.animTimer = 0;
        }
    }

    // Buffer a jump input - called when jump key is pressed
    bufferJump(): void {
        this.timeSinceJumpPressed = 0;
        this.jumpReleased = false;
        // Try to jump immediately if possible
        this.jump();
    }

    // Check if a buffered jump should fire (call AFTER collision resolution)
    tryBufferedJump(): boolean {
        if (this.isGrounded && this.timeSinceJumpPressed < this.jumpBufferTime) {
            this.executeJump();
            return true;
        }
        return false;
    }

    // Called when jump key is released - for variable jump height
    onJumpRelease(): void {
        this.jumpReleased = true;
        // Only cut velocity if actively rising from a jump (not falling)
        if (this.vy < 0 && this.state === 'jump') {
            this.vy *= this.JUMP_CUT_MULTIPLIER;
        }
    }

    // Internal method to execute the actual jump
    private executeJump(): void {
        if (!this.canMove()) return;

        this.vy = -this.JUMP_VELOCITY;
        this.isGrounded = false;
        this.state = 'jump';
        this.animTimer = 0;
        this.timeSinceJumpPressed = Infinity;  // Reset buffer after using
        this.timeSinceGrounded = Infinity;  // Prevent double-jump via coyote time
    }

    jump(): boolean {
        // Check coyote time: can jump if grounded OR recently was grounded
        const canCoyoteJump = this.isGrounded || this.timeSinceGrounded < this.coyoteTime;

        if (!this.canMove() || !canCoyoteJump) return false;

        this.executeJump();
        return true;
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
            this.timeSinceGrounded = 0;  // Reset coyote timer on landing
            if (this.state === 'jump' || this.state === 'fall') {
                this.state = this.hasSword ? 'combat_idle' : 'idle';
                this.animTimer = 0;
            }
        }
    }

    // Called when walking off a ledge
    startFall(): void {
        if (this.isGrounded && this.state !== 'jump') {
            this.isGrounded = false;
            this.state = 'fall';
            this.animTimer = 0;
        }
    }

    // Combat
    toggleSword(): void {
        if (this.canMove()) {
            this.hasSword = !this.hasSword;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
            this.animTimer = 0;
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

    takeDamage(amount: number = 1, ignoreBlock: boolean = false): boolean {
        if (this.invulnTimer > 0) return false;
        if (this.isBlocking && !ignoreBlock) return false;
        if (this.state === 'dying' || this.state === 'dead') return false;

        if (ignoreBlock && this.isBlocking) {
            this.isBlocking = false;
            this.blockTimer = 0;
        }

        this.health -= amount;
        this.invulnTimer = 1.5;

        if (this.health <= 0) {
            this.state = 'dying';
            this.animTimer = 0;
            return true;
        }

        this.state = 'hurt';
        this.animTimer = 0;
        this.hurtTimer = 0.4;
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
        this.hurtTimer = 0;
        // Reset movement polish state
        this.timeSinceGrounded = 0;
        this.timeSinceJumpPressed = Infinity;
        this.jumpReleased = true;
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
        const isIdle = this.state === 'idle' || this.state === 'combat_idle';
        const idleBob = isIdle ? Math.sin((this.animFrame / this.ANIM.idleFrames) * Math.PI * 2) * 2 : 0;

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
            const phase = (this.animFrame / this.ANIM.runFrames) * Math.PI * 2;
            const off = Math.sin(phase) * 5;
            ctx.fillRect(6, 32 + off, 5, 14 - Math.abs(off));
            ctx.fillRect(13, 32 - off, 5, 14 - Math.abs(off));
        } else if (this.state === 'jump' || this.state === 'fall') {
            if (this.animFrame <= 0) {
                ctx.fillRect(6, 28, 5, 14);
                ctx.fillRect(13, 30, 5, 12);
            } else if (this.animFrame === 1) {
                ctx.fillRect(6, 30, 5, 14);
                ctx.fillRect(13, 30, 5, 14);
            } else {
                ctx.fillRect(6, 32, 5, 16);
                ctx.fillRect(13, 34, 5, 12);
            }
        } else {
            ctx.fillRect(6, 32 + idleBob, 5, 16);
            ctx.fillRect(13, 32 + idleBob, 5, 16);
        }

        // Torso
        ctx.fillStyle = this.state === 'hurt' ? '#aa4444' : '#4466aa';
        ctx.fillRect(4, 14 + idleBob, 16, 18);

        // Belt
        ctx.fillStyle = '#664422';
        ctx.fillRect(4, 31 + idleBob, 16, 2);

        // Arms
        ctx.fillStyle = '#ffcc99';
        if (this.state === 'attack') {
            if (this.animFrame <= 1) {
                // Windup
                ctx.fillRect(16, 16 + idleBob, 10, 4);
            } else {
                // Strike + hold
                ctx.fillRect(20, 14 + idleBob, 20, 4);
            }
        } else if (this.state === 'block') {
            // Arm raised to block
            const raise = this.animFrame === 0 ? 4 : this.animFrame === 1 ? 0 : 6;
            ctx.fillRect(18, 6 + raise + idleBob, 4, 18);
        } else if (this.state === 'run') {
            const phase = (this.animFrame / this.ANIM.runFrames) * Math.PI * 2;
            const off = Math.sin(phase) * 3;
            ctx.fillRect(0, 16 - off + idleBob, 4, 10);
            ctx.fillRect(20, 16 + off + idleBob, 4, 10);
        } else {
            // Idle arms at sides
            ctx.fillRect(0, 16 + idleBob, 4, 10);
            ctx.fillRect(20, 16 + idleBob, 4, 10);
        }

        // Head
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(6, 0 + idleBob, 12, 14);

        // Hair
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(6, 0 + idleBob, 12, 4);
        ctx.fillRect(4, 2 + idleBob, 4, 5);

        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(14, 6 + idleBob, 2, 2);

        // Sword
        if (this.hasSword) {
            ctx.fillStyle = '#c0d0e0'; // Bright steel color
            if (this.state === 'attack') {
                if (this.animFrame <= 1) {
                    ctx.fillRect(22, 16 + idleBob, 10, 2);
                } else {
                    // Sword thrust forward - long blade
                    ctx.fillRect(28, 14 + idleBob, 20, 3);
                    // Blade tip
                    ctx.fillRect(46, 13 + idleBob, 4, 5);
                }
            } else if (this.state === 'block') {
                // Sword held vertically for defense
                const raise = this.animFrame === 0 ? 6 : this.animFrame === 1 ? 2 : 8;
                ctx.fillRect(20, 2 + raise + idleBob, 3, 22);
            } else {
                // Sword held at ready (diagonal)
                ctx.fillRect(22, 18 + idleBob, 14, 2);
            }
            // Hilt/guard
            ctx.fillStyle = '#886633';
            if (this.state === 'attack') {
                ctx.fillRect(24, 12 + idleBob, 5, 8);
            } else if (this.state === 'block') {
                ctx.fillRect(18, 22 + idleBob, 8, 4);
            } else {
                ctx.fillRect(20, 16 + idleBob, 5, 6);
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
