// ===== src/components/arcade/AnalyticsOverview.tsx =====
'use client';

import { useEffect, useState } from 'react';
import {
  Analytics,
  type PlayerInsights,
  type PlayerMetrics,
  type ConversionMetrics,
} from '@/services/Analytics';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Chip';

interface AnalyticsOverviewProps {
  analyticsOwnerId?: string | null;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-line bg-surface-2 px-3 py-2.5">
      <div className="tabular truncate text-sm font-bold capitalize text-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

export function AnalyticsOverview({ analyticsOwnerId }: AnalyticsOverviewProps) {
  const [insights, setInsights] = useState<PlayerInsights | null>(null);
  const [conversion, setConversion] = useState<ConversionMetrics | null>(null);
  const [metrics, setMetrics] = useState<PlayerMetrics | null>(null);
  const [recommended, setRecommended] = useState<string[]>([]);

  useEffect(() => {
    const analytics = new Analytics(analyticsOwnerId);
    void analytics.init().then(() => {
      setInsights(analytics.getPlayerInsights());
      setConversion(analytics.getConversionMetrics());
      setMetrics(analytics.getPlayerMetrics());
      setRecommended(analytics.getRecommendedGames());
    });
  }, [analyticsOwnerId]);

  if (!insights || !conversion || !metrics) return null;

  const percent = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <Panel>
      <PanelHeader
        eyebrow="This device"
        title="Play insights"
        actions={<Tag tone="brand">{insights.skillLevel}</Tag>}
      />

      <div className="mt-4 space-y-4">
        <Group title="Your play">
          <Metric label="Games played" value={metrics.gamesPlayed} />
          <Metric label="Play time" value={`${Math.floor(metrics.totalPlayTime / 60000)}m`} />
          <Metric
            label="Avg session"
            value={`${Math.round(metrics.averageSessionLength / 60000)}m`}
          />
          <Metric label="Average score" value={Math.round(insights.averageScore)} />
          <Metric label="Favourite game" value={metrics.favoriteGame} />
          <Metric label="Preferred length" value={insights.preferredGameLength} />
        </Group>

        <Group title="Engagement">
          <Metric label="Start rate" value={percent(conversion.gameStartRate)} />
          <Metric label="Completion rate" value={percent(conversion.completionRate)} />
          <Metric label="Return rate" value={percent(conversion.retentionRate)} />
          <Metric label="Spend rate" value={percent(conversion.monetizationRate)} />
        </Group>

        {insights.improvementAreas.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              Tips
            </h4>
            <ul className="space-y-1.5">
              {insights.improvementAreas.map(area => (
                <li
                  key={area}
                  className="flex gap-2 text-[13px] leading-relaxed text-ink-muted"
                >
                  <span aria-hidden className="text-brand-bright">
                    •
                  </span>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommended.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              Recommended next
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {recommended.map(gameId => (
                <Tag key={gameId} tone="neutral">
                  {gameId}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
