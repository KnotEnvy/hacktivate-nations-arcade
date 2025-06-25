// ===== src/components/arcade/AchievementPanel.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { Achievement, AchievementService } from '@/services/AchievementService';

interface AchievementPanelProps {
  achievementService: AchievementService;
}

export function AchievementPanel({ achievementService }: AchievementPanelProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    setAchievements(achievementService.getAchievements());
    
    const unsubscribe = achievementService.onAchievementsChanged(setAchievements);
    return unsubscribe;
  }, [achievementService]);

  const categories = [
    { id: 'all', name: 'All', icon: '🏆' },
    { id: 'gameplay', name: 'Gameplay', icon: '🎮' },
    { id: 'progression', name: 'Progress', icon: '📈' },
    { id: 'skill', name: 'Skill', icon: '⚡' },
    { id: 'collection', name: 'Collection', icon: '💎' },
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="arcade-panel">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">🏆 Achievements</h3>
        <div className="text-sm text-gray-300">
          {unlockedCount} / {achievements.length}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === category.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category.icon} {category.name}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.id}
            className={`p-3 rounded-lg border transition-all ${
              achievement.unlocked
                ? 'bg-yellow-900 border-yellow-500 shadow-lg'
                : 'bg-gray-800 border-gray-600 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{achievement.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`font-semibold ${
                      achievement.unlocked ? 'text-yellow-300' : 'text-gray-300'
                    }`}>
                      {achievement.title}
                      {achievement.unlocked && ' ✨'}
                    </h4>
                    <p className="text-sm text-gray-400">{achievement.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold">+{achievement.reward}</div>
                    <div className="text-xs text-gray-400">coins</div>
                  </div>
                </div>
                
                {achievement.unlockedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    Unlocked {achievement.unlockedAt.toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No achievements in this category
        </div>
      )}
    </div>
  );
}
