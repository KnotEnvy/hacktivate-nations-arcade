// ===== src/games/tapdodge/systems/ScreenShake.ts =====

export class ScreenShake {
    private intensity: number = 0;
    private duration: number = 0;
    private maxDuration: number = 0;
    private offsetX: number = 0;
    private offsetY: number = 0;

    // Shake type
    private shakeType: 'random' | 'horizontal' | 'vertical' = 'random';

    public shake(intensity: number, duration: number, type: 'random' | 'horizontal' | 'vertical' = 'random'): void {
        // Only override if new shake is stronger
        if (intensity > this.intensity || this.duration <= 0) {
            this.intensity = intensity;
            this.duration = duration;
            this.maxDuration = duration;
            this.shakeType = type;
        }
    }

    public update(dt: number): void {
        if (this.duration > 0) {
            this.duration -= dt;

            // Calculate decay (shake gets weaker as it ends)
            const decay = this.duration / this.maxDuration;
            const currentIntensity = this.intensity * decay;

            // Generate offset based on shake type
            switch (this.shakeType) {
                case 'horizontal':
                    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
                    this.offsetY = 0;
                    break;
                case 'vertical':
                    this.offsetX = 0;
                    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
                    break;
                default: // random
                    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
                    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
            }
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
            this.intensity = 0;
        }
    }

    public getOffset(): { x: number; y: number } {
        return { x: this.offsetX, y: this.offsetY };
    }

    public isShaking(): boolean {
        return this.duration > 0;
    }

    public stop(): void {
        this.duration = 0;
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}
