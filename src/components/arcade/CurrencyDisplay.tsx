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
    if (!currencyService) {
      // Create a local instance for display
      const service = new CurrencyService();
      service.init();
      setCoins(service.getCurrentCoins());
      
      const unsubscribe = service.onCoinsChanged((newCoins) => {
        setCoins(newCoins);
        setAnimate(true);
        setTimeout(() => setAnimate(false), 600);
      });

      return unsubscribe;
    } else {
      setCoins(currencyService.getCurrentCoins());
      
      const unsubscribe = currencyService.onCoinsChanged((newCoins) => {
        setCoins(newCoins);
        setAnimate(true);
        setTimeout(() => setAnimate(false), 600);
      });

      return unsubscribe;
    }
  }, [currencyService]);

  return (
    <div className={`currency-display transition-all duration-300 ${animate ? 'animate-bounce scale-110' : ''}`}>
      <span className="mr-2">💰</span>
      <span className="font-mono">{formatNumber(coins)}</span>
    </div>
  );
}
