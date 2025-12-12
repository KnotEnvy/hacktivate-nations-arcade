// ===== src/games/tapdodge/entities/Player.ts =====

export class Player {
    // Position and movement
    public x: number;
    public y: number;
    public targetX: number;
    public readonly width: number = 40;
    public readonly height: number = 40;

    // Lane system
    private currentLane: number = 2; // 0-4, starting middle
    private readonly laneCount: number = 5;
    private canvasWidth: number;

    // Movement smoothing
    private readonly lerpSpeed: number = 12;

    // Visual state
    private trailPoints: { x: number; y: number; alpha: number }[] = [];
    private pulsePhase: number = 0;

    // Damage state
    private invulnTime: number = 0;
    private blinkTimer: number = 0;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.y = canvasHeight - 80;
        this.x = this.getLaneX(this.currentLane);
        this.targetX = this.x;
    }

    private getLaneX(lane: number): number {
        const laneWidth = this.canvasWidth / this.laneCount;
        return lane * laneWidth + (laneWidth - this.width) / 2;
    }

    public moveLeft(): void {
        if (this.currentLane > 0) {
            this.currentLane--;
            this.targetX = this.getLaneX(this.currentLane);
        }
    }

    public moveRight(): void {
        if (this.currentLane < this.laneCount - 1) {
            this.currentLane++;
            this.targetX = this.getLaneX(this.currentLane);
        }
    }

    public moveToPosition(targetX: number): void {
        // Clamp target position
        const clampedX = Math.max(0, Math.min(this.canvasWidth - this.width, targetX - this.width / 2));
        this.targetX = clampedX;

        // Update current lane based on position
        const laneWidth = this.canvasWidth / this.laneCount;
        this.currentLane = Math.floor((clampedX + this.width / 2) / laneWidth);
        this.currentLane = Math.max(0, Math.min(this.laneCount - 1, this.currentLane));
    }

    public getCurrentLane(): number {
        return this.currentLane;
    }

    public update(dt: number): void {
        // Smooth movement interpolation
        const dx = this.targetX - this.x;
        this.x += dx * this.lerpSpeed * dt;

        // Update trail
        this.trailPoints.push({
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            alpha: 0.6
        });

        // Limit trail length
        if (this.trailPoints.length > 15) {
            this.trailPoints.shift();
        }

        // Fade trail
        for (const point of this.trailPoints) {
            point.alpha = Math.max(0, point.alpha - dt * 2);
        }
        this.trailPoints = this.trailPoints.filter(p => p.alpha > 0);

        // Update invulnerability
        if (this.invulnTime > 0) {
            this.invulnTime -= dt;
            this.blinkTimer += dt;
        }

        // Pulse animation
        this.pulsePhase += dt * 4;
    }

    public takeDamage(): boolean {
        if (this.invulnTime > 0) {
            return false; // Still invulnerable
        }
        this.invulnTime = 1.0;
        this.blinkTimer = 0;
        return true;
    }

    public setInvulnerable(duration: number): void {
        this.invulnTime = Math.max(this.invulnTime, duration);
    }

    public isInvulnerable(): boolean {
        return this.invulnTime > 0;
    }

    public getInvulnTime(): number {
        return this.invulnTime;
    }

    public getBounds(): { x: number; y: number; w: number; h: number } {
        // Slightly smaller hitbox for fairness
        const margin = 4;
        return {
            x: this.x + margin,
            y: this.y + margin,
            w: this.width - margin * 2,
            h: this.height - margin * 2
        };
    }

    public getCenterX(): number {
        return this.x + this.width / 2;
    }

    public getCenterY(): number {
        return this.y + this.height / 2;
    }

    public render(ctx: CanvasRenderingContext2D, hasShield: boolean = false, hasGhost: boolean = false): void {
        // Render trail
        for (const point of this.trailPoints) {
            ctx.globalAlpha = point.alpha * 0.4;
            ctx.fillStyle = hasGhost ? '#A78BFA' : '#22D3EE';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Blink during invulnerability
        if (this.invulnTime > 0) {
            const blink = Math.sin(this.blinkTimer * 20) > 0;
            ctx.globalAlpha = blink ? 0.4 : 0.9;
        }

        // Ghost effect
        if (hasGhost) {
            ctx.globalAlpha *= 0.5;
        }

        // Player body - cyberpunk style
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const pulse = Math.sin(this.pulsePhase) * 0.1 + 1;

        // Outer glow
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.width * 0.8);
        gradient.addColorStop(0, hasGhost ? 'rgba(167, 139, 250, 0.3)' : 'rgba(34, 211, 238, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - 10, this.y - 10, this.width + 20, this.height + 20);

        // Main body (diamond shape)
        ctx.fillStyle = hasGhost ? '#A78BFA' : '#22D3EE';
        ctx.beginPath();
        ctx.moveTo(cx, this.y); // Top
        ctx.lineTo(this.x + this.width, cy); // Right
        ctx.lineTo(cx, this.y + this.height); // Bottom
        ctx.lineTo(this.x, cy); // Left
        ctx.closePath();
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = hasGhost ? '#C4B5FD' : '#67E8F9';
        const innerSize = this.width * 0.4 * pulse;
        ctx.beginPath();
        ctx.moveTo(cx, cy - innerSize / 2);
        ctx.lineTo(cx + innerSize / 2, cy);
        ctx.lineTo(cx, cy + innerSize / 2);
        ctx.lineTo(cx - innerSize / 2, cy);
        ctx.closePath();
        ctx.fill();

        // Core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        // Shield aura
        if (hasShield) {
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, 30 + Math.sin(this.pulsePhase * 2) * 3, 0, Math.PI * 2);
            ctx.stroke();

            // Shield particles
            for (let i = 0; i < 6; i++) {
                const angle = this.pulsePhase + (Math.PI * 2 * i) / 6;
                const px = cx + Math.cos(angle) * 28;
                const py = cy + Math.sin(angle) * 28;
                ctx.fillStyle = '#22D3EE';
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    public resize(canvasWidth: number, canvasHeight: number): void {
        this.canvasWidth = canvasWidth;
        this.y = canvasHeight - 80;
        this.targetX = this.getLaneX(this.currentLane);
        this.x = this.targetX;
    }
}
