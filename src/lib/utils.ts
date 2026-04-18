// ===== src/lib/utils.ts =====
import { type ClassValue, clsx } from 'clsx';
import { ECONOMY } from './constants';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function calculateCoinsEarned(score: number, pickups: number): number {
  return Math.floor(score / ECONOMY.SCORE_TO_COINS_RATIO) + 
         (pickups * ECONOMY.PICKUP_COIN_VALUE);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
