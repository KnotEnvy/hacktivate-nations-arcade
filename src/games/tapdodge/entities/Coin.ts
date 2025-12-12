// ===== src/games/tapdodge/entities/Coin.ts =====

export class Coin {
    public x: number;
    public y: number;
    public readonly radius: number = 12;
    public speed: number;

    // Animation
    private bobPhase: number = Math.random() * Math.PI * 2;
    private rotationAngle: number = 0;
    private sparklePhase: number = 0;

    // State
    public isCollected: boolean = false;

    constructor(x: number, y: number, speed: number) {
        this.x = x;
        this.y = y;
        this.speed = speed;
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        // Move down
        this.y += this.speed * speedMultiplier * dt;

        // Bob up and down
        this.bobPhase += dt * 4;

        // Rotate
        this.rotationAngle += dt * 3;

        // Sparkle
        this.sparklePhase += dt * 8;
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
            x: this.x - this.radius,
            y: this.y - this.radius + Math.sin(this.bobPhase) * 4,
            w: this.radius * 2,
            h: this.radius * 2
        };
    }

    public isOffScreen(canvasHeight: number): boolean {
        return this.y > canvasHeight + this.radius || this.isCollected;
    }

    public collect(): void {
        this.isCollected = true;
    }

    public render(ctx: CanvasRenderingContext2D): void {
        if (this.isCollected) return;

        const bobOffset = Math.sin(this.bobPhase) * 4;
        const cy = this.y + bobOffset;

        // Calculate ellipse width for rotation effect
        const rotationFactor = Math.cos(this.rotationAngle);
        const ellipseWidth = this.radius * Math.abs(rotationFactor);

        // Outer glow
        const glowGradient = ctx.createRadialGradient(this.x, cy, 0, this.x, cy, this.radius * 2);
        glowGradient.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
        glowGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, cy, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Main coin body
        const coinGradient = ctx.createLinearGradient(
            this.x - this.radius, cy,
            this.x + this.radius, cy
        );
        coinGradient.addColorStop(0, '#F59E0B');
        coinGradient.addColorStop(0.3, '#FBBF24');
        coinGradient.addColorStop(0.5, '#FCD34D');
        coinGradient.addColorStop(0.7, '#FBBF24');
        coinGradient.addColorStop(1, '#F59E0B');

        ctx.fillStyle = coinGradient;
        ctx.beginPath();
        ctx.ellipse(this.x, cy, Math.max(2, ellipseWidth), this.radius, 0, 0, Math.PI * 2);
        ctx.fill();

        // Edge highlight
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, cy, Math.max(2, ellipseWidth), this.radius, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner design ($ symbol when facing forward)
        if (Math.abs(rotationFactor) > 0.3) {
            ctx.fillStyle = '#92400E';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.abs(rotationFactor);
            ctx.fillText('$', this.x, cy);
            ctx.globalAlpha = 1;
        }

        // Sparkles
        const sparkleCount = 3;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = this.sparklePhase + (Math.PI * 2 * i) / sparkleCount;
            const dist = this.radius + 6 + Math.sin(this.sparklePhase * 2 + i) * 4;
            const sx = this.x + Math.cos(angle) * dist;
            const sy = cy + Math.sin(angle) * dist;
            const alpha = Math.sin(this.sparklePhase * 3 + i * 2) * 0.5 + 0.5;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
