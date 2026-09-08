// ===== src/components/ui/Button.tsx =====
import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'coin'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the parent. */
  block?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // One primary action per view. Violet means "this is the thing to press".
  primary: 'bg-brand text-white hover:bg-brand-bright active:translate-y-px',
  // The default supporting action: reads as a surface, not as a colour.
  secondary:
    'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong active:translate-y-px',
  // Lowest weight — toolbar and inline actions.
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  outline:
    'bg-transparent text-ink border border-line-strong hover:bg-surface-2 active:translate-y-px',
  // Currency actions are always amber, everywhere in the app.
  coin: 'bg-coin text-canvas-deep hover:brightness-110 active:translate-y-px',
  danger: 'bg-bad-dim text-bad border border-bad/30 hover:bg-bad hover:text-white',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-control',
  lg: 'h-12 px-6 text-base gap-2 rounded-control',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', block = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap',
          'transition-[background-color,border-color,color,transform,filter] duration-150 ease-out',
          'disabled:pointer-events-none disabled:opacity-45',
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          block && 'w-full',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
