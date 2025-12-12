// ===== src/games/tapdodge/systems/BackgroundSystem.ts =====

export class BackgroundSystem {
    private scrollOffset: number = 0;
    private gridOffset: number = 0;
    private starField: { x: number; y: number; size: number; speed: number; alpha: number }[] = [];

    private canvasWidth: number;
    private canvasHeight: number;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.initStarField();
    }

    private initStarField(): void {
        // Create layered star field
        for (let i = 0; i < 60; i++) {
            const layer = Math.floor(Math.random() * 3); // 0, 1, 2 for depth
            this.starField.push({
                x: Math.random() * this.canvasWidth,
                y: Math.random() * this.canvasHeight,
                size: 1 + layer * 0.5,
                speed: 20 + layer * 30, // Far stars move slower
                alpha: 0.3 + layer * 0.25
            });
        }
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        // Scroll grid
        this.gridOffset += 80 * speedMultiplier * dt;
        if (this.gridOffset > 40) this.gridOffset -= 40;

        // Update stars
        for (const star of this.starField) {
            star.y += star.speed * speedMultiplier * dt;
            if (star.y > this.canvasHeight) {
                star.y = -10;
                star.x = Math.random() * this.canvasWidth;
            }
        }

        this.scrollOffset += dt * 50 * speedMultiplier;
    }

    public render(ctx: CanvasRenderingContext2D, colors: { primary: string; secondary: string; accent: string }): void {
        // Background gradient
        const bgGradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        bgGradient.addColorStop(0, colors.secondary);
        bgGradient.addColorStop(0.5, colors.primary);
        bgGradient.addColorStop(1, colors.secondary);
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Star field
        this.renderStars(ctx, colors.accent);

        // Grid lines
        this.renderGrid(ctx, colors.accent);

        // Vignette effect
        this.renderVignette(ctx);

        // Lane indicators (subtle)
        this.renderLaneIndicators(ctx, colors.accent);
    }

    private renderStars(ctx: CanvasRenderingContext2D, accentColor: string): void {
        for (const star of this.starField) {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    private renderGrid(ctx: CanvasRenderingContext2D, accentColor: string): void {
        const gridSize = 40;

        // Vertical lines
        ctx.strokeStyle = accentColor + '15'; // Very transparent
        ctx.lineWidth = 1;

        for (let x = 0; x <= this.canvasWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }

        // Horizontal lines (scrolling)
        for (let y = this.gridOffset; y < this.canvasHeight + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvasWidth, y);
            ctx.stroke();
        }

        // Center line (brighter)
        ctx.strokeStyle = accentColor + '30';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.canvasWidth / 2, 0);
        ctx.lineTo(this.canvasWidth / 2, this.canvasHeight);
        ctx.stroke();
    }

    private renderVignette(ctx: CanvasRenderingContext2D): void {
        const gradient = ctx.createRadialGradient(
            this.canvasWidth / 2, this.canvasHeight / 2, 0,
            this.canvasWidth / 2, this.canvasHeight / 2, this.canvasWidth * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    private renderLaneIndicators(ctx: CanvasRenderingContext2D, accentColor: string): void {
        const laneCount = 5;
        const laneWidth = this.canvasWidth / laneCount;

        ctx.strokeStyle = accentColor + '10';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 10]);

        for (let i = 1; i < laneCount; i++) {
            const x = i * laneWidth;
            ctx.beginPath();
            ctx.moveTo(x, this.canvasHeight - 150);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    public renderDangerVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
        if (intensity <= 0) return;

        const gradient = ctx.createRadialGradient(
            this.canvasWidth / 2, this.canvasHeight / 2, 0,
            this.canvasWidth / 2, this.canvasHeight / 2, this.canvasWidth * 0.7
        );
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
        gradient.addColorStop(0.6, 'rgba(239, 68, 68, 0)');
        gradient.addColorStop(1, `rgba(239, 68, 68, ${intensity * 0.4})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    public renderSlowMoVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
        if (intensity <= 0) return;

        ctx.fillStyle = `rgba(147, 197, 253, ${intensity * 0.15})`;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    public renderBossWarning(ctx: CanvasRenderingContext2D, time: number): void {
        // Pulsing red edges
        const pulse = Math.sin(time * 10) * 0.5 + 0.5;
        const edgeWidth = 20;

        ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.5})`;

        // Top edge
        ctx.fillRect(0, 0, this.canvasWidth, edgeWidth);
        // Bottom edge
        ctx.fillRect(0, this.canvasHeight - edgeWidth, this.canvasWidth, edgeWidth);
        // Left edge
        ctx.fillRect(0, 0, edgeWidth, this.canvasHeight);
        // Right edge
        ctx.fillRect(this.canvasWidth - edgeWidth, 0, edgeWidth, this.canvasHeight);
    }

    public resize(canvasWidth: number, canvasHeight: number): void {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.starField = [];
        this.initStarField();
    }
}
