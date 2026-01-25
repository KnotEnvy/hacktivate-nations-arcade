// ===== src/games/platform-adventure/entities/Collectible.ts =====

export type CollectibleType = 'potion_hp' | 'potion_max' | 'gem' | 'time' | 'owl';

export class Collectible {
    x: number;
    y: number;
    type: CollectibleType;
    collected: boolean = false;

    private floatOffset: number = 0;
    private floatPhase: number = Math.random() * Math.PI * 2;
    private sparklePhase: number = 0;

    readonly width = 16;
    readonly height = 20;

    constructor(x: number, y: number, type: CollectibleType) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    update(dt: number): void {
        if (this.collected) return;

        this.floatPhase += dt * 0.003;
        this.floatOffset = Math.sin(this.floatPhase) * 3;
        this.sparklePhase += dt * 0.01;
    }

    collect(): CollectibleType {
        this.collected = true;
        return this.type;
    }

    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        if (this.collected) return;

        const screenX = Math.floor(this.x - camX);
        const screenY = Math.floor(this.y - camY + this.floatOffset);

        ctx.save();

        switch (this.type) {
            case 'potion_hp':
                this.drawPotion(ctx, screenX, screenY, '#ff4444', '#ff6666');
                break;
            case 'potion_max':
                this.drawPotion(ctx, screenX, screenY, '#44ff44', '#66ff66');
                break;
            case 'gem':
                this.drawGem(ctx, screenX, screenY);
                break;
            case 'time':
                this.drawTimeCrystal(ctx, screenX, screenY);
                break;
            case 'owl':
                this.drawGoldenOwl(ctx, screenX, screenY);
                break;
        }

        ctx.restore();
    }

    private drawPotion(ctx: CanvasRenderingContext2D, x: number, y: number, color1: string, color2: string): void {
        // Flask body
        ctx.fillStyle = '#aabbcc';
        ctx.fillRect(x + 4, y + 2, 8, 4);

        // Liquid
        ctx.fillStyle = color1;
        ctx.fillRect(x + 2, y + 6, 12, 12);
        ctx.fillStyle = color2;
        ctx.fillRect(x + 4, y + 8, 4, 4);

        // Outline
        ctx.strokeStyle = '#666677';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 6, 12, 12);
    }

    private drawGem(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        ctx.fillStyle = '#4488ff';

        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 16, y + 10);
        ctx.lineTo(x + 8, y + 20);
        ctx.lineTo(x, y + 10);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#88bbff';
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 2);
        ctx.lineTo(x + 12, y + 8);
        ctx.lineTo(x + 8, y + 10);
        ctx.lineTo(x + 4, y + 8);
        ctx.closePath();
        ctx.fill();

        // Sparkle
        if (Math.sin(this.sparklePhase) > 0.7) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + 10, y + 4, 2, 2);
        }
    }

    private drawTimeCrystal(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        const pulse = Math.sin(this.sparklePhase * 2) * 0.2 + 0.8;

        // Glow
        ctx.fillStyle = `rgba(255, 221, 68, ${pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(x + 8, y + 10, 12, 0, Math.PI * 2);
        ctx.fill();

        // Crystal
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath();
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 14, y + 8);
        ctx.lineTo(x + 12, y + 18);
        ctx.lineTo(x + 4, y + 18);
        ctx.lineTo(x + 2, y + 8);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#ffee88';
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 3);
        ctx.lineTo(x + 11, y + 8);
        ctx.lineTo(x + 8, y + 12);
        ctx.lineTo(x + 5, y + 8);
        ctx.closePath();
        ctx.fill();
    }

    private drawGoldenOwl(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        const pulse = Math.sin(this.sparklePhase) * 3;

        // Glow aura
        const gradient = ctx.createRadialGradient(x + 8, y + 10, 0, x + 8, y + 10, 20);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 12, y - 10, 40, 40);

        // Body
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 14, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(x + 8, y + 4, 6, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + 4, y - 4);
        ctx.lineTo(x + 6, y);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 10, y);
        ctx.lineTo(x + 12, y - 4);
        ctx.lineTo(x + 14, y);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffeeaa';
        ctx.beginPath();
        ctx.arc(x + 5, y + 4, 3, 0, Math.PI * 2);
        ctx.arc(x + 11, y + 4, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x + 5, y + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 11, y + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#cc8800';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 7);
        ctx.lineTo(x + 8, y + 10);
        ctx.lineTo(x + 10, y + 7);
        ctx.closePath();
        ctx.fill();

        // Sparkles
        ctx.fillStyle = '#ffffff';
        const sparkX = x + 8 + Math.cos(this.sparklePhase * 3) * 12;
        const sparkY = y + 10 + Math.sin(this.sparklePhase * 3) * 8;
        ctx.fillRect(sparkX - 1, sparkY - 1, 2, 2);
    }

    get left(): number { return this.x; }
    get right(): number { return this.x + this.width; }
    get top(): number { return this.y + this.floatOffset; }
    get bottom(): number { return this.y + this.height + this.floatOffset; }
    get centerX(): number { return this.x + this.width / 2; }
    get centerY(): number { return this.y + this.height / 2 + this.floatOffset; }
}
