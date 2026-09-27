// ===== src/games/tapdodge/systems/ComboSystem.ts =====
//
// Two counters the fever chip reads:
//   CHAIN — skill reads in a row (near misses and clean laser dodges), each
//           worth NEAR_MISS_POINTS × chain; it lapses after CHAIN_WINDOW
//           seconds without another, and a hit breaks it.
//   COMBO — coins taken without a pause longer than COIN_WINDOW.

export const NEAR_MISS_POINTS = 25;
export const CHAIN_WINDOW = 3;
export const MAX_CHAIN = 5;
export const COIN_WINDOW = 2;

export class ComboSystem {
  private chain = 0;
  private chainTimer = 0;
  private coinCombo = 0;
  private coinTimer = 0;

  private maxChain = 0;
  private maxCoinCombo = 0;
  private nearMisses = 0;
  private clears = 0;

  update(dt: number): void {
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }
    if (this.coinTimer > 0) {
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) this.coinCombo = 0;
    }
  }

  /** A near miss. Returns the points it pays. */
  addNearMiss(): number {
    this.nearMisses++;
    return this.bumpChain();
  }

  /** A laser taken with the right dodge. Returns the points it pays. */
  addClear(): number {
    this.clears++;
    return this.bumpChain();
  }

  private bumpChain(): number {
    this.chain = Math.min(MAX_CHAIN, this.chain + 1);
    this.chainTimer = CHAIN_WINDOW;
    this.maxChain = Math.max(this.maxChain, this.chain);
    return NEAR_MISS_POINTS * this.chain;
  }

  addCoin(): number {
    this.coinCombo++;
    this.coinTimer = COIN_WINDOW;
    this.maxCoinCombo = Math.max(this.maxCoinCombo, this.coinCombo);
    return this.coinCombo;
  }

  /** A hit breaks the chain (the coin combo survives; it only needs pace). */
  breakChain(): void {
    this.chain = 0;
    this.chainTimer = 0;
  }

  getChain(): number {
    return this.chain;
  }

  getCoinCombo(): number {
    return this.coinCombo;
  }

  getMaxChain(): number {
    return this.maxChain;
  }

  getMaxCoinCombo(): number {
    return this.maxCoinCombo;
  }

  getNearMisses(): number {
    return this.nearMisses;
  }

  getClears(): number {
    return this.clears;
  }

  resetAll(): void {
    this.chain = 0;
    this.chainTimer = 0;
    this.coinCombo = 0;
    this.coinTimer = 0;
    this.maxChain = 0;
    this.maxCoinCombo = 0;
    this.nearMisses = 0;
    this.clears = 0;
  }
}
