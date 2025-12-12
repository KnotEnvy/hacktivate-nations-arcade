// ===== src/games/tapdodge/entities/Gem.ts =====

export class Gem {
    public x: number;
    public y: number;
    public readonly size: number = 20;
    public speed: number;

    // Animation
    private rotationAngle: number = 0;
    private pulsePhase: number = Math.random() * Math.PI * 2;
    private sparklePhase: number = 0;

    // State
    public isCollected: boolean = false;

    // Value
    public readonly pointMultiplier: number = 5; // Worth 5x a coin

    constructor(x: number, y: number, speed: number) {
        this.x = x;
        this.y = y;
        this.speed = speed;
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        // Move down
        this.y += this.speed * speedMultiplier * dt;

        // Rotate
        this.rotationAngle += dt * 2;

        // Pulse
        this.pulsePhase += dt * 5;

        // Sparkle
        this.sparklePhase += dt * 10;
    }

    public attractTo(targetX: number, targetY: number, strength: number, dt: number): void {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
            this.x += (dx / dist) * strength * dt;
            this.y += (dy / dist) * strength * dt;
        }
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

        const pulse = Math.sin(this.pulsePhase) * 0.15 + 1;
        const size = this.size * pulse;

        // Outer glow - intense purple/cyan
        const glowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size * 2);
        glowGradient.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
        glowGradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.3)');
        glowGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Diamond shape
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);

        // Main diamond body - gradient
        const diamondGradient = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
        diamondGradient.addColorStop(0, '#E879F9'); // Pink
        diamondGradient.addColorStop(0.3, '#A855F7'); // Purple
        diamondGradient.addColorStop(0.5, '#22D3EE'); // Cyan
        diamondGradient.addColorStop(0.7, '#A855F7'); // Purple
        diamondGradient.addColorStop(1, '#E879F9'); // Pink

        ctx.fillStyle = diamondGradient;
        ctx.beginPath();
        ctx.moveTo(0, -size / 2); // Top
        ctx.lineTo(size / 2, 0); // Right
        ctx.lineTo(0, size / 2); // Bottom
        ctx.lineTo(-size / 2, 0); // Left
        ctx.closePath();
        ctx.fill();

        // Inner facets
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 4, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(-size / 4, 0);
        ctx.closePath();
        ctx.fill();

        // Center sparkle
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Orbiting sparkles
        const sparkleCount = 4;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = this.sparklePhase + (Math.PI * 2 * i) / sparkleCount;
            const dist = size + 8 + Math.sin(this.sparklePhase * 2 + i) * 4;
            const sx = this.x + Math.cos(angle) * dist;
            const sy = this.y + Math.sin(angle) * dist;
            const alpha = Math.sin(this.sparklePhase * 3 + i * 1.5) * 0.5 + 0.5;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.renderSparkle(ctx, sx, sy, 4);
        }

        // "RARE" indicator when close to player area
        if (this.y > 250) {
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#E879F9';
            ctx.fillText('★ RARE', this.x, this.y - size - 8);
        }
    }

    private renderSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.3, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.3, y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x, y + size * 0.3);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y - size * 0.3);
        ctx.closePath();
        ctx.fill();
    }
}
