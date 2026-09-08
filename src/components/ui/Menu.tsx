// ===== src/components/ui/Menu.tsx =====
'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MenuProps {
  /** Rendered inside the trigger button. */
  label: ReactNode;
  /** Accessible name for the trigger when `label` is icon-only. */
  ariaLabel: string;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  testId?: string;
}

/**
 * A small click-away popover menu. Deliberately minimal: the harness only needs
 * one of these (the header overflow), so it stays a plain button + panel with
 * Escape-to-close and outside-click-to-close rather than a full menu widget.
 */
export function Menu({
  label,
  ariaLabel,
  children,
  align = 'right',
  className,
  triggerClassName,
  testId,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid={testId}
        onClick={() => setOpen(value => !value)}
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded-control border px-3',
          'text-sm font-semibold transition-colors duration-150',
          open
            ? 'border-line-strong bg-surface-3 text-ink'
            : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:text-ink',
          triggerClassName
        )}
      >
        {label}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'animate-rise-in absolute top-[calc(100%+6px)] z-50 min-w-56 overflow-hidden',
            'rounded-panel border border-line bg-surface-2 p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  testId?: string;
}

export function MenuItem({
  children,
  onClick,
  href,
  icon,
  tone = 'default',
  testId,
}: MenuItemProps) {
  const classes = cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium',
    'transition-colors duration-150',
    tone === 'danger'
      ? 'text-bad hover:bg-bad-dim'
      : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
  );

  if (href) {
    return (
      <a role="menuitem" href={href} className={classes} data-testid={testId}>
        {icon}
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={classes}
      data-testid={testId}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
      {children}
    </div>
  );
}
