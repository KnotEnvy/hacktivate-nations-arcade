'use client';

import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TIER_UNLOCK_COSTS } from '@/lib/constants';
import { formatCoins } from '@/lib/utils';

interface OnboardingOverlayProps {
  onClose: () => void;
}

const STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'play',
    title: 'Play to earn',
    body: 'Every run pays out coins based on your score and pickups. Endless Runner is free from the start.',
  },
  {
    icon: 'lock',
    title: 'Open a tier, then buy its games',
    body: `Tiers open the shelf: ${formatCoins(TIER_UNLOCK_COSTS[1])} for Coin Op, ${formatCoins(
      TIER_UNLOCK_COSTS[2]
    )} for Main Floor, and up. Inside a tier each unlock raises the price of the next one.`,
  },
  {
    icon: 'target',
    title: 'Challenges and achievements',
    body: 'Three daily challenges pay bonus coins, and clearing all of them applies a 1.5× multiplier. Achievements pay out once.',
  },
  {
    icon: 'user',
    title: 'Your profile follows you',
    body: 'Level, play time and stats live on your account and sync across devices.',
  },
];

export function OnboardingOverlay({ onClose }: OnboardingOverlayProps) {
  return (
    <AccessibleDialog
      titleId="onboarding-title"
      onClose={onClose}
      overlayClassName="backdrop-blur-sm"
      testId="onboarding-overlay"
      className="animate-rise-in max-h-[85vh] w-full max-w-md overflow-y-auto rounded-panel border border-line bg-surface p-6 shadow-pop"
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-bright">
        Welcome
      </div>
      <h2 id="onboarding-title" className="mt-1 font-display text-xl font-bold text-ink">
        How the arcade works
      </h2>

      <div className="mt-5 space-y-4">
        {STEPS.map(step => (
          <div key={step.title} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-bright">
              <Icon name={step.icon} size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{step.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button block className="mt-6" onClick={onClose} data-testid="onboarding-finish">
        Got it
      </Button>

      <a
        href="/instructions"
        className="mt-3 block text-center text-xs font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Read the full instructions
      </a>
    </AccessibleDialog>
  );
}
