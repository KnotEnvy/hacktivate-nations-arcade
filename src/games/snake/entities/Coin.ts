// ===== src/games/snake/entities/Coin.ts =====

export class Coin {
    public x: number;
    public y: number;
    private gridSize: number;
    private rotationPhase: number = 0;
    private lifetime: number = 0;
    private maxLifetime: number;
    private blinkTime: number;
    private bobPhase: number = 0;

    constructor(x: number, y: number, gridSize: number, lifetime: number = 6, blinkTime: number = 1) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.maxLifetime = lifetime;
        this.blinkTime = blinkTime;
        this.rotationPhase = Math.random() * Math.PI * 2;
    }

    update(dt: number): void {
        this.rotationPhase += dt * 5;
        this.bobPhase += dt * 3;
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

        const centerX = offsetX + this.x * this.gridSize + this.gridSize / 2;
        const baseY = offsetY + this.y * this.gridSize + this.gridSize / 2;
        const bobOffset = Math.sin(this.bobPhase) * 2;
        const centerY = baseY + bobOffset;

        // 3D rotation effect (squash width based on rotation)
        const rotScale = Math.abs(Math.cos(this.rotationPhase));
        const width = (this.gridSize / 2 - 4) * Math.max(0.3, rotScale);
        const height = this.gridSize / 2 - 4;

        ctx.save();

        // Glow effect
        ctx.shadowColor = '#FCD34D';
        ctx.shadowBlur = 8;

        // Coin body
        const gradient = ctx.createLinearGradient(
            centerX - width,
            centerY - height,
            centerX + width,
            centerY + height
        );
        gradient.addColorStop(0, '#FEF3C7');
        gradient.addColorStop(0.3, '#FCD34D');
        gradient.addColorStop(0.7, '#F59E0B');
        gradient.addColorStop(1, '#B45309');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, width, height, 0, 0, Math.PI * 2);
        ctx.fill();

        // Edge highlight
        ctx.strokeStyle = '#FEF3C7';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dollar sign (only visible when facing forward)
        if (rotScale > 0.5) {
            ctx.fillStyle = '#92400E';
            ctx.font = `bold ${Math.floor(this.gridSize * 0.5)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = rotScale;
            ctx.fillText('$', centerX, centerY + 1);
        }

        ctx.restore();

        return true;
    }

    isExpired(): boolean {
        return this.lifetime >= this.maxLifetime;
    }

    getTimeRemaining(): number {
        return Math.max(0, this.maxLifetime - this.lifetime);
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
