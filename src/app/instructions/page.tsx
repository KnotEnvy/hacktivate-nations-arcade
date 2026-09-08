import Link from 'next/link';
import { TIER_LABELS } from '@/lib/constants';
import { getTierGameIncrement, getTierUnlockCost } from '@/lib/unlocks';
import { formatCoins } from '@/lib/utils';

export const metadata = {
  title: 'How to Play - HacktivateNations Arcade',
};

const TIERS = [0, 1, 2, 3, 4];

export default function InstructionsPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to Arcade
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold text-ink">How to Play</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The arcade is one shared progression loop: play games, earn coins, open more
          of the cabinet.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-bold text-ink">Getting started</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Play games to earn <span className="font-semibold text-coin">coins</span>.
            Coins unlock tiers, then the games inside them. Endless Runner is free from
            the start, so you always have somewhere to begin.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold text-ink">The unlock ladder</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            A tier is a shelf. Open the shelf first, then buy the games on it. Each
            purchase inside a tier raises the price of the next one on that same shelf.
          </p>

          <div className="overflow-hidden rounded-panel border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <th className="px-4 py-2.5">Tier</th>
                  <th className="px-4 py-2.5">Opens for</th>
                  <th className="px-4 py-2.5">Each game adds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-line)] bg-surface">
                {TIERS.map(tier => (
                  <tr key={tier}>
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {tier} · {TIER_LABELS[tier]}
                    </td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">
                      {tier === 0
                        ? 'Open by default'
                        : `${formatCoins(getTierUnlockCost(tier))} coins`}
                    </td>
                    <td className="tabular px-4 py-2.5 text-ink-muted">
                      +{formatCoins(getTierGameIncrement(tier))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold text-ink">Daily challenges</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Three challenges refresh every day. Each pays bonus coins, and clearing all
            three applies a 1.5× coin multiplier.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold text-ink">Achievements</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            One-time milestones across every game in the arcade. Each pays out once,
            and they are the fastest route to the higher tiers.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-bold text-ink">Your profile</h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            Level, play time, coins earned and per-game stats live on your account and
            follow you to any device you sign in on.
          </p>
        </section>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-control bg-brand px-5 font-semibold text-white transition-colors hover:bg-brand-bright"
          >
            Start playing
          </Link>
        </div>
      </div>
    </main>
  );
}
