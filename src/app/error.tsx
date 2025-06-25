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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🎮💥</div>
        <h2 className="text-2xl font-bold text-white mb-4">Oops! Game Crashed</h2>
        <p className="text-gray-300 mb-6">
          Something went wrong with the arcade. Don't worry, we can try to restart it!
        </p>
        <div className="space-y-3">
          <Button onClick={reset} className="arcade-button w-full">
            Restart Arcade
          </Button>
          <Button 
            onClick={() => window.location.href = '/'} 
            variant="outline"
            className="w-full"
          >
            Go to Home
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-400">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-red-400 bg-black bg-opacity-50 p-3 rounded overflow-auto custom-scrollbar">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
