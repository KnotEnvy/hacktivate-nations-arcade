// ===== src/components/arcade/CurrencyDisplay.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { CurrencyService } from '@/services/CurrencyService';
import { formatNumber } from '@/lib/utils';

interface CurrencyDisplayProps {
  currencyService?: CurrencyService;
}

export function CurrencyDisplay({ currencyService }: CurrencyDisplayProps) {
  const [coins, setCoins] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const service = currencyService ?? new CurrencyService();
    if (!currencyService) {
      service.init();
    }

    setCoins(service.getCurrentCoins());

    const unsubscribe = service.onCoinsChanged((newCoins) => {
      setCoins(newCoins);
      setAnimate(true);
      setTimeout(() => setAnimate(false), 600);
    });

    return unsubscribe;
  }, [currencyService]);

  return (
    <div
      className={`currency-display transition-all duration-300 ${
        animate ? 'animate-bounce scale-110' : ''
      }`}
    >
      <span className="mr-2" aria-hidden>
        {'\u{1F4B0}'}
      </span>
      <span className="font-mono" aria-label="Coins">
        {formatNumber(coins)}
      </span>
    </div>
  );
}
