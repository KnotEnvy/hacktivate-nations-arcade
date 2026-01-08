// ===== src/games/snake/systems/ScreenShake.ts =====

export class ScreenShake {
    private intensity: number = 0;
    private duration: number = 0;
    private elapsed: number = 0;
    private offsetX: number = 0;
    private offsetY: number = 0;

    shake(intensity: number, duration: number): void {
        // Only override if new shake is stronger
        if (intensity > this.intensity) {
            this.intensity = intensity;
            this.duration = duration;
            this.elapsed = 0;
        }
    }

    update(dt: number): void {
        if (this.elapsed < this.duration) {
            this.elapsed += dt;
            const progress = this.elapsed / this.duration;
            const decay = 1 - progress;
            const currentIntensity = this.intensity * decay;

            this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
            this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
            this.intensity = 0;
        }
    }

    getOffset(): { x: number; y: number } {
        return { x: this.offsetX, y: this.offsetY };
    }

    isShaking(): boolean {
        return this.elapsed < this.duration;
    }

    stop(): void {
        this.intensity = 0;
        this.duration = 0;
        this.elapsed = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}
