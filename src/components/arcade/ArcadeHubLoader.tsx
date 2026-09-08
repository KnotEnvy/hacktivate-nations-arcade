'use client';

import dynamic from 'next/dynamic';

const ArcadeHub = dynamic(
  () => import('./ArcadeHub').then(module => module.ArcadeHub),
  {
    ssr: false,
    loading: () => <ArcadeStartupShell />,
  }
);

/**
 * The first paint. It deliberately mirrors the real hub's header height and
 * canvas colour so the swap to the loaded hub reads as content arriving rather
 * than the page changing shape.
 */
function ArcadeStartupShell() {
  return (
    <div className="min-h-screen bg-canvas px-4 text-ink">
      <header className="mb-6 border-b border-line">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2.5">
          <span
            aria-hidden
            className="h-8 w-8 shrink-0 rounded-lg bg-brand opacity-60"
          />
          <div className="font-display text-sm font-bold tracking-tight text-ink sm:text-base">
            Hacktivate Nations Arcade
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center rounded-panel border border-line bg-surface px-8 py-12 text-center shadow-panel">
        <div className="loading-spinner mb-5 h-10 w-10" />
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
          Arcade boot
        </div>
        <h2 className="mt-2 text-xl font-bold text-ink">Loading arcade systems</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Preparing auth, sync, games and progression.
        </p>
      </main>
    </div>
  );
}

export function ArcadeHubLoader() {
  return <ArcadeHub />;
}
