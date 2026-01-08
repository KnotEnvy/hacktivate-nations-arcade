// ===== src/games/snake/entities/Food.ts =====

export class Food {
    public x: number;
    public y: number;
    private gridSize: number;
    private pulsePhase: number = 0;
    private spawnProgress: number = 0;
    private glowIntensity: number = 0;

    constructor(x: number, y: number, gridSize: number) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.spawnProgress = 0;
    }

    update(dt: number): void {
        // Pulse animation
        this.pulsePhase += dt * 4;

        // Spawn-in animation
        if (this.spawnProgress < 1) {
            this.spawnProgress = Math.min(1, this.spawnProgress + dt * 4);
        }

        // Glow fluctuation
        this.glowIntensity = 0.5 + 0.5 * Math.sin(this.pulsePhase * 2);
    }

    render(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
        const centerX = offsetX + this.x * this.gridSize + this.gridSize / 2;
        const centerY = offsetY + this.y * this.gridSize + this.gridSize / 2;
        const baseRadius = this.gridSize / 2 - 4;

        // Apply spawn scale (clamp to prevent negative radius)
        const scale = Math.max(0.01, this.easeOutBack(this.spawnProgress));
        const radius = baseRadius * scale;

        // Pulse effect
        const pulseScale = 1 + 0.1 * Math.sin(this.pulsePhase);
        const finalRadius = radius * pulseScale;

        // Outer glow
        ctx.save();
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 10 + this.glowIntensity * 5;

        // Gradient fill
        const gradient = ctx.createRadialGradient(
            centerX - finalRadius * 0.3,
            centerY - finalRadius * 0.3,
            0,
            centerX,
            centerY,
            finalRadius
        );
        gradient.addColorStop(0, '#ff6b8a');
        gradient.addColorStop(0.5, '#e11d48');
        gradient.addColorStop(1, '#9f1239');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, finalRadius, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(
            centerX - finalRadius * 0.25,
            centerY - finalRadius * 0.25,
            finalRadius * 0.3,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    private easeOutBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.spawnProgress = 0;
    }

    getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }
}
