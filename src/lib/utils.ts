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

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}