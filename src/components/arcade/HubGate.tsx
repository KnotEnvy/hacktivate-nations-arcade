// ===== src/components/arcade/HubGate.tsx =====
'use client';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PLAYABLE_GAME_CATALOG } from '@/lib/gameCatalog';

/** Shown while a signed-in account's wallet, unlocks and progress hydrate. */
export function AccountLoading() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-panel border border-line bg-surface px-8 py-12 text-center shadow-panel">
      <div className="loading-spinner mb-5 h-10 w-10" />
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
        Account sync
      </div>
      <h2 className="mt-2 text-xl font-bold text-ink">Loading your arcade profile</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Pulling down your wallet, unlocks, challenges and achievements before the
        arcade opens.
      </p>
    </div>
  );
}

/** Shown when Supabase auth is not configured for this build at all. */
export function AuthUnavailable() {
  return (
    <div className="mx-auto max-w-lg rounded-panel border border-bad/30 bg-surface px-8 py-10 text-center shadow-panel">
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-bad-dim text-bad">
        <Icon name="alert" size={20} />
      </span>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-bad">
        Authentication unavailable
      </div>
      <h2 className="mt-2 text-2xl font-bold text-ink">
        This build cannot open the arcade right now
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Supabase auth is not configured. Production access requires a signed-in
        account, so the guest path has been removed.
      </p>
    </div>
  );
}

const GATE_POINTS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'coin',
    title: 'One wallet',
    body: 'Coins, tier unlocks and game unlocks stay tied to your account.',
  },
  {
    icon: 'medal',
    title: 'Progress that follows you',
    body: 'Challenges, achievements and stats sync across every device.',
  },
  {
    icon: 'trophy',
    title: 'Scores that count',
    body: 'Runs post to the leaderboards under your player identity.',
  },
];

interface SignInGateProps {
  onOpenAuth: () => void;
  authError?: string | null;
}

export function SignInGate({ onOpenAuth, authError }: SignInGateProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-8 rounded-panel border border-line bg-surface p-8 shadow-panel md:p-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-bright">
            Production access
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink md:text-4xl">
            Sign in to enter the arcade
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted md:text-base">
            Guest play has been retired. Every session runs against an authenticated
            player record, so your balance, unlocks and scores are always yours.
          </p>

          <dl className="mt-8 space-y-4">
            {GATE_POINTS.map(point => (
              <div key={point.title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-bright">
                  <Icon name={point.icon} size={16} />
                </span>
                <div>
                  <dt className="text-sm font-semibold text-ink">{point.title}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                    {point.body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-panel border border-line bg-surface-2 p-6">
          <div className="tabular font-display text-3xl font-bold text-ink">
            {PLAYABLE_GAME_CATALOG.length}
          </div>
          <div className="mt-1 text-sm text-ink-muted">
            games playable right now, with more in development.
          </div>

          <Button block size="lg" className="mt-6" onClick={onOpenAuth}>
            Open sign in
          </Button>

          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Use your assigned account, or create one from the sign-in dialog.
          </p>

          {authError && (
            <p className="mt-4 rounded-control border border-bad/30 bg-bad-dim px-3 py-2 text-sm text-bad">
              {authError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
