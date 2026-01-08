// ===== src/games/snake/systems/ComboSystem.ts =====

export class ComboSystem {
    private combo: number = 0;
    private comboTimer: number = 0;
    private readonly comboTimeout: number = 3.0; // seconds before combo resets
    private maxCombo: number = 0;

    // Callback for combo resets (used for visual effects)
    private onResetCallback?: () => void;

    update(dt: number): void {
        if (this.combo > 0) {
            this.comboTimer += dt;
            if (this.comboTimer >= this.comboTimeout) {
                this.resetCombo();
            }
        }
    }

    // Call when food/coin is eaten
    addHit(): { combo: number; multiplier: number; isMilestone: boolean } {
        this.combo++;
        this.comboTimer = 0;

        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }

        const multiplier = this.getMultiplier();
        const isMilestone = this.isMilestoneCombo();

        return { combo: this.combo, multiplier, isMilestone };
    }

    getMultiplier(): number {
        if (this.combo <= 1) return 1;
        if (this.combo <= 3) return 1.5;
        if (this.combo <= 6) return 2;
        if (this.combo <= 10) return 3;
        return 5;
    }

    private isMilestoneCombo(): boolean {
        // Trigger effects at these combo counts
        return [3, 5, 10, 15, 20, 25, 30, 40, 50].includes(this.combo);
    }

    getCombo(): number {
        return this.combo;
    }

    getMaxCombo(): number {
        return this.maxCombo;
    }

    getComboProgress(): number {
        // Returns 0-1 showing how close to timeout
        return 1 - (this.comboTimer / this.comboTimeout);
    }

    private resetCombo(): void {
        this.combo = 0;
        this.comboTimer = 0;
        this.onResetCallback?.();
    }

    setOnResetCallback(callback: () => void): void {
        this.onResetCallback = callback;
    }

    reset(): void {
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
    }
}
