// ===== src/games/platform-adventure/entities/Player.ts =====
// Simplified player with direct movement (like TapDodge pattern)
import { TILE_SIZE } from '../data/TileTypes';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'combat_idle' | 'attack' | 'block' | 'hurt' | 'dying' | 'dead';

export interface PlayerInventory {
    hasBlade: boolean;
    hasArmor: boolean;
    hasBoots: boolean;
    hasHeart: boolean;
}

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

    // Hit feedback (P3-3.2)
    public flashTimer: number = 0;
    public hurtDirection: number = 0; // -1 = knocked left, 1 = knocked right

    // Animation polish (P3-1.4)
    private landingSquash: number = 0; // 0-1, decays over time
    private deathFrame: number = 0;

    // Inventory (item progression)
    public inventory: PlayerInventory = { hasBlade: false, hasArmor: false, hasBoots: false, hasHeart: false };

    // Dash (requires Dash Boots)
    public isDashing: boolean = false;
    private dashTimer: number = 0;
    private dashCooldown: number = 0;
    private readonly DASH_SPEED = 400;
    private readonly DASH_DURATION = 0.15;
    private readonly DASH_COOLDOWN = 0.8;

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
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.landingSquash > 0) this.landingSquash = Math.max(0, this.landingSquash - dt * 4);
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        // Dash update
        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.vx = 0;
            }
        }

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
            this.state !== 'hurt' && this.state !== 'dying' && this.state !== 'dead' &&
            !this.isDashing;
    }

    // Called by collision system when landing
    land(): void {
        if (!this.isGrounded) {
            this.isGrounded = true;
            this.landingSquash = Math.min(1.0, Math.abs(this.vy) / 500); // Scale squash with fall speed (P3-1.4)
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

    resetInventory(): void {
        this.inventory = { hasBlade: false, hasArmor: false, hasBoots: false, hasHeart: false };
    }

    // Combat
    toggleSword(): void {
        if (!this.inventory.hasBlade) return; // Need Ancient Blade to draw sword
        if (this.canMove()) {
            this.hasSword = !this.hasSword;
            this.state = this.hasSword ? 'combat_idle' : 'idle';
            this.animTimer = 0;
        }
    }

    tryAttack(): boolean {
        if (this.state === 'attack' || this.state === 'block' ||
            this.state === 'hurt' || this.state === 'dying' || this.state === 'dead') return false;

        this.state = 'attack';
        this.animTimer = 0;

        if (this.hasSword) {
            // Sword attack: longer reach, longer duration
            this.attackTimer = 0.35;
            this.attackHitbox = {
                x: this.x + (this.facingRight ? this.width : -25),
                y: this.y + 10,
                w: 25,
                h: 30
            };
        } else {
            // Punch attack: short range, fast
            this.attackTimer = 0.25;
            this.attackHitbox = {
                x: this.x + (this.facingRight ? this.width : -12),
                y: this.y + 12,
                w: 12,
                h: 20
            };
        }
        return true;
    }

    get isPunchAttack(): boolean {
        return this.state === 'attack' && !this.hasSword;
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

    tryDash(): boolean {
        if (!this.inventory.hasBoots) return false;
        if (this.isDashing || this.dashCooldown > 0) return false;
        if (this.state === 'attack' || this.state === 'block' ||
            this.state === 'hurt' || this.state === 'dying' || this.state === 'dead') return false;

        this.isDashing = true;
        this.dashTimer = this.DASH_DURATION;
        this.dashCooldown = this.DASH_COOLDOWN;
        this.invulnTimer = Math.max(this.invulnTimer, this.DASH_DURATION + 0.05); // i-frames during dash
        this.vx = this.DASH_SPEED * (this.facingRight ? 1 : -1);
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
        this.flashTimer = 0.12; // White flash on hit (P3-3.2)

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
        this.flashTimer = 0;
        this.hurtDirection = 0;
        this.landingSquash = 0;
        this.deathFrame = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
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

        // White flash overlay on hit (P3-3.2)
        if (this.flashTimer > 0) {
            const flashAlpha = Math.min(0.7, this.flashTimer / 0.12);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            ctx.fillRect(-2, -2, this.width + 4, this.height + 4);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    private drawSprite(ctx: CanvasRenderingContext2D): void {
        const isDead = this.state === 'dying' || this.state === 'dead';
        const isIdle = this.state === 'idle' || this.state === 'combat_idle';
        const breathPhase = (this.animFrame / this.ANIM.idleFrames) * Math.PI * 2;
        const idleBob = isIdle ? Math.sin(breathPhase) * 2 : 0;

        // Landing squash/stretch (P3-1.4)
        const squash = this.landingSquash;
        const squashY = squash * 0.25; // Squash up to 25% vertically
        const stretchX = squash * 0.15; // Stretch 15% horizontally

        // Hurt stagger offset (P3-1.4)
        const hurtLean = this.state === 'hurt' ? this.hurtDirection * 3 : 0;

        // Blade color (Crystal Heart turns it pink)
        const bladeColor = this.inventory.hasHeart ? '#ff88cc' : '#c0d0e0';

        // ===== DRAMATIC DEATH SEQUENCE (P3-1.4) =====
        if (isDead) {
            this.deathFrame = Math.min(4, Math.floor(this.animTimer / 0.2));
            if (this.deathFrame <= 0) {
                // Stagger back
                ctx.fillStyle = '#444';
                ctx.fillRect(4, 32, 5, 14);
                ctx.fillRect(13, 34, 5, 12);
                ctx.fillStyle = this.state === 'dying' ? '#664466' : '#4466aa';
                ctx.fillRect(4, 16, 16, 16);
                ctx.fillStyle = '#ffcc99';
                ctx.fillRect(6, 2, 12, 14);
                ctx.fillStyle = '#4a3020';
                ctx.fillRect(6, 2, 12, 4);
            } else if (this.deathFrame === 1) {
                // Knees buckling
                ctx.fillStyle = '#444';
                ctx.fillRect(6, 36, 5, 10);
                ctx.fillRect(13, 37, 5, 9);
                ctx.fillStyle = '#4466aa';
                ctx.fillRect(4, 22, 16, 14);
                ctx.fillStyle = '#ffcc99';
                ctx.fillRect(6, 8, 12, 14);
                ctx.fillStyle = '#4a3020';
                ctx.fillRect(6, 8, 12, 4);
            } else if (this.deathFrame === 2) {
                // Falling forward
                ctx.fillStyle = '#444';
                ctx.fillRect(8, 38, 5, 8);
                ctx.fillRect(15, 39, 5, 7);
                ctx.fillStyle = '#4466aa';
                ctx.fillRect(4, 28, 16, 10);
                ctx.fillStyle = '#ffcc99';
                ctx.fillRect(6, 16, 12, 12);
                ctx.fillStyle = '#4a3020';
                ctx.fillRect(6, 16, 12, 4);
            } else {
                // Fully collapsed on ground
                ctx.fillStyle = '#444';
                ctx.fillRect(0, 42, 24, 6);
                ctx.fillStyle = '#4466aa';
                ctx.fillRect(0, 34, 24, 8);
                ctx.fillStyle = '#ffcc99';
                ctx.fillRect(2, 30, 10, 6);
                ctx.fillStyle = '#4a3020';
                ctx.fillRect(2, 30, 10, 3);
                // Dropped sword
                if (this.hasSword) {
                    ctx.fillStyle = bladeColor;
                    ctx.fillRect(14, 40, 12, 2);
                    ctx.fillStyle = '#886633';
                    ctx.fillRect(12, 39, 4, 4);
                }
            }
            return;
        }

        // Apply squash transform
        if (squash > 0.05) {
            ctx.save();
            ctx.translate(this.width / 2, this.height);
            ctx.scale(1 + stretchX, 1 - squashY);
            ctx.translate(-this.width / 2, -this.height);
        }

        // Apply hurt lean
        if (hurtLean !== 0) {
            ctx.translate(hurtLean, 0);
        }

        // ===== LEGS =====
        ctx.fillStyle = this.inventory.hasBoots ? '#2266aa' : '#333';
        if (this.state === 'run') {
            const phase = (this.animFrame / this.ANIM.runFrames) * Math.PI * 2;
            const off = Math.sin(phase) * 5;
            ctx.fillRect(6, 32 + off, 5, 14 - Math.abs(off));
            ctx.fillRect(13, 32 - off, 5, 14 - Math.abs(off));
        } else if (this.state === 'jump' || this.state === 'fall') {
            if (this.animFrame <= 0) {
                // Jump anticipation: crouched legs (P3-1.4)
                ctx.fillRect(5, 34, 6, 12);
                ctx.fillRect(13, 35, 6, 11);
            } else if (this.animFrame === 1) {
                // Apex: legs extended
                ctx.fillRect(6, 30, 5, 14);
                ctx.fillRect(13, 30, 5, 14);
            } else {
                // Landing prep: legs reaching down
                ctx.fillRect(6, 32, 5, 16);
                ctx.fillRect(13, 34, 5, 12);
            }
        } else {
            ctx.fillRect(6, 32 + idleBob, 5, 16);
            ctx.fillRect(13, 32 + idleBob, 5, 16);
        }

        // ===== TORSO =====
        // Breathing width pulse (P3-1.4)
        const breatheWidth = isIdle ? Math.sin(breathPhase) * 0.5 : 0;
        const torsoW = Math.floor(16 + breatheWidth);
        const torsoX = 4 + Math.floor((16 - torsoW) / 2);
        // Attack lean: body shifts forward during thrust
        const attackLean = this.state === 'attack' ? [0, 1, 2, 3, 1][Math.min(this.animFrame, 4)] : 0;
        const torsoColor = this.state === 'hurt' ? '#aa4444' : (this.inventory.hasArmor ? '#7788aa' : '#4466aa');
        ctx.fillStyle = torsoColor;
        if (this.state === 'jump' && this.animFrame <= 0) {
            // Crouch torso lower during jump anticipation (P3-1.4)
            ctx.fillRect(torsoX, 18 + idleBob, torsoW, 16);
        } else {
            ctx.fillRect(torsoX + attackLean, 14 + idleBob, torsoW, 18);
        }

        // Armor shoulder pads
        if (this.inventory.hasArmor && this.state !== 'hurt') {
            ctx.fillStyle = '#667788';
            const shoulderY = (this.state === 'jump' && this.animFrame <= 0) ? 17 + idleBob : 13 + idleBob;
            ctx.fillRect(2 + attackLean, shoulderY, 5, 4);
            ctx.fillRect(17 + attackLean, shoulderY, 5, 4);
            // Chest highlight
            ctx.fillStyle = '#99aacc';
            const chestY = (this.state === 'jump' && this.animFrame <= 0) ? 22 + idleBob : 18 + idleBob;
            ctx.fillRect(8 + attackLean, chestY, 8, 3);
        }

        // ===== BELT =====
        ctx.fillStyle = '#664422';
        if (this.state === 'jump' && this.animFrame <= 0) {
            ctx.fillRect(4, 33 + idleBob, 16, 2);
        } else {
            ctx.fillRect(4 + attackLean, 31 + idleBob, 16, 2);
        }

        // ===== ARMS =====
        ctx.fillStyle = '#ffcc99';
        if (this.state === 'attack' && this.hasSword) {
            if (this.animFrame <= 0) {
                // Frame 0 — Anticipation: arm pulled back
                ctx.fillRect(14, 18 + idleBob, 6, 4);
                ctx.fillRect(10, 16 + idleBob, 5, 4);
                ctx.save();
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = '#ffcc66';
                ctx.fillRect(12, 14 + idleBob, 10, 10);
                ctx.restore();
                ctx.fillStyle = '#ffcc99';
            } else if (this.animFrame === 1) {
                ctx.fillRect(16 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(20 + attackLean, 14 + idleBob, 5, 4);
            } else if (this.animFrame === 2) {
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 14 + idleBob, 8, 4);
            } else if (this.animFrame === 3) {
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 14 + idleBob, 10, 4);
            } else {
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 15 + idleBob, 6, 4);
            }
        } else if (this.state === 'attack' && !this.hasSword) {
            // Punch animation — fist extends forward
            if (this.animFrame <= 0) {
                // Wind-up: arm pulled back
                ctx.fillRect(10, 18 + idleBob, 5, 4);
                ctx.fillRect(6, 16 + idleBob, 5, 4);
            } else if (this.animFrame <= 1) {
                // Coil: fist at chest
                ctx.fillRect(16, 16 + idleBob, 5, 4);
                ctx.fillRect(20, 15 + idleBob, 5, 5);
            } else if (this.animFrame <= 2) {
                // Punch extending
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 14 + idleBob, 7, 5);
                // Fist
                ctx.fillRect(28 + attackLean, 13 + idleBob, 5, 6);
            } else if (this.animFrame <= 3) {
                // Full extension
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 14 + idleBob, 10, 4);
                // Fist at max reach
                ctx.fillRect(31 + attackLean, 13 + idleBob, 5, 6);
            } else {
                // Recovery
                ctx.fillRect(18 + attackLean, 16 + idleBob, 5, 4);
                ctx.fillRect(22 + attackLean, 15 + idleBob, 6, 4);
            }
        } else if (this.state === 'block') {
            const raise = this.animFrame === 0 ? 4 : this.animFrame === 1 ? 0 : 6;
            ctx.fillRect(18, 6 + raise + idleBob, 4, 18);
        } else if (this.state === 'run') {
            const phase = (this.animFrame / this.ANIM.runFrames) * Math.PI * 2;
            const off = Math.sin(phase) * 3;
            ctx.fillRect(0, 16 - off + idleBob, 4, 10);
            ctx.fillRect(20, 16 + off + idleBob, 4, 10);
        } else if (this.state === 'hurt') {
            // Arms recoil in hurt direction (P3-1.4)
            ctx.fillRect(2, 18, 4, 8);
            ctx.fillRect(18, 20, 4, 8);
        } else {
            // Idle: subtle arm sway with breathing
            const armSway = isIdle ? Math.sin(breathPhase + 0.5) * 1 : 0;
            ctx.fillRect(0, 16 + idleBob + armSway, 4, 10);
            ctx.fillRect(20, 16 + idleBob - armSway, 4, 10);
        }

        // ===== HEAD =====
        ctx.fillStyle = '#ffcc99';
        if (this.state === 'jump' && this.animFrame <= 0) {
            ctx.fillRect(6, 4 + idleBob, 12, 14); // Head slightly higher during crouch
        } else {
            ctx.fillRect(6 + attackLean, 0 + idleBob, 12, 14);
        }

        // ===== HAIR =====
        ctx.fillStyle = '#4a3020';
        if (this.state === 'jump' && this.animFrame <= 0) {
            ctx.fillRect(6, 4 + idleBob, 12, 4);
            ctx.fillRect(4, 6 + idleBob, 4, 5);
        } else {
            ctx.fillRect(6 + attackLean, 0 + idleBob, 12, 4);
            ctx.fillRect(4 + attackLean, 2 + idleBob, 4, 5);
        }

        // ===== EYE =====
        ctx.fillStyle = '#000';
        if (this.state === 'jump' && this.animFrame <= 0) {
            ctx.fillRect(14, 10 + idleBob, 2, 2);
        } else {
            ctx.fillRect(14 + attackLean, 6 + idleBob, 2, 2);
        }

        // ===== SWORD =====
        if (this.hasSword) {
            if (this.state === 'attack') {
                const al = attackLean;
                if (this.animFrame <= 0) {
                    // Frame 0 — Sword pulled back, angled up
                    ctx.fillStyle = '#886633'; // Hilt first (behind blade)
                    ctx.fillRect(12, 14 + idleBob, 4, 5);
                    ctx.fillStyle = bladeColor;
                    ctx.fillRect(10, 10 + idleBob, 3, 6); // blade angled up
                    ctx.fillRect(9, 8 + idleBob, 2, 4);   // blade tip
                } else if (this.animFrame === 1) {
                    // Frame 1 — Sword coiled at chest, blade angled forward
                    ctx.fillStyle = '#886633';
                    ctx.fillRect(20 + al, 13 + idleBob, 4, 5);
                    ctx.fillStyle = bladeColor;
                    ctx.fillRect(23 + al, 12 + idleBob, 6, 3); // blade forward-angled
                    ctx.fillRect(28 + al, 11 + idleBob, 3, 3); // tip
                } else if (this.animFrame === 2) {
                    // Frame 2 — Thrust: blade extends forward, tapered
                    ctx.fillStyle = '#886633';
                    ctx.fillRect(26 + al, 13 + idleBob, 4, 5);
                    ctx.fillStyle = bladeColor;
                    // Tapered blade: wide base → narrow tip
                    ctx.beginPath();
                    ctx.moveTo(29 + al, 13 + idleBob);      // base top
                    ctx.lineTo(43 + al, 15 + idleBob);      // tip center-top
                    ctx.lineTo(44 + al, 16 + idleBob);      // tip point
                    ctx.lineTo(43 + al, 17 + idleBob);      // tip center-bottom
                    ctx.lineTo(29 + al, 18 + idleBob);      // base bottom
                    ctx.closePath();
                    ctx.fill();
                    // Speed line
                    ctx.save();
                    ctx.globalAlpha = 0.2;
                    ctx.strokeStyle = bladeColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(22 + al, 16 + idleBob);
                    ctx.lineTo(30 + al, 16 + idleBob);
                    ctx.stroke();
                    ctx.restore();
                } else if (this.animFrame === 3) {
                    // Frame 3 — Full extension: max reach, tapered blade + glint
                    ctx.fillStyle = '#886633';
                    ctx.fillRect(28 + al, 13 + idleBob, 4, 5);
                    ctx.fillStyle = bladeColor;
                    // Tapered blade at full reach
                    ctx.beginPath();
                    ctx.moveTo(31 + al, 13 + idleBob);
                    ctx.lineTo(47 + al, 15 + idleBob);
                    ctx.lineTo(48 + al, 16 + idleBob);
                    ctx.lineTo(47 + al, 17 + idleBob);
                    ctx.lineTo(31 + al, 18 + idleBob);
                    ctx.closePath();
                    ctx.fill();
                    // Glint at tip
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(47 + al, 15 + idleBob, 2, 2);
                } else {
                    // Frame 4 — Recovery: sword retracting
                    ctx.fillStyle = '#886633';
                    ctx.fillRect(24 + al, 14 + idleBob, 4, 5);
                    ctx.fillStyle = bladeColor;
                    ctx.fillRect(27 + al, 14 + idleBob, 8, 3); // shorter blade
                    ctx.fillRect(34 + al, 14 + idleBob, 2, 2); // small tip
                }
            } else if (this.state === 'block') {
                ctx.fillStyle = bladeColor;
                const raise = this.animFrame === 0 ? 6 : this.animFrame === 1 ? 2 : 8;
                ctx.fillRect(20, 2 + raise + idleBob, 3, 22);
                ctx.fillStyle = '#886633';
                ctx.fillRect(18, 22 + idleBob, 8, 4);
            } else {
                // Idle/run: sword at side
                if (this.inventory.hasHeart) {
                    ctx.fillStyle = 'rgba(255, 68, 170, 0.3)';
                    ctx.fillRect(20, 14 + idleBob, 18, 6);
                }
                ctx.fillStyle = bladeColor;
                ctx.fillRect(22, 18 + idleBob, 14, 2);
                ctx.fillStyle = '#886633';
                ctx.fillRect(20, 16 + idleBob, 5, 6);
            }
        }

        // Restore squash transform
        if (squash > 0.05) {
            ctx.restore();
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
