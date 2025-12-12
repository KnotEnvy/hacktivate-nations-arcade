// ===== src/games/tapdodge/systems/FeverSystem.ts =====

export interface FeverLevel {
    name: string;
    multiplier: number;
    color: string;
    glowIntensity: number;
}

const FEVER_LEVELS: FeverLevel[] = [
    { name: '', multiplier: 1.0, color: '#FFFFFF', glowIntensity: 0 },
    { name: 'WARMING UP', multiplier: 1.5, color: '#FBBF24', glowIntensity: 0.1 },
    { name: 'HEATING UP', multiplier: 2.0, color: '#F97316', glowIntensity: 0.2 },
    { name: 'ON FIRE', multiplier: 2.5, color: '#EF4444', glowIntensity: 0.3 },
    { name: '🔥 FEVER MODE 🔥', multiplier: 3.0, color: '#EC4899', glowIntensity: 0.4 }
];

export class FeverSystem {
    private cleanSurvivalTime: number = 0;
    private currentLevel: number = 0;
    private flashTimer: number = 0;
    private maxLevelReached: number = 0;

    // Timing
    private readonly LEVEL_UP_INTERVAL = 10; // seconds per level

    // Visual
    private pulsePhase: number = 0;

    public update(dt: number): void {
        this.cleanSurvivalTime += dt;
        this.pulsePhase += dt * 6;

        // Calculate current level
        const newLevel = Math.min(
            FEVER_LEVELS.length - 1,
            Math.floor(this.cleanSurvivalTime / this.LEVEL_UP_INTERVAL)
        );

        // Level up!
        if (newLevel > this.currentLevel) {
            this.currentLevel = newLevel;
            this.flashTimer = 1.0; // Flash effect

            if (this.currentLevel > this.maxLevelReached) {
                this.maxLevelReached = this.currentLevel;
            }
        }

        // Decay flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
    }

    public onDamage(): void {
        // Reset on taking damage
        this.cleanSurvivalTime = 0;
        this.currentLevel = 0;
    }

    public getMultiplier(): number {
        return FEVER_LEVELS[this.currentLevel].multiplier;
    }

    public getLevel(): number {
        return this.currentLevel;
    }

    public getLevelInfo(): FeverLevel {
        return FEVER_LEVELS[this.currentLevel];
    }

    public getMaxLevelReached(): number {
        return this.maxLevelReached;
    }

    public isMaxLevel(): boolean {
        return this.currentLevel >= FEVER_LEVELS.length - 1;
    }

    public getProgress(): number {
        // Progress to next level (0-1)
        if (this.isMaxLevel()) return 1;
        return (this.cleanSurvivalTime % this.LEVEL_UP_INTERVAL) / this.LEVEL_UP_INTERVAL;
    }

    public getTimeToNextLevel(): number {
        if (this.isMaxLevel()) return 0;
        return this.LEVEL_UP_INTERVAL - (this.cleanSurvivalTime % this.LEVEL_UP_INTERVAL);
    }

    public isFlashing(): boolean {
        return this.flashTimer > 0;
    }

    public reset(): void {
        this.cleanSurvivalTime = 0;
        this.currentLevel = 0;
        this.flashTimer = 0;
        this.maxLevelReached = 0;
    }

    // ===== Rendering =====

    public render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
        if (this.currentLevel === 0 && this.cleanSurvivalTime < 5) return;

        const level = FEVER_LEVELS[this.currentLevel];

        // Screen tint at higher levels
        if (level.glowIntensity > 0) {
            const pulse = Math.sin(this.pulsePhase) * 0.1 + 0.9;
            ctx.fillStyle = level.color + Math.floor(level.glowIntensity * pulse * 30).toString(16).padStart(2, '0');
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // Level up flash
        if (this.flashTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flashTimer * 0.3})`;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
    }

    public renderHUD(ctx: CanvasRenderingContext2D, x: number, y: number): number {
        const level = FEVER_LEVELS[this.currentLevel];
        let offsetY = 0;

        // Multiplier display
        if (this.currentLevel > 0 || this.cleanSurvivalTime >= 5) {

            // Background bar
            const barWidth = 100;
            const barHeight = 6;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x, y, barWidth, barHeight);

            // Progress bar
            ctx.fillStyle = level.color;
            ctx.fillRect(x, y, barWidth * this.getProgress(), barHeight);

            // Border
            ctx.strokeStyle = level.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, barWidth, barHeight);

            offsetY += barHeight + 4;

            // Multiplier text
            ctx.font = this.currentLevel >= 3 ? 'bold 16px Arial' : 'bold 14px Arial';
            ctx.fillStyle = level.color;
            ctx.textAlign = 'left';

            const multiplierText = `${level.multiplier.toFixed(1)}x`;

            if (this.isFlashing()) {
                // Flashing effect on level up
                const flash = Math.sin(this.flashTimer * 20) > 0;
                ctx.fillStyle = flash ? '#FFFFFF' : level.color;
                ctx.font = 'bold 18px Arial';
            }

            ctx.fillText(multiplierText, x, y + offsetY + 12);

            // Level name
            if (level.name) {
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = level.color;
                ctx.fillText(level.name, x + 40, y + offsetY + 12);
            }

            offsetY += 18;
        }

        return offsetY;
    }
}
