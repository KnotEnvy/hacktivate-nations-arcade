// ===== src/games/tapdodge/entities/PowerUp.ts =====

export type PowerUpType = 'shield' | 'magnet' | 'slow' | 'ghost' | 'drone';

export interface PowerUpConfig {
    shield: { duration: number; color: string; icon: string };
    magnet: { duration: number; color: string; icon: string };
    slow: { duration: number; color: string; icon: string };
    ghost: { duration: number; color: string; icon: string };
    drone: { duration: number; color: string; icon: string };
}

export const POWERUP_CONFIG: PowerUpConfig = {
    shield: { duration: 3, color: '#22D3EE', icon: '🛡️' },
    magnet: { duration: 6, color: '#F59E0B', icon: '🧲' },
    slow: { duration: 4, color: '#8B5CF6', icon: '⏳' },
    ghost: { duration: 3, color: '#A78BFA', icon: '👻' },
    drone: { duration: 8, color: '#60A5FA', icon: '🔫' }
};

export class PowerUp {
    public x: number;
    public y: number;
    public readonly size: number = 28;
    public speed: number;
    public type: PowerUpType;

    // Animation
    private pulsePhase: number = Math.random() * Math.PI * 2;
    private rotationAngle: number = 0;
    private orbitPhase: number = 0;

    // State
    public isCollected: boolean = false;

    constructor(x: number, y: number, speed: number, type: PowerUpType) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.type = type;
    }

    public getConfig() {
        return POWERUP_CONFIG[this.type];
    }

    public getDuration(): number {
        return this.getConfig().duration;
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        // Move down
        this.y += this.speed * speedMultiplier * dt;

        // Animate
        this.pulsePhase += dt * 5;
        this.rotationAngle += dt * 2;
        this.orbitPhase += dt * 3;
    }

    public getBounds(): { x: number; y: number; w: number; h: number } {
        return {
            x: this.x - this.size / 2,
            y: this.y - this.size / 2,
            w: this.size,
            h: this.size
        };
    }

    public isOffScreen(canvasHeight: number): boolean {
        return this.y > canvasHeight + this.size || this.isCollected;
    }

    public collect(): void {
        this.isCollected = true;
    }

    public render(ctx: CanvasRenderingContext2D): void {
        if (this.isCollected) return;

        const config = this.getConfig();
        const pulse = Math.sin(this.pulsePhase) * 0.15 + 1;
        const size = this.size * pulse;

        // Outer glow ring
        const glowRadius = size * 1.5;
        const glowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        glowGradient.addColorStop(0, config.color + '60');
        glowGradient.addColorStop(0.5, config.color + '30');
        glowGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Orbiting particles
        for (let i = 0; i < 4; i++) {
            const angle = this.orbitPhase + (Math.PI * 2 * i) / 4;
            const orbitRadius = size * 0.8;
            const px = this.x + Math.cos(angle) * orbitRadius;
            const py = this.y + Math.sin(angle) * orbitRadius;

            ctx.fillStyle = config.color;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main container - hexagonal
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle * 0.3);

        // Hexagon background
        ctx.fillStyle = config.color + '40';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const hx = Math.cos(angle) * (size / 2);
            const hy = Math.sin(angle) * (size / 2);
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();

        // Hexagon border
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        // Icon in center
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(config.icon, this.x, this.y);

        // Type-specific effects
        this.renderTypeEffect(ctx, config.color);
    }

    private renderTypeEffect(ctx: CanvasRenderingContext2D, color: string): void {
        switch (this.type) {
            case 'shield':
                // Shield rings
                ctx.strokeStyle = color + '60';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 0.8 + Math.sin(this.pulsePhase * 2) * 4, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'magnet':
                // Magnetic field lines
                ctx.strokeStyle = color + '40';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    const offset = (this.pulsePhase + i * 0.5) % 1;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * (0.6 + offset * 0.6), 0, Math.PI * 2);
                    ctx.globalAlpha = 1 - offset;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                break;

            case 'slow':
                // Clock hands effect
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                const handAngle = -this.pulsePhase * 0.5;
                ctx.lineTo(
                    this.x + Math.cos(handAngle) * 8,
                    this.y + Math.sin(handAngle) * 8
                );
                ctx.stroke();
                break;

            case 'ghost':
                // Ghostly wisps
                ctx.strokeStyle = '#FFFFFF40';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    const wispY = this.y + 10 + i * 5;
                    const waveX = Math.sin(this.pulsePhase + i) * 10;
                    ctx.beginPath();
                    ctx.moveTo(this.x - 10 + waveX, wispY);
                    ctx.quadraticCurveTo(this.x, wispY - 5, this.x + 10 + waveX, wispY);
                    ctx.stroke();
                }
                break;

            case 'drone':
                // Targeting reticle
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                const reticleSize = 20 + Math.sin(this.pulsePhase * 3) * 3;
                ctx.beginPath();
                ctx.moveTo(this.x - reticleSize, this.y);
                ctx.lineTo(this.x - reticleSize / 2, this.y);
                ctx.moveTo(this.x + reticleSize / 2, this.y);
                ctx.lineTo(this.x + reticleSize, this.y);
                ctx.moveTo(this.x, this.y - reticleSize);
                ctx.lineTo(this.x, this.y - reticleSize / 2);
                ctx.moveTo(this.x, this.y + reticleSize / 2);
                ctx.lineTo(this.x, this.y + reticleSize);
                ctx.stroke();
                break;
        }
    }
}
