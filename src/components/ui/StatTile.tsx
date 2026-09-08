// ===== src/components/ui/StatTile.tsx =====
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type StatTone = 'ink' | 'brand' | 'coin' | 'good';

const VALUE_TONES: Record<StatTone, string> = {
  ink: 'text-ink',
  brand: 'text-brand-bright',
  coin: 'text-coin',
  good: 'text-good',
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small trailing unit or qualifier, e.g. "coins" or "/ 17". */
  suffix?: ReactNode;
  tone?: StatTone;
  /** Optional footer slot for a progress bar or secondary line. */
  footer?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatTile({
  label,
  value,
  suffix,
  tone = 'ink',
  footer,
  className,
  size = 'md',
}: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface-2 px-4',
        size === 'sm' ? 'py-2.5' : 'py-3.5',
        className
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'tabular font-display font-bold leading-none',
            size === 'sm' ? 'text-xl' : 'text-2xl',
            VALUE_TONES[tone]
          )}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-ink-muted">{suffix}</span>}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
