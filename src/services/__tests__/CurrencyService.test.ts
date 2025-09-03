import { CurrencyService } from '@/services/CurrencyService';
import { ECONOMY } from '@/lib/constants';

describe('CurrencyService', () => {
  test('calculateGameReward applies score ratio, pickup value, and multiplier', () => {
    const svc = new CurrencyService();
    const score = 1234;
    const pickups = 3;
    const base = Math.floor(score / ECONOMY.SCORE_TO_COINS_RATIO) + pickups * ECONOMY.PICKUP_COIN_VALUE; // 12 + 30 = 42

    expect(svc.calculateGameReward(score, pickups, 1)).toBe(base);
    expect(svc.calculateGameReward(score, pickups, 1.5)).toBe(Math.floor(base * 1.5));
  });

  test('init loads coins from storage; add/spend updates and notifies', () => {
    localStorage.setItem('hacktivate-coins', '5');
    const svc = new CurrencyService();
    svc.init();
    expect(svc.getCurrentCoins()).toBe(5);

    const changes: number[] = [];
    const unsub = svc.onCoinsChanged(v => changes.push(v));

    svc.addCoins(100, 'test');
    expect(svc.getCurrentCoins()).toBe(105);
    expect(localStorage.getItem('hacktivate-coins')).toBe('105');

    const spent = svc.spendCoins(50, 'purchase');
    expect(spent).toBe(true);
    expect(svc.getCurrentCoins()).toBe(55);

    const denied = svc.spendCoins(10_000, 'too-much');
    expect(denied).toBe(false);
    expect(svc.getCurrentCoins()).toBe(55);

    unsub();
    // Listener should have been called for add and spend
    expect(changes).toEqual([105, 55]);

    // Transactions recorded (cannot access private, but history is exposed)
    const tx = svc.getTransactionHistory();
    expect(tx.length).toBe(2);
    expect(tx[0].amount).toBe(100);
    expect(tx[1].amount).toBe(-50);
  });
});

