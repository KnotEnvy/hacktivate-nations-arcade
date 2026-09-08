// ===== src/components/ui/ProgressBar.tsx =====
import { cn } from '@/lib/utils';

export type ProgressTone = 'brand' | 'coin' | 'good';

const TONE_FILLS: Record<ProgressTone, string> = {
  brand: 'bg-brand',
  coin: 'bg-coin',
  good: 'bg-good',
};

interface ProgressBarProps {
  /** Current value, clamped into [0, max]. */
  value: number;
  max: number;
  tone?: ProgressTone;
  /** Accessible name. Omit only when an adjacent label already names it. */
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({
  value,
  max,
  tone = 'brand',
  label,
  className,
  size = 'md',
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', TONE_FILLS[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
