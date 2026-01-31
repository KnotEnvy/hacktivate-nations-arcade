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
    | 'dead';

export type GuardType = 'recruit' | 'soldier' | 'veteran' | 'captain' | 'shadow';

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
    recruit: { maxHealth: 1, blockChance: 0.2, reactionTime: 0.5, aggression: 0.3, patrolSpeed: 22, advanceSpeed: 55, retreatSpeed: 70 },
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
    private chargeDirection: number = 1;

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

        this.animTimer += dt;
        if (this.combatCooldown > 0) this.combatCooldown -= dt;
        if (this.damageCooldown > 0) this.damageCooldown -= dt;
        this.stateTimer += dt;

        const distToPlayer = Math.abs(sense.playerX - this.x);
        const sameLevel = Math.abs(sense.playerY - this.y) < TILE_SIZE;
        const canSeePlayer = distToPlayer < this.visionRange && sameLevel;
        const inCombatRange = distToPlayer < this.combatRange && sameLevel;
        const inAttackRange = distToPlayer < this.attackRange && sameLevel;
        const heardPlayer = sense.playerNoise && distToPlayer < this.hearingRange;
        const healthPercent = this.health / this.maxHealth;
        this.shadowPhase = this.type === 'shadow'
            ? (healthPercent > 0.7 ? 1 : healthPercent > 0.3 ? 2 : 3)
            : 0;
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
        if (this.state === 'dead' || this.state === 'dying') return;
        if (this.damageCooldown > 0) return;

        this.health -= amount;
        this.damageCooldown = 0.25;

        if (this.health <= 0) {
            this.setState('dying');
        } else {
            this.setState('stunned');
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
        const isHurt = this.state === 'stunned' || this.state === 'dying';
        const isDying = this.state === 'dying';
        const isMoving = this.state === 'patrol' || this.state === 'alert' || this.state === 'suspicious' ||
            this.state === 'retreating' || (this.state === 'combat_ready' && this.advanceTimer > 0);

        // Legs
        ctx.fillStyle = '#2a2a2a';
        if (isMoving) {
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
        if (this.state === 'attacking') {
            ctx.fillRect(20, 16, 16, 4);
        } else if (this.state === 'blocking') {
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
        if (this.state === 'attacking') {
            ctx.fillRect(36, 14, 20, 3);
        } else if (this.state === 'blocking') {
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
    get isAlive(): boolean { return this.state !== 'dead' && this.state !== 'dying'; }
    get isDying(): boolean { return this.state === 'dying'; }
}
