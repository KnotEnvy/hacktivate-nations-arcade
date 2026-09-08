// ===== src/components/ui/Panel.tsx =====
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** `flat` sits directly on the canvas; `raised` is for floating surfaces. */
  elevation?: 'flat' | 'raised';
  /** Turn off the built-in padding when the panel owns its own layout. */
  padded?: boolean;
  testId?: string;
}

export function Panel({
  children,
  className,
  elevation = 'flat',
  padded = true,
  testId,
}: PanelProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-panel border border-line bg-surface',
        elevation === 'flat' ? 'shadow-panel' : 'shadow-raised',
        padded && 'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  /** Small uppercase label above the title. Use for section identity. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {eyebrow}
          </div>
        )}
        <h3 className="mt-0.5 text-base font-bold text-ink">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-10 text-center',
        className
      )}
    >
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
