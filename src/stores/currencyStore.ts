// ===== src/stores/currencyStore.ts =====
import { create } from 'zustand';

interface CurrencyState {
  coins: number;
  transactions: Array<{
    amount: number;
    source: string;
    timestamp: Date;
  }>;
  
  // Actions
  setCoins: (coins: number) => void;
  addCoins: (amount: number, source: string) => void;
  spendCoins: (amount: number, purpose: string) => boolean;
  addTransaction: (amount: number, source: string) => void;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  coins: 0,
  transactions: [],
  
  setCoins: (coins) => set({ coins }),
  
  addCoins: (amount, source) => {
    const state = get();
    set({ 
      coins: state.coins + amount,
      transactions: [...state.transactions, {
        amount,
        source,
        timestamp: new Date()
      }]
    });
  },
  
  spendCoins: (amount, purpose) => {
    const state = get();
    if (state.coins >= amount) {
      set({ 
        coins: state.coins - amount,
        transactions: [...state.transactions, {
          amount: -amount,
          source: purpose,
          timestamp: new Date()
        }]
      });
      return true;
    }
    return false;
  },
  
  addTransaction: (amount, source) => {
    const state = get();
    set({
      transactions: [...state.transactions, {
        amount,
        source,
        timestamp: new Date()
      }]
    });
  },
}));
