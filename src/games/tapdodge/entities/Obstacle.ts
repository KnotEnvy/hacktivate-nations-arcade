// ===== src/games/tapdodge/entities/Obstacle.ts =====

export type ObstacleType = 'block' | 'spike' | 'wall' | 'moving';

export interface ObstacleConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    type?: ObstacleType;
    gapLane?: number; // For wall type - which lane has the gap
    movingRange?: number; // For moving type - horizontal oscillation
    isDestructible?: boolean;
}

export class Obstacle {
    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public speed: number;
    public type: ObstacleType;

    // Movement
    private startX: number;
    private movingRange: number;
    private movingPhase: number = 0;

    // State
    public isNearMissed: boolean = false;
    public isDestructible: boolean;
    public isDestroyed: boolean = false;

    // Visual
    private glowPhase: number = Math.random() * Math.PI * 2;
    private warningAlpha: number = 0;

    constructor(config: ObstacleConfig) {
        this.x = config.x;
        this.y = config.y;
        this.width = config.width;
        this.height = config.height;
        this.speed = config.speed;
        this.type = config.type || 'block';
        this.startX = config.x;
        this.movingRange = config.movingRange || 0;
        this.isDestructible = config.isDestructible ?? (this.type === 'block');
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        // Move down
        this.y += this.speed * speedMultiplier * dt;

        // Horizontal movement for moving type
        if (this.type === 'moving' && this.movingRange > 0) {
            this.movingPhase += dt * 3;
            this.x = this.startX + Math.sin(this.movingPhase) * this.movingRange;
        }

        // Glow animation
        this.glowPhase += dt * 4;

        // Warning flash when close to player
        if (this.y > 300) {
            this.warningAlpha = Math.min(1, (this.y - 300) / 200);
        }
    }

    public getBounds(): { x: number; y: number; w: number; h: number } {
        return {
            x: this.x,
            y: this.y,
            w: this.width,
            h: this.height
        };
    }

    public isOffScreen(canvasHeight: number): boolean {
        return this.y > canvasHeight + this.height || this.isDestroyed;
    }

    public destroy(): void {
        this.isDestroyed = true;
    }

    public render(ctx: CanvasRenderingContext2D): void {
        if (this.isDestroyed) return;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Warning glow
        if (this.warningAlpha > 0) {
            ctx.globalAlpha = this.warningAlpha * 0.3;
            const warnGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.width);
            warnGradient.addColorStop(0, '#EF4444');
            warnGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = warnGradient;
            ctx.fillRect(this.x - 20, this.y - 20, this.width + 40, this.height + 40);
            ctx.globalAlpha = 1;
        }

        switch (this.type) {
            case 'spike':
                this.renderSpike(ctx);
                break;
            case 'wall':
                this.renderWall(ctx);
                break;
            case 'moving':
                this.renderMoving(ctx);
                break;
            default:
                this.renderBlock(ctx);
        }

        // Near-miss indicator
        if (this.isNearMissed) {
            ctx.strokeStyle = '#60A5FA';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
            ctx.setLineDash([]);
        }
    }

    private renderBlock(ctx: CanvasRenderingContext2D): void {
        // Main body - red danger block
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, '#EF4444');
        gradient.addColorStop(0.5, '#DC2626');
        gradient.addColorStop(1, '#B91C1C');

        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Inner pattern
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const patternSize = 8;
        for (let px = this.x + 4; px < this.x + this.width - 4; px += patternSize * 2) {
            for (let py = this.y + 4; py < this.y + this.height - 4; py += patternSize * 2) {
                ctx.fillRect(px, py, patternSize, patternSize);
            }
        }

        // Highlight edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(this.x, this.y, this.width, 3);
        ctx.fillRect(this.x, this.y, 3, this.height);

        // Glow effect
        const glow = Math.sin(this.glowPhase) * 0.2 + 0.3;
        ctx.strokeStyle = `rgba(239, 68, 68, ${glow})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
    }

    private renderSpike(ctx: CanvasRenderingContext2D): void {
        const cx = this.x + this.width / 2;

        // Spike triangle
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(cx, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Core glow
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.moveTo(cx, this.y + this.height * 0.3);
        ctx.lineTo(this.x + this.width * 0.7, this.y + this.height);
        ctx.lineTo(this.x + this.width * 0.3, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Tip glow
        const tipGlow = Math.sin(this.glowPhase) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${tipGlow})`;
        ctx.beginPath();
        ctx.arc(cx, this.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    private renderWall(ctx: CanvasRenderingContext2D): void {
        // Wall with a pattern
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Brick pattern
        ctx.fillStyle = '#991B1B';
        const brickW = 20;
        const brickH = 10;
        let offset = 0;
        for (let py = this.y; py < this.y + this.height; py += brickH) {
            for (let px = this.x + offset; px < this.x + this.width; px += brickW) {
                ctx.fillRect(px + 1, py + 1, brickW - 2, brickH - 2);
            }
            offset = offset === 0 ? brickW / 2 : 0;
        }
    }

    private renderMoving(ctx: CanvasRenderingContext2D): void {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Moving obstacle with electric effect
        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Electric arcs
        ctx.strokeStyle = `rgba(167, 139, 250, ${Math.sin(this.glowPhase * 3) * 0.5 + 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, cy);
        ctx.lineTo(cx, cy + Math.sin(this.glowPhase * 5) * 8);
        ctx.lineTo(this.x + this.width, cy);
        ctx.stroke();

        // Direction indicators
        const arrowSize = 8;
        ctx.fillStyle = '#C4B5FD';

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(this.x + 5, cy);
        ctx.lineTo(this.x + 5 + arrowSize, cy - arrowSize / 2);
        ctx.lineTo(this.x + 5 + arrowSize, cy + arrowSize / 2);
        ctx.closePath();
        ctx.fill();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(this.x + this.width - 5, cy);
        ctx.lineTo(this.x + this.width - 5 - arrowSize, cy - arrowSize / 2);
        ctx.lineTo(this.x + this.width - 5 - arrowSize, cy + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
    }
}
