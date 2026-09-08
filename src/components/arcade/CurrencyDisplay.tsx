// ===== src/components/arcade/CurrencyDisplay.tsx =====
'use client';

import { useEffect, useRef, useState } from 'react';
import { CurrencyService } from '@/services/CurrencyService';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCoins } from '@/lib/utils';

interface CurrencyDisplayProps {
  currencyService?: CurrencyService;
}

export function CurrencyDisplay({ currencyService }: CurrencyDisplayProps) {
  const [coins, setCoins] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const previousRef = useRef(0);

  useEffect(() => {
    const service = currencyService ?? new CurrencyService();
    if (!currencyService) {
      service.init();
    }

    const initial = service.getCurrentCoins();
    previousRef.current = initial;
    setCoins(initial);

    const unsubscribe = service.onCoinsChanged(newCoins => {
      const change = newCoins - previousRef.current;
      previousRef.current = newCoins;
      setCoins(newCoins);
      if (change !== 0) {
        setDelta(change);
        window.setTimeout(() => setDelta(null), 1400);
      }
    });

    return unsubscribe;
  }, [currencyService]);

  return (
    <div className="relative">
      <div
        className={cn(
          'currency-display h-9 text-sm',
          delta !== null && 'animate-coin-tick'
        )}
      >
        <Icon name="coin" size={14} />
        <span className="tabular" aria-label="Coins">
          {formatCoins(coins)}
        </span>
      </div>
      {delta !== null && (
        <span
          aria-hidden
          className={cn(
            'animate-rise-in pointer-events-none absolute -top-4 right-1 text-xs font-bold',
            delta > 0 ? 'text-good' : 'text-bad'
          )}
        >
          {delta > 0 ? `+${formatCoins(delta)}` : formatCoins(delta)}
        </span>
      )}
    </div>
  );
}
