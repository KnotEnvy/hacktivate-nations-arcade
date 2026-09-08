// ===== src/components/arcade/DailyChallenges.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { Challenge, ChallengeService } from '@/services/ChallengeService';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Chip';
import { cn, formatCoins } from '@/lib/utils';

interface DailyChallengesProps {
  challengeService: ChallengeService;
}

export function DailyChallenges({ challengeService }: DailyChallengesProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    setChallenges(challengeService.getChallenges());
    const unsubscribe = challengeService.onChallengesChanged(newChallenges => {
      setChallenges(newChallenges);
    });

    return () => {
      unsubscribe();
    };
  }, [challengeService]);

  const dailyChallenges = challenges.filter(c => c.type === 'daily');

  if (dailyChallenges.length === 0) {
    return (
      <Panel>
        <PanelHeader eyebrow="Resets at midnight" title="Daily challenges" />
        <p className="mt-4 text-sm text-ink-muted">No challenges available</p>
      </Panel>
    );
  }

  const completedCount = dailyChallenges.filter(c => c.completed).length;
  const allDone = completedCount === dailyChallenges.length;

  return (
    <Panel testId="daily-challenges">
      <PanelHeader
        eyebrow="Resets at midnight"
        title="Daily challenges"
        actions={
          <Tag tone={allDone ? 'good' : 'neutral'}>
            {allDone && <Icon name="check" size={11} />}
            {completedCount}/{dailyChallenges.length}
          </Tag>
        }
      />

      <div className="mt-4 space-y-2.5">
        {dailyChallenges.map(challenge => {
          const percent = Math.round(
            Math.min(100, (challenge.progress / challenge.target) * 100)
          );

          return (
            <div
              key={challenge.id}
              className={cn(
                'rounded-card border p-3.5 transition-colors',
                challenge.completed
                  ? 'border-good/25 bg-good-dim/40'
                  : 'border-line bg-surface-2'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4
                    className={cn(
                      'text-sm font-bold leading-tight',
                      challenge.completed ? 'text-good' : 'text-ink'
                    )}
                  >
                    {challenge.title}
                    {challenge.completed && ' ✅'}
                  </h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                    {challenge.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular text-sm font-bold text-coin">
                    +{formatCoins(challenge.reward)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint">
                    coins
                  </div>
                </div>
              </div>

              <ProgressBar
                className="mt-3"
                size="sm"
                value={challenge.progress}
                max={challenge.target}
                tone={challenge.completed ? 'good' : 'brand'}
                label={`${challenge.title} progress`}
              />

              <div className="tabular mt-2 flex justify-between text-[11px] text-ink-faint">
                <span>
                  {challenge.progress} / {challenge.target}
                </span>
                <span>{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
