// ===== src/components/arcade/HubNotifications.tsx =====
'use client';

import { Icon, type IconName } from '@/components/ui/Icon';

export type HubNotificationType = 'achievement' | 'challenge' | 'levelup';

export interface HubNotification {
  id: string;
  type: HubNotificationType;
  title: string;
  message: string;
  timestamp: Date;
}

const STYLES: Record<
  HubNotificationType,
  { icon: IconName; accent: string; ring: string }
> = {
  achievement: {
    icon: 'medal',
    accent: 'bg-coin-dim text-coin',
    ring: 'border-coin/30',
  },
  challenge: { icon: 'target', accent: 'bg-good-dim text-good', ring: 'border-good/30' },
  levelup: {
    icon: 'sparkle',
    accent: 'bg-brand-dim text-brand-bright',
    ring: 'border-brand/40',
  },
};

interface HubNotificationsProps {
  notifications: HubNotification[];
  onDismiss: (id: string) => void;
}

export function HubNotifications({ notifications, onDismiss }: HubNotificationsProps) {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {notifications.map(notification => {
        const style = STYLES[notification.type];
        return (
          <div
            key={notification.id}
            className={`animate-slide-in-right pointer-events-auto flex items-start gap-3 rounded-card border ${style.ring} bg-surface-2 p-3 shadow-pop`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.accent}`}
            >
              <Icon name={style.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight text-ink">
                {notification.title}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                {notification.message}
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(notification.id)}
              className="-mr-1 -mt-1 rounded-lg p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
