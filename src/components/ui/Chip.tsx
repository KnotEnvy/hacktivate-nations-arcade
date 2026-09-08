// ===== src/components/ui/Chip.tsx =====
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type TagTone = 'neutral' | 'brand' | 'coin' | 'good' | 'bad' | 'quiet';

const TAG_TONES: Record<TagTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted border-line',
  brand: 'bg-brand-dim text-brand-bright border-brand/40',
  coin: 'bg-coin-dim text-coin border-coin/30',
  good: 'bg-good-dim text-good border-good/30',
  bad: 'bg-bad-dim text-bad border-bad/30',
  quiet: 'bg-transparent text-ink-faint border-line',
};

interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  className?: string;
  title?: string;
}

/** A static status label. Never clickable — use Chip for that. */
export function Tag({ children, tone = 'neutral', className, title }: TagProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[11px] font-semibold leading-none whitespace-nowrap',
        TAG_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Right-aligned count, e.g. how many games match this filter. */
  count?: number;
}

/** A toggleable filter control. */
export function Chip({
  selected = false,
  count,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5',
        'text-[13px] font-semibold transition-colors duration-150 ease-out',
        selected
          ? 'border-brand/50 bg-brand-dim text-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink',
        className
      )}
      {...props}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className={cn(
            'tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
            selected ? 'bg-brand/25 text-brand-bright' : 'bg-surface-3 text-ink-faint'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
