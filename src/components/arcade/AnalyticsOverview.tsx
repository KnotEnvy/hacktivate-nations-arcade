'use client';

import { useEffect, useState } from 'react';
import {
  Analytics,
  type PlayerInsights,
  type PlayerMetrics,
  type ConversionMetrics,
} from '@/services/Analytics';

export function AnalyticsOverview() {
  const [insights, setInsights] = useState<PlayerInsights | null>(null);
  const [conversion, setConversion] = useState<ConversionMetrics | null>(null);
  const [metrics, setMetrics] = useState<PlayerMetrics | null>(null);
  const [recommended, setRecommended] = useState<string[]>([]);

  useEffect(() => {
    const analytics = new Analytics();
    void analytics.init().then(() => {
      setInsights(analytics.getPlayerInsights());
      setConversion(analytics.getConversionMetrics());
      setMetrics(analytics.getPlayerMetrics());
      setRecommended(analytics.getRecommendedGames());
    });
  }, []);

  if (!insights || !conversion || !metrics) return null;

  return (
    <div className="arcade-panel">
      <h3 className="text-lg font-bold text-white mb-4">📊 Analytics Overview</h3>
      <div className="space-y-4 text-sm">
        <div>
          <h4 className="font-semibold text-purple-400 mb-2">Player Insights</h4>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">{insights.skillLevel}</div>
              <div className="text-gray-400 text-xs">Skill Level</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300 capitalize">
                {insights.preferredGameLength}
              </div>
              <div className="text-gray-400 text-xs">Preferred Length</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg col-span-2">
              <div className="font-bold text-purple-300">
                {insights.mostPlayedGame}
              </div>
              <div className="text-gray-400 text-xs">Most Played Game</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg col-span-2">
              <div className="font-bold text-purple-300">
                {Math.round(insights.averageScore)}
              </div>
              <div className="text-gray-400 text-xs">Average Score</div>
            </div>
          </div>
          {insights.improvementAreas.length > 0 && (
            <div className="text-gray-400">
              <div className="mb-1 font-semibold text-purple-400">
                Improvement Areas
              </div>
              <ul className="list-disc list-inside ml-2">
                {insights.improvementAreas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-purple-400 mb-2">Conversion Metrics</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">
                {(conversion.gameStartRate * 100).toFixed(0)}%
              </div>
              <div className="text-gray-400 text-xs">Start Rate</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">
                {(conversion.completionRate * 100).toFixed(0)}%
              </div>
              <div className="text-gray-400 text-xs">Completion Rate</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">
                {(conversion.retentionRate * 100).toFixed(0)}%
              </div>
              <div className="text-gray-400 text-xs">Return Rate</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">
                {(conversion.monetizationRate * 100).toFixed(0)}%
              </div>
              <div className="text-gray-400 text-xs">Spend Rate</div>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-purple-400 mb-2">Player Metrics</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">{metrics.gamesPlayed}</div>
              <div className="text-gray-400 text-xs">Games Played</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">{Math.floor(metrics.totalPlayTime / 60000)}m</div>
              <div className="text-gray-400 text-xs">Play Time</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">{Math.round(metrics.averageSessionLength / 60000)}m</div>
              <div className="text-gray-400 text-xs">Avg Session</div>
            </div>
            <div className="bg-gray-800 p-2 rounded-lg">
              <div className="font-bold text-purple-300">{metrics.favoriteGame}</div>
              <div className="text-gray-400 text-xs">Favorite Game</div>
            </div>
          </div>
        </div>
        {recommended.length > 0 && (
          <div>
            <h4 className="font-semibold text-purple-400 mb-2">Recommended Games</h4>
            <div className="flex flex-wrap gap-2">
              {recommended.map((g) => (
                <span
                  key={g}
                  className="bg-gray-800 text-gray-300 px-2 py-1 rounded-lg"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
