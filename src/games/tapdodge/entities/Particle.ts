// ===== src/games/tapdodge/entities/Particle.ts =====

export interface ParticleConfig {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
    gravity?: number;
    friction?: number;
    fadeRate?: number;
    shrink?: boolean;
    shape?: 'circle' | 'square' | 'star' | 'line';
}

export class Particle {
    public x: number;
    public y: number;
    public vx: number;
    public vy: number;
    public life: number;
    public maxLife: number;
    public color: string;
    public size: number;
    public gravity: number;
    public friction: number;
    public fadeRate: number;
    public shrink: boolean;
    public shape: 'circle' | 'square' | 'star' | 'line';

    // State
    public alpha: number = 1;
    private rotation: number = Math.random() * Math.PI * 2;
    private rotationSpeed: number = (Math.random() - 0.5) * 10;

    constructor(config: ParticleConfig) {
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx;
        this.vy = config.vy;
        this.life = config.life;
        this.maxLife = config.life;
        this.color = config.color;
        this.size = config.size;
        this.gravity = config.gravity ?? 200;
        this.friction = config.friction ?? 0.98;
        this.fadeRate = config.fadeRate ?? 1;
        this.shrink = config.shrink ?? true;
        this.shape = config.shape ?? 'circle';
    }

    public update(dt: number): boolean {
        // Apply physics
        this.vy += this.gravity * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Decay
        this.life -= dt * this.fadeRate;
        this.alpha = Math.max(0, this.life / this.maxLife);

        if (this.shrink) {
            this.size = this.size * (0.5 + this.alpha * 0.5);
        }

        // Rotation
        this.rotation += this.rotationSpeed * dt;

        return this.life > 0;
    }

    public render(ctx: CanvasRenderingContext2D): void {
        if (this.alpha <= 0 || this.size <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        switch (this.shape) {
            case 'square':
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
                break;

            case 'star':
                this.renderStar(ctx, this.size);
                break;

            case 'line':
                ctx.strokeStyle = this.color;
                ctx.lineWidth = Math.max(1, this.size / 3);
                ctx.beginPath();
                ctx.moveTo(-this.size, 0);
                ctx.lineTo(this.size, 0);
                ctx.stroke();
                break;

            default: // circle
                ctx.beginPath();
                ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                ctx.fill();
        }

        ctx.restore();
    }

    private renderStar(ctx: CanvasRenderingContext2D, size: number): void {
        const spikes = 4;
        const outerRadius = size / 2;
        const innerRadius = size / 4;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}
