// ===== src/components/arcade/SyncStatus.tsx =====
'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Menu } from '@/components/ui/Menu';
import type { SyncOutboxDiagnostics } from '@/services/SupabaseSyncOutbox';

interface SyncStatusProps {
  pendingCount: number;
  isSyncing: boolean;
  isOffline: boolean;
  diagnostics: SyncOutboxDiagnostics;
  onRetry: () => void;
}

type Level = 'syncing' | 'offline' | 'failed' | 'queued';

const LEVEL_STYLES: Record<Level, string> = {
  syncing: 'border-line bg-surface-2 text-ink-muted',
  offline: 'border-line-strong bg-surface-3 text-ink-muted',
  failed: 'border-bad/40 bg-bad-dim text-bad',
  queued: 'border-coin/30 bg-coin-dim text-coin',
};

/**
 * Queued-progress state lives behind a single header chip instead of a wall of
 * text: the chip says how bad it is, the popover says what to do about it.
 */
export function SyncStatus({
  pendingCount,
  isSyncing,
  isOffline,
  diagnostics,
  onRetry,
}: SyncStatusProps) {
  if (pendingCount <= 0) return null;

  const level: Level = isSyncing
    ? 'syncing'
    : isOffline
      ? 'offline'
      : diagnostics.failedCount > 0
        ? 'failed'
        : 'queued';

  const plural = pendingCount === 1 ? '' : 's';
  const summary =
    level === 'syncing'
      ? `Syncing ${pendingCount}`
      : level === 'offline'
        ? 'Offline'
        : level === 'failed'
          ? `${pendingCount} stuck`
          : `${pendingCount} queued`;

  const detail =
    level === 'syncing'
      ? `Sending ${pendingCount} pending change${plural} to your account.`
      : level === 'offline'
        ? `${pendingCount} change${plural} will send as soon as you are back online.`
        : level === 'failed'
          ? `${pendingCount} change${plural} queued after ${diagnostics.highestRetryCount} failed attempt${
              diagnostics.highestRetryCount === 1 ? '' : 's'
            }.`
          : `${pendingCount} change${plural} waiting to sync.`;

  return (
    <Menu
      ariaLabel="Progress sync status"
      testId="sync-status"
      triggerClassName={`h-9 px-2.5 text-xs ${LEVEL_STYLES[level]}`}
      label={
        <>
          <Icon
            name={level === 'failed' ? 'alert' : 'cloud'}
            size={14}
            className={isSyncing ? 'animate-pulse' : undefined}
          />
          <span className="tabular">{summary}</span>
        </>
      }
    >
      {close => (
        <div className="w-64 p-1.5">
          <div className="px-1 text-sm font-semibold text-ink">Progress sync</div>
          <p className="mt-1 px-1 text-xs leading-relaxed text-ink-muted">{detail}</p>
          {diagnostics.lastError && (
            <p className="mt-2 rounded-lg bg-bad-dim px-2 py-1.5 text-[11px] leading-relaxed text-bad">
              {diagnostics.lastError}
            </p>
          )}
          {!isSyncing && (
            <Button
              block
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={isOffline}
              onClick={() => {
                onRetry();
                close();
              }}
            >
              {isOffline ? 'Waiting for connection' : 'Retry now'}
            </Button>
          )}
        </div>
      )}
    </Menu>
  );
}
