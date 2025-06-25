// ===== src/services/CurrencyService.ts =====
import { ECONOMY } from '@/lib/constants';

export interface CurrencyTransaction {
  amount: number;
  source: string;
  timestamp: Date;
}

export class CurrencyService {
  private currentCoins: number = 0;
  private transactions: CurrencyTransaction[] = [];
  private listeners: Array<(coins: number) => void> = [];
  private bonusMultiplier: number = 1;

  init(): void {
    // Load from localStorage for now
    const saved = localStorage.getItem('hacktivate-coins');
    if (saved) {
      this.currentCoins = parseInt(saved, 10) || 0;
    }
  }

  getCurrentCoins(): number {
    return this.currentCoins;
  }

  getBonusMultiplier(): number {
    return this.bonusMultiplier;
  }

  setBonusMultiplier(multiplier: number): void {
    this.bonusMultiplier = multiplier;
  }

  // Reset method for development
  resetCoins(): void {
    this.currentCoins = 0;
    this.transactions = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  addCoins(amount: number, source: string): void {
    this.currentCoins += amount;
    this.saveToStorage();
    
    const transaction: CurrencyTransaction = {
      amount,
      source,
      timestamp: new Date(),
    };
    
    this.transactions.push(transaction);
    this.notifyListeners();
  }

  spendCoins(amount: number, purpose: string): boolean {
    if (this.currentCoins < amount) {
      return false; // Insufficient funds
    }

    this.currentCoins -= amount;
    this.saveToStorage();
    
    const transaction: CurrencyTransaction = {
      amount: -amount,
      source: purpose,
      timestamp: new Date(),
    };
    
    this.transactions.push(transaction);
    this.notifyListeners();
    return true;
  }

  calculateGameReward(score: number, pickups: number, bonusMultiplier: number = this.bonusMultiplier): number {
    const baseReward =
      Math.floor(score / ECONOMY.SCORE_TO_COINS_RATIO) +
      pickups * ECONOMY.PICKUP_COIN_VALUE;
    return Math.floor(baseReward * bonusMultiplier);
  }

  onCoinsChanged(callback: (coins: number) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private saveToStorage(): void {
    localStorage.setItem('hacktivate-coins', this.currentCoins.toString());
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentCoins));
  }

  getTransactionHistory(): CurrencyTransaction[] {
    return [...this.transactions];
  }
}