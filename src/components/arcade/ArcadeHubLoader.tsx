'use client';

import dynamic from 'next/dynamic';

const ArcadeHub = dynamic(
  () => import('./ArcadeHub').then(module => module.ArcadeHub),
  {
    ssr: false,
    loading: () => <ArcadeStartupShell />,
  }
);

function ArcadeStartupShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 px-4 py-6 text-white">
      <header className="mx-auto mb-8 flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div>
          <h1 className="font-arcade text-2xl font-bold">Hacktivate Nations Arcade</h1>
          <div className="text-xs text-purple-200/80">
            Earn coins - Unlock tiers - Chase highscores
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/30 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-5 h-12 w-12 rounded-full border-4 border-purple-200/30 border-t-cyan-200 animate-spin" />
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
          Arcade Boot
        </div>
        <h2 className="mt-4 text-3xl font-black">Loading arcade systems</h2>
        <p className="mt-3 text-sm text-gray-300">
          Preparing auth, sync, games, and progression.
        </p>
      </main>
    </div>
  );
}

export function ArcadeHubLoader() {
  return <ArcadeHub />;
}
