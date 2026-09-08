// ===== src/app/error.tsx =====
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-panel border border-line bg-surface p-8 text-center shadow-panel">
        <h2 className="font-display text-xl font-bold text-ink">
          The arcade hit a snag
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Something went wrong loading this screen. Restarting usually clears it, and
          your progress is saved to your account.
        </p>
        <div className="mt-6 space-y-2">
          <Button block onClick={reset}>
            Restart arcade
          </Button>
          <Button
            block
            variant="secondary"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Back to home
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs font-semibold text-ink-faint">
              Error details (development)
            </summary>
            <pre className="custom-scrollbar mt-2 overflow-auto rounded-control bg-canvas-deep p-3 text-xs text-bad">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
