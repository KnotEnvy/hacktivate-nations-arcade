// ===== src/components/arcade/AchievementPanel.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { Achievement, AchievementService } from '@/services/AchievementService';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Chip } from '@/components/ui/Chip';
import { cn, formatCoins } from '@/lib/utils';

interface AchievementPanelProps {
  achievementService: AchievementService;
}

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'gameplay', name: 'Gameplay' },
  { id: 'progression', name: 'Progress' },
  { id: 'skill', name: 'Skill' },
  { id: 'collection', name: 'Collection' },
];

export function AchievementPanel({ achievementService }: AchievementPanelProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    setAchievements(achievementService.getAchievements());

    const unsubscribe = achievementService.onAchievementsChanged(setAchievements);
    return unsubscribe;
  }, [achievementService]);

  const filteredAchievements =
    selectedCategory === 'all'
      ? achievements
      : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Panel testId="achievements-panel">
      <PanelHeader
        eyebrow="One-time rewards"
        title="Achievements"
        actions={
          <span className="tabular text-sm font-semibold text-ink-muted">
            {unlockedCount} / {achievements.length}
          </span>
        }
      />

      <ProgressBar
        className="mt-3"
        size="sm"
        value={unlockedCount}
        max={achievements.length}
        tone="brand"
        label="Achievements unlocked"
      />

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(category => (
          <Chip
            key={category.id}
            selected={selectedCategory === category.id}
            onClick={() => setSelectedCategory(category.id)}
            className="h-8 px-3 text-xs"
          >
            {category.name}
          </Chip>
        ))}
      </div>

      <div className="custom-scrollbar mt-4 max-h-96 space-y-2.5 overflow-y-auto pr-1">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.id}
            className={cn(
              'flex items-start gap-3 rounded-card border p-3',
              achievement.unlocked
                ? 'border-coin/25 bg-coin-dim/40'
                : 'border-line bg-surface-2 opacity-70'
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg',
                achievement.unlocked ? 'bg-coin-dim' : 'bg-surface-3 grayscale'
              )}
            >
              {achievement.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4
                    className={cn(
                      'text-sm font-bold leading-tight',
                      achievement.unlocked ? 'text-coin' : 'text-ink'
                    )}
                  >
                    {achievement.title}
                    {achievement.unlocked && ' ✨'}
                  </h4>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                    {achievement.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular text-sm font-bold text-coin">
                    +{formatCoins(achievement.reward)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint">
                    coins
                  </div>
                </div>
              </div>

              {achievement.unlockedAt && (
                <div className="mt-1.5 text-[11px] text-ink-faint">
                  Unlocked {achievement.unlockedAt.toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredAchievements.length === 0 && (
          <div className="py-10 text-center text-sm text-ink-muted">
            No achievements in this category
          </div>
        )}
      </div>
    </Panel>
  );
}
