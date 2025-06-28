// ===== src/components/arcade/UserProfile.tsx =====
'use client';

import { useEffect, useState } from 'react';
import { UserProfile as UserProfileType, UserStats, UserService } from '@/services/UserServices';
import { Analytics } from '@/services/Analytics';

interface UserProfileProps {
  userService: UserService;
}

export function UserProfile({ userService }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfileType>(userService.getProfile());
  const [stats, setStats] = useState<UserStats>(userService.getStats());
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [insights, setInsights] = useState<ReturnType<Analytics['getPlayerInsights']> | null>(null);
  const [metrics, setMetrics] = useState<ReturnType<Analytics['getPlayerMetrics']> | null>(null);

  useEffect(() => {
    const unsubscribe = userService.onUserDataChanged((newProfile, newStats) => {
      setProfile(newProfile);
      setStats(newStats);
    });

    return unsubscribe;
  }, [userService]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const analytics = new Analytics();
    void analytics.init().then(() => {
      setInsights(analytics.getPlayerInsights());
      setMetrics(analytics.getPlayerMetrics());
    });
  }, []);

  const currentLevelXp = UserService.experienceForLevel(profile.level);
  const nextLevelXp = UserService.experienceForLevel(profile.level + 1);
  const experienceToNextLevel = nextLevelXp - profile.experience;
  const experienceProgress =
    (profile.experience - currentLevelXp) / (nextLevelXp - currentLevelXp);

  const handleAvatarChange = (newAvatar: string) => {
    userService.updateProfile({ avatar: newAvatar });
    setShowAvatarSelect(false);
  };

  return (
    <div className="arcade-panel">
      <h3 className="text-lg font-bold text-white mb-4">👤 Player Profile</h3>
      
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setShowAvatarSelect(!showAvatarSelect)}
          className="text-4xl hover:scale-110 transition-transform cursor-pointer"
        >
          {profile.avatar}
        </button>
        <div>
          <h4 className="text-xl font-bold text-white">{profile.username}</h4>
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-bold">Level {profile.level}</span>
            <div className="w-24 bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${experienceProgress * 100}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {experienceToNextLevel} XP to next level
          </div>
        </div>
      </div>

      {/* Avatar selection */}
      {showAvatarSelect && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <h5 className="text-sm font-bold text-white mb-2">Choose Avatar:</h5>
          <div className="grid grid-cols-4 gap-2">
            {userService.getAvailableAvatars().map(avatar => (
              <button
                key={avatar}
                onClick={() => handleAvatarChange(avatar)}
                className={`text-2xl p-2 rounded-lg transition-all hover:scale-110 ${
                  profile.avatar === avatar ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-purple-400 font-bold">{profile.totalCoins}</div>
          <div className="text-gray-400">Total Coins</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-blue-400 font-bold">{Math.floor(profile.totalPlayTime / 60)}m</div>
          <div className="text-gray-400">Play Time</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-yellow-300 font-bold">{stats.gamesPlayed}</div>
          <div className="text-gray-400">Games Played</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-green-300 font-bold">{stats.coinsEarned}</div>
          <div className="text-gray-400">Coins Earned</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-yellow-300 font-bold">{stats.achievementsUnlocked}</div>
          <div className="text-gray-400">Achievements</div>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="text-pink-400 font-bold">{stats.challengesCompleted}</div>
          <div className="text-gray-400">Challenges</div>
        </div>
      </div>

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-purple-300 mt-2 hover:underline"
      >
        {showDetails ? 'Hide Details ▲' : 'Show Details ▼'}
      </button>

      {showDetails && (
        <div className="grid grid-cols-2 gap-3 text-sm mt-2">
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-green-400 font-bold">{stats.totalDistance}m</div>
            <div className="text-gray-400">Total Distance</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-red-300 font-bold">{stats.maxSpeed.toFixed(2)}</div>
            <div className="text-gray-400">Max Speed</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-yellow-400 font-bold">{stats.maxCombo}x</div>
            <div className="text-gray-400">Max Combo</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-red-400 font-bold">{stats.totalJumps}</div>
            <div className="text-gray-400">Total Jumps</div>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-orange-400 font-bold">{stats.powerupsUsed}</div>
            <div className="text-gray-400">Power-ups Used</div>
          </div>
        </div>
      )}
      {mounted && (
        <>
          {/* Member since */}
          <div className="mt-4 text-xs text-gray-400 text-center">
            {profile.joinedAt.getTime() === 0
              ? 'Member since N/A'
              : `Member since ${profile.joinedAt.toLocaleDateString()}`}
          </div>
          {/* Last active */}
          <div className="text-xs text-gray-400 text-center">
            {profile.lastActiveAt.getTime() === 0
              ? 'Last active N/A'
              : `Last active ${profile.lastActiveAt.toLocaleDateString()} at ${profile.lastActiveAt.toLocaleTimeString()}`}
          </div>
          {insights && metrics && (
            <div className="mt-4 space-y-2 text-sm">
              <h4 className="text-purple-400 font-semibold text-center">Analytics</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 p-2 rounded-lg">
                  <div className="font-bold text-purple-300">{insights.skillLevel}</div>
                  <div className="text-gray-400 text-xs">Skill</div>
                </div>
                <div className="bg-gray-800 p-2 rounded-lg">
                  <div className="font-bold text-purple-300 capitalize">{insights.preferredGameLength}</div>
                  <div className="text-gray-400 text-xs">Pref Length</div>
                </div>
                <div className="bg-gray-800 p-2 rounded-lg col-span-2">
                  <div className="font-bold text-purple-300">{insights.mostPlayedGame}</div>
                  <div className="text-gray-400 text-xs">Top Game</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
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
          )}
        </>
      )}
    </div>
  );
}