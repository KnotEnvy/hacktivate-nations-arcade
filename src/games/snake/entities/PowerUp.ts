// ===== src/games/snake/entities/PowerUp.ts =====

export type SnakePowerUpType = 'wrap' | 'slow' | 'double' | 'magnet' | 'ghost';

export interface PowerUpConfig {
    type: SnakePowerUpType;
    color: string;
    icon: string;
    label: string;
    duration: number;
}

export const POWERUP_CONFIGS: Record<SnakePowerUpType, PowerUpConfig> = {
    wrap: { type: 'wrap', color: '#A855F7', icon: '⭮', label: 'Wrap Walls', duration: 8 },
    slow: { type: 'slow', color: '#38BDF8', icon: '❄', label: 'Slow Time', duration: 6 },
    double: { type: 'double', color: '#FBBF24', icon: '⚡', label: 'Double Growth', duration: 7 },
    magnet: { type: 'magnet', color: '#3B82F6', icon: '🧲', label: 'Magnet', duration: 8 },
    ghost: { type: 'ghost', color: '#E5E7EB', icon: '👻', label: 'Ghost', duration: 5 },
};

export class PowerUp {
    public x: number;
    public y: number;
    public type: SnakePowerUpType;
    private gridSize: number;
    private pulsePhase: number = 0;
    private rotationPhase: number = 0;
    private lifetime: number = 0;
    private maxLifetime: number;
    private blinkTime: number;

    constructor(
        x: number,
        y: number,
        gridSize: number,
        type: SnakePowerUpType,
        lifetime: number = 8,
        blinkTime: number = 1.2
    ) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.type = type;
        this.maxLifetime = lifetime;
        this.blinkTime = blinkTime;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(dt: number): void {
        this.pulsePhase += dt * 4;
        this.rotationPhase += dt * 2;
        this.lifetime += dt;
    }

    render(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): boolean {
        // Check if expired
        if (this.lifetime >= this.maxLifetime) {
            return false; // Signal removal
        }

        // Blinking when about to expire
        const blinkStart = this.maxLifetime - this.blinkTime;
        if (this.lifetime >= blinkStart) {
            const blinkProgress = (this.lifetime - blinkStart) / this.blinkTime;
            if (Math.floor(blinkProgress * 8) % 2 === 1) {
                return true; // Skip render this frame
            }
        }

        const config = POWERUP_CONFIGS[this.type];
        const centerX = offsetX + this.x * this.gridSize + this.gridSize / 2;
        const centerY = offsetY + this.y * this.gridSize + this.gridSize / 2;

        // Float effect
        const floatOffset = Math.sin(this.pulsePhase) * 2;

        // Pulse effect
        const pulseScale = 1 + 0.15 * Math.sin(this.pulsePhase * 1.5);
        const radius = (this.gridSize / 2 - 4) * pulseScale;

        ctx.save();

        // Outer rotating ring
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY + floatOffset, radius + 4, this.rotationPhase, this.rotationPhase + Math.PI * 1.5);
        ctx.stroke();

        ctx.globalAlpha = 1;

        // Glow
        ctx.shadowColor = config.color;
        ctx.shadowBlur = 12;

        // Main circle
        const gradient = ctx.createRadialGradient(
            centerX - radius * 0.3,
            centerY + floatOffset - radius * 0.3,
            0,
            centerX,
            centerY + floatOffset,
            radius
        );
        gradient.addColorStop(0, this.lightenColor(config.color, 0.4));
        gradient.addColorStop(0.6, config.color);
        gradient.addColorStop(1, this.darkenColor(config.color, 0.3));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY + floatOffset, radius, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.floor(this.gridSize * 0.45)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.icon, centerX, centerY + floatOffset + 1);

        ctx.restore();

        return true;
    }

    private lightenColor(color: string, amount: number): string {
        // Simple hex color lightening
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + Math.floor(255 * amount));
        const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + Math.floor(255 * amount));
        const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + Math.floor(255 * amount));
        return `rgb(${r}, ${g}, ${b})`;
    }

    private darkenColor(color: string, amount: number): string {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - Math.floor(255 * amount));
        const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - Math.floor(255 * amount));
        const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - Math.floor(255 * amount));
        return `rgb(${r}, ${g}, ${b})`;
    }

    isExpired(): boolean {
        return this.lifetime >= this.maxLifetime;
    }

    getConfig(): PowerUpConfig {
        return POWERUP_CONFIGS[this.type];
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.lifetime = 0;
    }

    getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }
}
