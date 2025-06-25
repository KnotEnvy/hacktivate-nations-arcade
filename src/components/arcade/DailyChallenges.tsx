// ===== src/components/arcade/DailyChallenges.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { Challenge, ChallengeService } from '@/services/ChallengeService';

interface DailyChallengesProps {
  challengeService: ChallengeService;
  onChallengeComplete?: (challenge: Challenge) => void;
}

export function DailyChallenges({ challengeService, onChallengeComplete }: DailyChallengesProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    setChallenges(challengeService.getChallenges());
    const unsubscribe = challengeService.onChallengesChanged((newChallenges) => {
      setChallenges(newChallenges);
    });
    const unsubscribeComplete = challengeService.onChallengeCompleted((challenge) => {
      onChallengeComplete?.(challenge);
    });

    return () => {
      unsubscribe();
      unsubscribeComplete();
    };
  }, [challengeService, onChallengeComplete]);

  const dailyChallenges = challenges.filter(c => c.type === 'daily');
  
  if (dailyChallenges.length === 0) {
    return (
      <div className="arcade-panel">
        <h3 className="text-lg font-bold text-white mb-4">Daily Challenges</h3>
        <p className="text-gray-300">No challenges available</p>
      </div>
    );
  }

  return (
    <div className="arcade-panel">
      <h3 className="text-lg font-bold text-white mb-4">🎯 Daily Challenges</h3>
      
      <div className="space-y-3">
        {dailyChallenges.map(challenge => (
          <div
            key={challenge.id}
            className={`p-3 rounded-lg border transition-all ${
              challenge.completed
                ? 'bg-green-900 border-green-500 opacity-75'
                : 'bg-gray-800 border-gray-600 hover:border-gray-500'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className={`font-semibold ${
                  challenge.completed ? 'text-green-300' : 'text-white'
                }`}>
                  {challenge.title}
                  {challenge.completed && ' ✅'}
                </h4>
                <p className="text-sm text-gray-300">{challenge.description}</p>
              </div>
              <div className="text-right">
                <div className="text-yellow-400 font-bold">+{challenge.reward}</div>
                <div className="text-xs text-gray-400">coins</div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  challenge.completed ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%`
                }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <span>{challenge.progress} / {challenge.target}</span>
              <span>{Math.round((challenge.progress / challenge.target) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-xs text-gray-400 text-center">
        Challenges reset daily at midnight
      </div>
    </div>
  );
}
