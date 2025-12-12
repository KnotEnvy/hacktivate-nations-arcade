// ===== src/games/tapdodge/systems/ComboSystem.ts =====

export class ComboSystem {
    // Near-miss combo
    private nearMissChain: number = 0;
    private nearMissTimer: number = 0;
    private readonly NEAR_MISS_TIMEOUT = 1.5; // seconds to maintain chain

    // Coin combo
    private coinCombo: number = 0;
    private coinComboTimer: number = 0;
    private readonly COIN_COMBO_TIMEOUT = 2.0;

    // Stats tracking
    private maxNearMissChain: number = 0;
    private maxCoinCombo: number = 0;
    private totalNearMisses: number = 0;

    // Base bonuses
    private readonly NEAR_MISS_BASE_BONUS = 15;
    private readonly NEAR_MISS_CHAIN_MULTIPLIER = 0.25; // +25% per chain level
    private readonly MAX_NEAR_MISS_CHAIN = 5;

    public update(dt: number): void {
        // Decay near-miss chain
        if (this.nearMissTimer > 0) {
            this.nearMissTimer -= dt;
            if (this.nearMissTimer <= 0) {
                this.nearMissChain = 0;
            }
        }

        // Decay coin combo
        if (this.coinComboTimer > 0) {
            this.coinComboTimer -= dt;
            if (this.coinComboTimer <= 0) {
                this.coinCombo = 0;
            }
        }
    }

    // ===== Near-Miss System =====

    public addNearMiss(): { bonus: number; chain: number; multiplier: number } {
        this.nearMissChain = Math.min(this.MAX_NEAR_MISS_CHAIN, this.nearMissChain + 1);
        this.nearMissTimer = this.NEAR_MISS_TIMEOUT;
        this.totalNearMisses++;

        // Track max chain
        if (this.nearMissChain > this.maxNearMissChain) {
            this.maxNearMissChain = this.nearMissChain;
        }

        const multiplier = 1 + (this.nearMissChain - 1) * this.NEAR_MISS_CHAIN_MULTIPLIER;
        const bonus = Math.floor(this.NEAR_MISS_BASE_BONUS * multiplier);

        return {
            bonus,
            chain: this.nearMissChain,
            multiplier
        };
    }

    public getNearMissChain(): number {
        return this.nearMissChain;
    }

    public getNearMissTimeLeft(): number {
        return this.nearMissTimer;
    }

    public getNearMissMultiplier(): number {
        if (this.nearMissChain <= 0) return 1;
        return 1 + (this.nearMissChain - 1) * this.NEAR_MISS_CHAIN_MULTIPLIER;
    }

    // ===== Coin Combo System =====

    public addCoin(): number {
        this.coinCombo = Math.min(10, this.coinCombo + 1);
        this.coinComboTimer = this.COIN_COMBO_TIMEOUT;

        if (this.coinCombo > this.maxCoinCombo) {
            this.maxCoinCombo = this.coinCombo;
        }

        return this.getCoinMultiplier();
    }

    public getCoinCombo(): number {
        return this.coinCombo;
    }

    public getCoinMultiplier(): number {
        return 1 + this.coinCombo * 0.2; // +20% per combo level
    }

    public getCoinTimeLeft(): number {
        return this.coinComboTimer;
    }

    // ===== Stats =====

    public getMaxNearMissChain(): number {
        return this.maxNearMissChain;
    }

    public getMaxCoinCombo(): number {
        return this.maxCoinCombo;
    }

    public getTotalNearMisses(): number {
        return this.totalNearMisses;
    }

    public reset(): void {
        this.nearMissChain = 0;
        this.nearMissTimer = 0;
        this.coinCombo = 0;
        this.coinComboTimer = 0;
    }

    public resetAll(): void {
        this.reset();
        this.maxNearMissChain = 0;
        this.maxCoinCombo = 0;
        this.totalNearMisses = 0;
    }
}
