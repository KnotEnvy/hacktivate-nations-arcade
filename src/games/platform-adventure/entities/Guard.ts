// ===== src/games/platform-adventure/entities/Guard.ts =====
import { TILE_SIZE } from '../data/TileTypes';

export type GuardState =
    | 'idle'
    | 'patrol'
    | 'suspicious'
    | 'alert'
    | 'combat_ready'
    | 'attacking'
    | 'blocking'
    | 'stunned'
    | 'retreating'
    | 'dying'
    | 'dead'
    | 'knocked_out';

export type GuardType = 'recruit' | 'soldier' | 'veteran' | 'captain' | 'shadow';

// Type-specific color schemes for visual distinction
const GUARD_COLORS: Record<GuardType, {
    armor: string;
    armorHurt: string;
    helmet: string;
    visor: string;
    sword: string;
    accent?: string;
    skin?: string;
}> = {
    recruit:  { armor: '#8B6914', armorHurt: '#c49a2e', helmet: '#6B4F2A', visor: '#6B4F2A', sword: '#777788', skin: '#ffcc99' },
    soldier:  { armor: '#aa3333', armorHurt: '#ff6666', helmet: '#333333', visor: '#1a1a1a', sword: '#888899' },
    veteran:  { armor: '#555566', armorHurt: '#8888aa', helmet: '#3a3a3a', visor: '#1a1a1a', sword: '#aaaabb', accent: '#667788' },
    captain:  { armor: '#882222', armorHurt: '#ff4444', helmet: '#222222', visor: '#110011', sword: '#ccbb88', accent: '#ffcc00' },
    shadow:   { armor: '#220033', armorHurt: '#6600aa', helmet: '#110022', visor: '#330044', sword: '#4400ff', accent: '#8800ff' },
};

export interface GuardSense {
    playerX: number;
    playerY: number;
    playerAttacking: boolean;
    playerBlocking: boolean;
    playerNoise: boolean;
    playerHasSword: boolean;
}

interface GuardStats {
    maxHealth: number;
    blockChance: number;
    reactionTime: number;
    aggression: number;
    patrolSpeed: number;
    advanceSpeed: number;
    retreatSpeed: number;
}

type AttackVariant = 'normal' | 'double' | 'bash' | 'charge' | 'spin';

interface AttackWindow {
    start: number;
    end: number;
    damage: number;
    ignoresBlock: boolean;
}

const GUARD_STATS: Record<GuardType, GuardStats> = {
    recruit: { maxHealth: 3, blockChance: 0, reactionTime: 0.5, aggression: 0.3, patrolSpeed: 22, advanceSpeed: 55, retreatSpeed: 70 },
    soldier: { maxHealth: 2, blockChance: 0.4, reactionTime: 0.3, aggression: 0.5, patrolSpeed: 26, advanceSpeed: 60, retreatSpeed: 74 },
    veteran: { maxHealth: 3, blockChance: 0.6, reactionTime: 0.2, aggression: 0.7, patrolSpeed: 30, advanceSpeed: 68, retreatSpeed: 80 },
    captain: { maxHealth: 5, blockChance: 0.7, reactionTime: 0.15, aggression: 0.85, patrolSpeed: 34, advanceSpeed: 75, retreatSpeed: 86 },
    shadow: { maxHealth: 10, blockChance: 0.8, reactionTime: 0.1, aggression: 0.95, patrolSpeed: 38, advanceSpeed: 85, retreatSpeed: 92 },
};

export class Guard {
    x: number;
    y: number;
    readonly width = 24;
    readonly height = 48;

    readonly type: GuardType;
    readonly maxHealth: number;
    health: number;

    state: GuardState = 'patrol';
    facingRight: boolean = false;

    // Patrol
    private patrolLeft: number;
    private patrolRight: number;
    private patrolDir: number = 1;

    // Animation
    private animFrame: number = 0;
    private animTimer: number = 0;

    // Combat
    isBlocking: boolean = false;
    attackHitbox: { x: number; y: number; w: number; h: number } | null = null;
    attackDamage: number = 1;
    attackIgnoresBlock: boolean = false;
    private combatCooldown: number = 0;
    private damageCooldown: number = 0;
    private attackVariant: AttackVariant = 'normal';
    private attackWindows: AttackWindow[] = [];
    private attackDuration: number = 0.4;
    private blockedByPlayerCount: number = 0;
    private rallyActive: boolean = false;
    private shadowPhase: 1 | 2 | 3 | 0 = 0;
    private previousShadowPhase: 1 | 2 | 3 | 0 = 0;
    private chargeDirection: number = 1;

    // Hit feedback (P3-3.2)
    public flashTimer: number = 0;

    // Punch interaction tracking
    public punchHitCount: number = 0;
    public knockoutTimer: number = 0;

    // Callbacks for boss events
    onPhaseChange?: (newPhase: number, guard: Guard) => void;
    onDeath?: (guard: Guard) => void;

    // AI timers
    private stateTimer: number = 0;
    private actionTimer: number = 0;
    private idleDuration: number = 1.2;
    private advanceTimer: number = 0;
    private investigateX: number | null = null;

    // Stats
    private stats: GuardStats;

    // Ranges
    private readonly visionRange = TILE_SIZE * 6;
    private readonly hearingRange = TILE_SIZE * 7;
    private readonly combatRange = TILE_SIZE * 2.1;
    private readonly attackRange = TILE_SIZE * 1.6;

    constructor(x: number, y: number, patrolDistance: number = 3, type: GuardType = 'soldier') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.stats = GUARD_STATS[type];
        this.maxHealth = this.stats.maxHealth;
        this.health = this.maxHealth;
        this.patrolLeft = x - patrolDistance * TILE_SIZE;
        this.patrolRight = x + patrolDistance * TILE_SIZE;
        this.idleDuration = 0.8 + Math.random() * 1.2;
    }

    update(dt: number, sense: GuardSense): void {
        if (this.state === 'dead') return;

        // Handle knocked-out recruits recovering
        if (this.state === 'knocked_out') {
            this.knockoutTimer -= dt;
            this.animTimer += dt;
            if (this.knockoutTimer <= 0) {
                this.health = this.maxHealth;
                this.punchHitCount = 0;
                this.setState('patrol');
            }
            return;
        }

        this.animTimer += dt;
        if (this.combatCooldown > 0) this.combatCooldown -= dt;
        if (this.damageCooldown > 0) this.damageCooldown -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        this.stateTimer += dt;

        const distToPlayer = Math.abs(sense.playerX - this.x);
        const sameLevel = Math.abs(sense.playerY - this.y) < TILE_SIZE;
        const canSeePlayer = distToPlayer < this.visionRange && sameLevel;
        const inCombatRange = distToPlayer < this.combatRange && sameLevel;
        const inAttackRange = distToPlayer < this.attackRange && sameLevel;
        const heardPlayer = sense.playerNoise && distToPlayer < this.hearingRange;
        const healthPercent = this.health / this.maxHealth;
        const newShadowPhase = this.type === 'shadow'
            ? (healthPercent > 0.7 ? 1 : healthPercent > 0.3 ? 2 : 3)
            : 0;
        if (newShadowPhase !== this.shadowPhase && this.shadowPhase !== 0 && newShadowPhase !== 0) {
            this.onPhaseChange?.(newShadowPhase, this);
        }
        this.previousShadowPhase = this.shadowPhase;
        this.shadowPhase = newShadowPhase;
        this.rallyActive = (this.type === 'captain' || this.type === 'shadow') && healthPercent < 0.3;

        // Face player when aware
        if (this.state !== 'patrol' && this.state !== 'idle' && this.state !== 'dying') {
            this.facingRight = sense.playerX > this.x;
        }

        switch (this.state) {
            case 'idle':
                this.updateIdle(canSeePlayer, heardPlayer, sense.playerX);
                break;
            case 'patrol':
                this.updatePatrol(dt, canSeePlayer, heardPlayer, sense.playerX);
                break;
            case 'suspicious':
                this.updateSuspicious(dt, canSeePlayer);
                break;
            case 'alert':
                this.updateAlert(dt, canSeePlayer, inCombatRange, sense.playerX);
                break;
            case 'combat_ready':
                this.updateCombatReady(
                    dt,
                    canSeePlayer,
                    inCombatRange,
                    inAttackRange,
                    sense.playerAttacking,
                    sense.playerBlocking,
                    sense.playerHasSword
                );
                break;
            case 'attacking':
                this.updateAttacking(dt);
                break;
            case 'blocking':
                this.updateBlocking();
                break;
            case 'stunned':
                this.updateStunned();
                break;
            case 'retreating':
                this.updateRetreating(dt);
                break;
            case 'dying':
                this.updateDying();
                break;
        }

        // Update animation
        if (this.animTimer >= 0.15) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    private updateIdle(canSeePlayer: boolean, heardPlayer: boolean, playerX: number): void {
        if (canSeePlayer) {
            this.setState('alert');
            return;
        }

        if (heardPlayer) {
            this.setState('suspicious', playerX);
            return;
        }

        if (this.stateTimer >= this.idleDuration) {
            this.setState('patrol');
        }
    }

    private updatePatrol(dt: number, canSeePlayer: boolean, heardPlayer: boolean, playerX: number): void {
        if (canSeePlayer) {
            this.setState('alert');
            return;
        }

        if (heardPlayer) {
            this.setState('suspicious', playerX);
            return;
        }

        const speed = this.stats.patrolSpeed;
        this.x += speed * this.patrolDir * dt;
        this.facingRight = this.patrolDir > 0;

        if (this.x <= this.patrolLeft || this.x >= this.patrolRight) {
            this.patrolDir *= -1;
            this.x = Math.max(this.patrolLeft, Math.min(this.patrolRight, this.x));
        }
    }

    private updateSuspicious(dt: number, canSeePlayer: boolean): void {
        if (canSeePlayer) {
            this.setState('alert');
            return;
        }

        const targetX = this.investigateX ?? this.x;
        const dir = targetX > this.x ? 1 : -1;
        this.x += dir * this.stats.patrolSpeed * 0.8 * dt;
        this.facingRight = dir > 0;

        if (this.stateTimer > 1.5) {
            this.setState('patrol');
        }
    }

    private updateAlert(dt: number, canSeePlayer: boolean, inCombatRange: boolean, playerX: number): void {
        if (!canSeePlayer) {
            if (this.stateTimer > 1) {
                this.setState('suspicious', playerX);
            }
            return;
        }

        if (inCombatRange) {
            this.setState('combat_ready');
            return;
        }

        const dir = this.facingRight ? 1 : -1;
        this.x += dir * this.getAdvanceSpeed() * dt;
    }

    private updateCombatReady(
        dt: number,
        canSeePlayer: boolean,
        inCombatRange: boolean,
        inAttackRange: boolean,
        playerAttacking: boolean,
        playerBlocking: boolean,
        playerHasSword: boolean
    ): void {
        if (!canSeePlayer) {
            this.setState('suspicious', this.x);
            return;
        }

        if (!inCombatRange) {
            const dir = this.facingRight ? 1 : -1;
            this.x += dir * this.getAdvanceSpeed() * dt;
            return;
        }

        if (!this.rallyActive && this.health / this.maxHealth < 0.3) {
            this.setState('retreating');
            return;
        }

        if (this.advanceTimer > 0) {
            const dir = this.facingRight ? 1 : -1;
            this.advanceTimer -= dt;
            this.x += dir * this.getAdvanceSpeed() * dt;
            return;
        }

        this.actionTimer += dt;
        if (this.actionTimer < this.stats.reactionTime) return;

        this.actionTimer = 0;
        const decision = this.decideCombatAction(inAttackRange, playerAttacking, playerBlocking, playerHasSword);

        switch (decision) {
            case 'attack':
                if (this.combatCooldown <= 0) {
                    const variant = this.chooseAttackVariant(inAttackRange, inCombatRange);
                    this.startAttack(variant);
                } else {
                    this.advanceTimer = 0.2;
                }
                break;
            case 'block':
                this.setState('blocking');
                break;
            case 'retreat':
                this.setState('retreating');
                break;
            case 'advance':
                this.advanceTimer = 0.25;
                break;
        }
    }

    private updateAttacking(dt: number): void {
        if (this.attackWindows.length === 0) {
            this.attackWindows = this.buildAttackWindows('normal');
            this.attackDuration = 0.4;
            this.attackVariant = 'normal';
        }

        if (this.attackVariant === 'charge') {
            // Telegraph then lunge forward
            const telegraphTime = 1.0;
            if (this.stateTimer < telegraphTime) {
                this.chargeDirection = this.facingRight ? 1 : -1;
            } else {
                const chargeSpeed = 260;
                this.x += this.chargeDirection * chargeSpeed * dt;
            }
        }

        this.attackHitbox = null;
        this.attackDamage = 1;
        this.attackIgnoresBlock = false;

        for (const window of this.attackWindows) {
            if (this.stateTimer > window.start && this.stateTimer < window.end) {
                if (this.attackVariant === 'spin') {
                    this.attackHitbox = {
                        x: this.x - 80,
                        y: this.y - 10,
                        w: 160,
                        h: 90,
                    };
                } else if (this.attackVariant === 'charge') {
                    this.attackHitbox = {
                        x: this.x + (this.facingRight ? this.width : -36),
                        y: this.y + 24,
                        w: 36,
                        h: 20,
                    };
                } else if (this.type === 'recruit') {
                    // Recruit punch: smaller fist-sized hitbox
                    this.attackHitbox = {
                        x: this.x + (this.facingRight ? this.width : -15),
                        y: this.y + 12,
                        w: 15,
                        h: 20,
                    };
                } else {
                    this.attackHitbox = {
                        x: this.x + (this.facingRight ? this.width : -30),
                        y: this.y + 10,
                        w: 30,
                        h: 30,
                    };
                }
                this.attackDamage = window.damage;
                this.attackIgnoresBlock = window.ignoresBlock;
                break;
            }
        }

        if (this.stateTimer >= this.attackDuration) {
            const prevVariant = this.attackVariant;
            this.attackHitbox = null;
            this.attackDamage = 1;
            this.attackIgnoresBlock = false;
            this.attackWindows = [];
            this.attackVariant = 'normal';
            this.combatCooldown = prevVariant === 'bash' ? 0.2 : (prevVariant === 'charge' || prevVariant === 'spin') ? 0.6 : 0.4;
            this.setState('combat_ready');
        }
    }

    private chooseAttackVariant(inAttackRange: boolean, inCombatRange: boolean): AttackVariant {
        if (this.type === 'captain') {
            if (this.blockedByPlayerCount >= 3) {
                this.blockedByPlayerCount = 0;
                return 'bash';
            }

            if (this.health / this.maxHealth < 0.6 && inAttackRange && Math.random() < 0.5) {
                return 'double';
            }
        }

        if (this.type === 'shadow') {
            if (this.shadowPhase === 2 && inCombatRange && Math.random() < 0.45) {
                return 'charge';
            }
            if (this.shadowPhase === 3 && Math.random() < 0.45) {
                return 'spin';
            }
        }

        return 'normal';
    }

    private startAttack(variant: AttackVariant): void {
        this.attackVariant = variant;
        this.attackWindows = this.buildAttackWindows(variant);
        this.attackDuration = variant === 'double' ? 0.7 : variant === 'bash' ? 0.5 : variant === 'charge' ? 1.6 : variant === 'spin' ? 1.6 : 0.4;
        this.setState('attacking');
    }

    private buildAttackWindows(variant: AttackVariant): AttackWindow[] {
        switch (variant) {
            case 'double':
                return [
                    { start: 0.1, end: 0.25, damage: 2, ignoresBlock: false },
                    { start: 0.35, end: 0.55, damage: 2, ignoresBlock: false },
                ];
            case 'bash':
                return [{ start: 0.12, end: 0.28, damage: 1, ignoresBlock: true }];
            case 'charge':
                return [{ start: 1.0, end: 1.4, damage: 2, ignoresBlock: false }];
            case 'spin':
                return [{ start: 0.2, end: 1.5, damage: 1, ignoresBlock: false }];
            default:
                return [{ start: 0.1, end: 0.25, damage: 1, ignoresBlock: false }];
        }
    }

    private updateBlocking(): void {
        this.isBlocking = true;
        this.attackHitbox = null;

        if (this.stateTimer >= 0.3) {
            this.isBlocking = false;
            this.combatCooldown = 0.3;
            this.setState('combat_ready');
        }
    }

    private updateStunned(): void {
        this.attackHitbox = null;
        this.isBlocking = false;

        if (this.stateTimer >= 0.5) {
            this.setState('combat_ready');
        }
    }

    private updateRetreating(dt: number): void {
        const dir = this.facingRight ? -1 : 1;
        this.x += dir * this.getRetreatSpeed() * dt;

        if (this.stateTimer >= 0.35) {
            this.setState('combat_ready');
        }
    }

    private updateDying(): void {
        this.attackHitbox = null;
        this.isBlocking = false;

        if (this.stateTimer >= 1.0) {
            this.setState('dead');
        }
    }

    private decideCombatAction(
        inAttackRange: boolean,
        playerAttacking: boolean,
        playerBlocking: boolean,
        playerHasSword: boolean
    ): 'attack' | 'block' | 'retreat' | 'advance' {
        const healthPercent = this.health / this.maxHealth;
        let aggression = this.rallyActive ? Math.min(1, this.stats.aggression + 0.2) : this.stats.aggression;
        let blockChance = this.rallyActive ? Math.max(0.1, this.stats.blockChance - 0.2) : this.stats.blockChance;

        if (this.type === 'shadow') {
            if (this.shadowPhase === 1) {
                aggression *= 0.6;
                blockChance = Math.min(0.9, blockChance + 0.2);
            } else if (this.shadowPhase === 2) {
                aggression = Math.min(1, aggression + 0.25);
                blockChance = Math.max(0.2, blockChance - 0.3);
            } else if (this.shadowPhase === 3) {
                aggression = Math.min(1, aggression + 0.1);
                blockChance = Math.max(0.3, blockChance - 0.1);
            }
        }

        let attackWeight = inAttackRange ? 0.4 + aggression * 0.4 : 0;
        if (!playerHasSword) attackWeight += 0.2;
        if (playerBlocking) attackWeight *= 0.6;
        if (this.type === 'captain' && this.blockedByPlayerCount >= 3) attackWeight += 0.35;

        let blockWeight = playerAttacking ? 0.4 + blockChance * 0.8 : 0.1 + blockChance * 0.2;
        if (!inAttackRange) blockWeight *= 0.5;

        let retreatWeight = healthPercent < 0.3 ? 0.7 : 0.1;
        if (this.rallyActive) retreatWeight *= 0.4;
        let advanceWeight = inAttackRange ? 0.1 : 0.5;

        const total = attackWeight + blockWeight + retreatWeight + advanceWeight;
        if (total <= 0) return 'advance';

        const roll = Math.random() * total;
        if (roll < attackWeight) return 'attack';
        if (roll < attackWeight + blockWeight) return 'block';
        if (roll < attackWeight + blockWeight + retreatWeight) return 'retreat';
        return 'advance';
    }

    private setState(newState: GuardState, investigateX?: number): void {
        this.state = newState;
        this.stateTimer = 0;
        this.actionTimer = 0;
        this.attackHitbox = null;
        this.attackDamage = 1;
        this.attackIgnoresBlock = false;
        this.isBlocking = false;
        this.advanceTimer = 0;

        if (newState !== 'attacking') {
            this.attackWindows = [];
            this.attackVariant = 'normal';
        }

        if (newState === 'suspicious') {
            this.investigateX = typeof investigateX === 'number' ? investigateX : this.x;
        }

        if (newState === 'idle') {
            this.idleDuration = 0.8 + Math.random() * 1.2;
        }
    }

    private getAdvanceSpeed(): number {
        let speed = this.stats.advanceSpeed;
        if (this.type === 'shadow' && this.shadowPhase === 2) {
            speed *= 1.15;
        }
        if (this.rallyActive) {
            speed *= 1.1;
        }
        return speed;
    }

    private getRetreatSpeed(): number {
        let speed = this.stats.retreatSpeed;
        if (this.rallyActive) {
            speed *= 1.05;
        }
        return speed;
    }

    onAttackBlocked(): void {
        if (this.state !== 'attacking') return;
        if (this.type === 'captain') {
            this.blockedByPlayerCount = Math.min(5, this.blockedByPlayerCount + 1);
        }
        this.combatCooldown = 0.6;
        this.setState('stunned');
    }

    takeDamage(amount: number = 1): void {
        if (this.state === 'dead' || this.state === 'dying' || this.state === 'knocked_out') return;
        if (this.damageCooldown > 0) return;

        this.health -= amount;
        this.damageCooldown = 0.25;
        this.flashTimer = 0.12; // White flash on hit (P3-3.2)

        if (this.health <= 0) {
            this.setState('dying');
            this.onDeath?.(this);
        } else {
            this.setState('stunned');
        }
    }

    stagger(): void {
        if (this.state === 'dead' || this.state === 'dying' || this.state === 'knocked_out') return;
        this.setState('stunned');
        this.flashTimer = 0.12;
    }

    knockOut(): void {
        if (this.state === 'dead' || this.state === 'knocked_out') return;
        this.state = 'knocked_out';
        this.stateTimer = 0;
        this.knockoutTimer = 5;
        this.attackHitbox = null;
        this.isBlocking = false;
        this.animTimer = 0;
    }

    // Offscreen canvas for flash effect (shared across guards)
    private static flashCanvas: HTMLCanvasElement | null = null;
    private static flashCtx: CanvasRenderingContext2D | null = null;

    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (this.state === 'dead') return;

        const screenX = Math.floor(this.x - camX);
        const screenY = Math.floor(this.y - camY);

        if (this.flashTimer > 0) {
            // Render to offscreen canvas so source-atop only affects sprite pixels
            const bufW = 64;
            const bufH = 56;
            if (!Guard.flashCanvas || Guard.flashCanvas.width !== bufW || Guard.flashCanvas.height !== bufH) {
                Guard.flashCanvas = document.createElement('canvas');
                Guard.flashCanvas.width = bufW;
                Guard.flashCanvas.height = bufH;
                Guard.flashCtx = Guard.flashCanvas.getContext('2d');
            }
            const offCtx = Guard.flashCtx!;
            offCtx.clearRect(0, 0, bufW, bufH);
            offCtx.save();
            if (!this.facingRight) {
                offCtx.translate(bufW, 0);
                offCtx.scale(-1, 1);
            }
            this.drawBody(offCtx);
            const flashAlpha = Math.min(0.7, this.flashTimer / 0.12);
            offCtx.globalCompositeOperation = 'source-atop';
            offCtx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            offCtx.fillRect(0, 0, bufW, bufH);
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.restore();
            if (!this.facingRight) {
                ctx.drawImage(Guard.flashCanvas, screenX - (bufW - this.width), screenY);
            } else {
                ctx.drawImage(Guard.flashCanvas, screenX, screenY);
            }
        } else {
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
    }

    private drawBody(ctx: CanvasRenderingContext2D): void {
        // Knocked out recruit: collapsed on ground, face-down
        if (this.state === 'knocked_out') {
            const colors = GUARD_COLORS[this.type];
            // Legs flat
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 42, 24, 6);
            // Torso flat
            ctx.fillStyle = colors.armor;
            ctx.fillRect(0, 34, 24, 8);
            // Head face-down
            ctx.fillStyle = colors.skin ?? colors.helmet;
            ctx.fillRect(2, 30, 10, 6);
            ctx.fillStyle = colors.helmet;
            ctx.fillRect(2, 30, 10, 3);
            // Recovery pulse: blink when about to get up
            if (this.knockoutTimer < 1.5 && Math.floor(this.knockoutTimer * 4) % 2 === 0) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#ffff88';
                ctx.fillRect(0, 28, 24, 20);
                ctx.globalAlpha = 1;
            }
            return;
        }

        const isHurt = this.state === 'stunned' || this.state === 'dying';
        const isDying = this.state === 'dying';
        const isIdle = this.state === 'idle' || this.state === 'combat_ready';
        const isMoving = this.state === 'patrol' || this.state === 'alert' || this.state === 'suspicious' ||
            this.state === 'retreating' || (this.state === 'combat_ready' && this.advanceTimer > 0);
        const colors = GUARD_COLORS[this.type];
        const isRecruit = this.type === 'recruit';
        const isSoldier = this.type === 'soldier';
        const isVeteran = this.type === 'veteran';
        const isCaptain = this.type === 'captain';
        const isShadow = this.type === 'shadow';

        // Breathing idle bob (P3-1.4)
        const idleBob = isIdle && !isMoving ? Math.sin(this.animTimer * 2.5) * 1.5 : 0;

        // Dramatic death sequence (P3-1.4)
        const deathFrame = isDying ? Math.min(3, Math.floor(this.stateTimer / 0.25)) : -1;

        // Shadow glow effect (drawn first, behind everything)
        if (isShadow) {
            ctx.save();
            ctx.shadowColor = colors.accent ?? '#8800ff';
            ctx.shadowBlur = 15 + Math.sin(this.animTimer * 4) * 5;
            ctx.fillStyle = 'rgba(136, 0, 255, 0.3)';
            ctx.fillRect(-4, -4, 32, 56);
            ctx.restore();
        }

        // ===== LEGS =====
        ctx.fillStyle = '#2a2a2a';
        if (isMoving) {
            const legOffset = Math.sin(this.animFrame * Math.PI / 2) * 4;
            ctx.fillRect(4, 32 + legOffset, 6, 14 - legOffset);
            ctx.fillRect(14, 32 - legOffset, 6, 14 + legOffset);
        } else if (isDying) {
            if (deathFrame <= 0) {
                // Stagger
                ctx.fillRect(4, 34, 6, 12);
                ctx.fillRect(14, 36, 6, 10);
            } else if (deathFrame === 1) {
                // Knees
                ctx.fillRect(6, 38, 5, 8);
                ctx.fillRect(13, 39, 5, 7);
            } else {
                // Collapsed
                ctx.fillRect(0, 44, 24, 4);
            }
        } else {
            ctx.fillRect(4, 34 + idleBob, 6, 14);
            ctx.fillRect(14, 34 + idleBob, 6, 14);
        }

        // ===== TORSO =====
        ctx.fillStyle = isHurt ? colors.armorHurt : colors.armor;
        if (isDying) {
            if (deathFrame <= 0) {
                ctx.fillRect(4, 18, 16, 16);
            } else if (deathFrame === 1) {
                ctx.fillRect(4, 24, 16, 14);
            } else {
                ctx.fillRect(0, 36, 24, 8);
            }
        } else if (isRecruit) {
            // Recruit: narrow leather vest
            const breatheW = isIdle ? Math.sin(this.animTimer * 2.5) * 0.4 : 0;
            const tw = Math.floor(14 + breatheW);
            ctx.fillRect(5 + Math.floor((14 - tw) / 2), 14 + idleBob, tw, 20);
            // Skin-colored sides visible
            ctx.fillStyle = colors.skin ?? '#ffcc99';
            ctx.fillRect(3, 16 + idleBob, 3, 14);
            ctx.fillRect(18, 16 + idleBob, 3, 14);
        } else if (isVeteran) {
            // Veteran: wider heavy armor
            const breatheW = isIdle ? Math.sin(this.animTimer * 2.5) * 0.4 : 0;
            const tw = Math.floor(18 + breatheW);
            ctx.fillRect(3 + Math.floor((18 - tw) / 2), 14 + idleBob, tw, 20);
            // Diagonal scar across torso
            ctx.fillStyle = '#3a3a44';
            ctx.fillRect(7, 18 + idleBob, 2, 2);
            ctx.fillRect(9, 20 + idleBob, 2, 2);
            ctx.fillRect(11, 22 + idleBob, 2, 2);
            ctx.fillRect(13, 24 + idleBob, 2, 2);
        } else {
            // Soldier / Captain / Shadow: standard torso
            const breatheW = isIdle ? Math.sin(this.animTimer * 2.5) * 0.4 : 0;
            const tw = Math.floor(16 + breatheW);
            ctx.fillRect(4 + Math.floor((16 - tw) / 2), 14 + idleBob, tw, 20);
            // Soldier chainmail detail at bottom of torso
            if (isSoldier) {
                ctx.fillStyle = '#882222';
                ctx.fillRect(5, 32 + idleBob, 14, 2);
            }
        }

        // ===== VETERAN PAULDRONS =====
        if (isVeteran && !isDying) {
            ctx.fillStyle = colors.accent ?? '#667788';
            ctx.fillRect(0, 14 + idleBob, 5, 6);
            ctx.fillRect(19, 14 + idleBob, 5, 6);
        }

        // ===== CAPTAIN PAULDRONS =====
        if (isCaptain && !isDying && colors.accent) {
            ctx.fillStyle = colors.accent;
            ctx.fillRect(0, 12 + idleBob, 6, 8);
            ctx.fillRect(18, 12 + idleBob, 6, 8);
            ctx.fillStyle = '#ffe066';
            ctx.fillRect(1, 13 + idleBob, 2, 3);
            ctx.fillRect(19, 13 + idleBob, 2, 3);
        }

        // ===== ARMS =====
        const armColor = isRecruit ? (colors.skin ?? '#ffcc99') : colors.armor;
        const armWidth = isRecruit ? 3 : 4;
        ctx.fillStyle = armColor;
        if (this.state === 'attacking') {
            // Attack telegraph glow (P3-1.4)
            if (this.stateTimer < this.attackDuration * 0.3) {
                ctx.save();
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = isShadow ? '#8800ff' : '#ff6644';
                ctx.fillRect(16, 10, 14, 10);
                ctx.restore();
                ctx.fillStyle = armColor;
            }
            if (isRecruit) {
                // Recruit punch: arm extends with fist
                const punchProgress = Math.min(1, this.stateTimer / (this.attackDuration * 0.5));
                const extend = punchProgress * 12;
                ctx.fillRect(20 + extend, 16, 4, 4); // arm
                ctx.fillRect(23 + extend, 15, 5, 6); // fist
            } else {
                ctx.fillRect(20, 16, 16, armWidth);
            }
        } else if (this.state === 'blocking') {
            ctx.fillRect(18, 6, 6, 16);
        } else if (isDying) {
            if (deathFrame >= 2) {
                ctx.fillRect(0, 32, 4, 4);
                ctx.fillRect(20, 32, 4, 4);
            } else {
                ctx.fillRect(0, 18, 4, 10);
                ctx.fillRect(20, 20, 4, 8);
            }
        } else {
            ctx.fillRect(0, 16 + idleBob, armWidth, 12);
            ctx.fillRect(24 - armWidth, 16 + idleBob, armWidth, 12);
        }

        // ===== HELMET =====
        ctx.fillStyle = colors.helmet;
        if (isDying) {
            if (deathFrame >= 2) {
                ctx.fillRect(0, 28, 10, 8);
            } else {
                ctx.fillRect(4, deathFrame === 0 ? 4 : 10, 16, 14);
                ctx.fillStyle = colors.visor;
                ctx.fillRect(12, deathFrame === 0 ? 8 : 14, 6, 6);
            }
        } else if (isRecruit) {
            // Recruit: small leather cap (shorter, open face)
            ctx.fillRect(6, 2 + idleBob, 12, 10);
            // Open face — skin-colored chin/lower face
            ctx.fillStyle = colors.skin ?? '#ffcc99';
            ctx.fillRect(6, 10 + idleBob, 12, 4);
            // Two dot eyes
            ctx.fillStyle = '#2a1a0a';
            ctx.fillRect(12, 6 + idleBob, 2, 2);
            ctx.fillRect(16, 6 + idleBob, 2, 2);
        } else if (isVeteran) {
            // Veteran: wider full helm with nose guard
            ctx.fillRect(3, 0 + idleBob, 18, 14);
            ctx.fillStyle = colors.visor;
            ctx.fillRect(12, 4 + idleBob, 7, 6);
            // Nose guard — vertical bar over visor
            ctx.fillStyle = colors.helmet;
            ctx.fillRect(14, 4 + idleBob, 2, 8);
        } else {
            // Soldier / Captain / Shadow: standard full helm
            ctx.fillRect(4, 0 + idleBob, 16, 14);
            ctx.fillStyle = colors.visor;
            ctx.fillRect(12, 4 + idleBob, 6, 6);

            // Captain red plume
            if (isCaptain) {
                ctx.fillStyle = '#cc2222';
                ctx.fillRect(8, -8 + idleBob, 4, 10);
                ctx.fillRect(6, -12 + idleBob, 8, 6);
                ctx.fillStyle = '#ff4444';
                ctx.fillRect(7, -10 + idleBob, 2, 4);
            }

            // Captain gold crest
            if (isCaptain && colors.accent) {
                ctx.fillStyle = colors.accent;
                ctx.fillRect(6, 0 + idleBob, 12, 3);
            }
        }

        // ===== SWORD =====
        if (!isRecruit) {
            // Recruits have no weapon — they punch
            ctx.fillStyle = colors.sword;
            if (this.state === 'attacking') {
                if (isCaptain) {
                    ctx.fillRect(36, 12, 26, 5);
                    ctx.fillStyle = colors.accent ?? '#ffcc00';
                    ctx.fillRect(32, 10, 6, 9);
                } else if (isShadow) {
                    ctx.save();
                    ctx.shadowColor = colors.accent ?? '#8800ff';
                    ctx.shadowBlur = 8;
                    ctx.fillRect(36, 14, 24, 3);
                    ctx.restore();
                } else if (isVeteran) {
                    // Heavy broad slash
                    ctx.fillRect(36, 12, 22, 5);
                } else {
                    ctx.fillRect(36, 14, 20, 3);
                }
            } else if (this.state === 'blocking') {
                ctx.fillRect(22, 4, 4, 18);
            } else if (!isDying) {
                if (isCaptain) {
                    ctx.fillRect(22, 18 + idleBob, 18, 3);
                } else if (isVeteran) {
                    // Broad greatsword at side
                    ctx.fillRect(22, 18 + idleBob, 16, 3);
                } else {
                    ctx.fillRect(22, 20 + idleBob, 14, 2);
                }
            } else if (isDying && deathFrame >= 2) {
                // Dropped sword on ground
                ctx.fillRect(12, 42, 14, 2);
            }
        }
    }

    get left(): number { return this.x; }
    get right(): number { return this.x + this.width; }
    get top(): number { return this.y; }
    get bottom(): number { return this.y + this.height; }
    get centerX(): number { return this.x + this.width / 2; }
    get isAlive(): boolean { return this.state !== 'dead' && this.state !== 'dying' && this.state !== 'knocked_out'; }
    get isDying(): boolean { return this.state === 'dying'; }
}
