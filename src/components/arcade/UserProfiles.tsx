// ===== src/components/arcade/UserProfile.tsx =====
'use client';

import { useEffect, useState } from 'react';
import {
  MAX_LEVEL,
  UserProfile as UserProfileType,
  UserStats,
  UserService,
} from '@/services/UserServices';

interface UserProfileProps {
  userService: UserService;
}

interface CompactPlayerBadgeProps extends UserProfileProps {
  onOpenProfile?: () => void;
}

function getLevelProgress(profile: UserProfileType) {
  const isMaxLevel = profile.level >= MAX_LEVEL;
  const currentLevelXp = UserService.experienceForLevel(profile.level);
  const nextLevelXp = isMaxLevel
    ? currentLevelXp
    : UserService.experienceForLevel(profile.level + 1);
  const experienceToNextLevel = isMaxLevel
    ? 0
    : Math.max(0, nextLevelXp - profile.experience);
  const rawProgress = isMaxLevel
    ? 1
    : (profile.experience - currentLevelXp) / (nextLevelXp - currentLevelXp);
  const experienceProgress = Math.min(1, Math.max(0, rawProgress));

  return {
    isMaxLevel,
    experienceToNextLevel,
    experienceProgress,
  };
}

function useUserProfileSnapshot(userService: UserService) {
  const [profile, setProfile] = useState<UserProfileType>(userService.getProfile());
  const [stats, setStats] = useState<UserStats>(userService.getStats());

  useEffect(() => {
    const unsubscribe = userService.onUserDataChanged((newProfile, newStats) => {
      setProfile(newProfile);
      setStats(newStats);
    });

    return unsubscribe;
  }, [userService]);

  return { profile, stats };
}

export function CompactPlayerBadge({ userService, onOpenProfile }: CompactPlayerBadgeProps) {
  const { profile } = useUserProfileSnapshot(userService);
  const { isMaxLevel, experienceToNextLevel, experienceProgress } =
    getLevelProgress(profile);

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className="group min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-left text-white shadow-[0_14px_34px_rgba(0,0,0,0.28)] transition-colors hover:border-cyan-300/40 hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      aria-label="Open player profile"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-2xl">
          {profile.avatar}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-bold text-white">{profile.username}</div>
            <div className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[11px] font-bold text-purple-100">
              Lv {profile.level}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700/90">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-200 transition-all"
                style={{ width: `${experienceProgress * 100}%` }}
              />
            </div>
            <div className="whitespace-nowrap text-[11px] text-slate-300">
              {isMaxLevel ? 'Max' : `${experienceToNextLevel} XP`}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function UserProfile({ userService }: UserProfileProps) {
  const { profile, stats } = useUserProfileSnapshot(userService);
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isMaxLevel, experienceToNextLevel, experienceProgress } =
    getLevelProgress(profile);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAvatarChange = (newAvatar: string) => {
    userService.updateProfile({ avatar: newAvatar });
    setShowAvatarSelect(false);
  };

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.38),0_0_42px_rgba(34,211,238,0.12)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">
            Player Profile
          </div>
          <h3 className="mt-1 text-2xl font-black text-white">{profile.username}</h3>
        </div>
        <button
          onClick={() => setShowAvatarSelect(!showAvatarSelect)}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-300/30 bg-purple-300/10 text-4xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Change avatar"
        >
          {profile.avatar}
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-purple-100">Level {profile.level}</div>
          <div className="text-xs text-slate-300">
            {isMaxLevel ? 'MAX LEVEL REACHED' : `${experienceToNextLevel} XP to next level`}
          </div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-200 transition-all"
            style={{ width: `${experienceProgress * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-amber-200">{profile.totalCoins}</div>
            <div className="text-slate-400">Lifetime Coins</div>
          </div>
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-cyan-200">
              {Math.floor(profile.totalPlayTime / 60)}m
            </div>
            <div className="text-slate-400">Play Time</div>
          </div>
        </div>
      </div>

      {showAvatarSelect && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-slate-900/90 p-3">
          <h5 className="mb-2 text-sm font-bold text-white">Choose Avatar</h5>
          <div className="grid grid-cols-4 gap-2">
            {userService.getAvailableAvatars().map(avatar => (
              <button
                key={avatar}
                onClick={() => handleAvatarChange(avatar)}
                className={`rounded-xl p-2 text-2xl transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                  profile.avatar === avatar
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl bg-slate-900/80 p-3">
          <div className="font-bold text-yellow-200">{stats.gamesPlayed}</div>
          <div className="text-slate-400">Games Played</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <div className="font-bold text-emerald-200">{stats.coinsEarned}</div>
          <div className="text-slate-400">Coins Earned</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <div className="font-bold text-purple-200">{stats.achievementsUnlocked}</div>
          <div className="text-slate-400">Achievements</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <div className="font-bold text-pink-200">{stats.challengesCompleted}</div>
          <div className="text-slate-400">Challenges</div>
        </div>
      </div>

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 text-sm font-semibold text-cyan-200 hover:text-white"
      >
        {showDetails ? 'Hide Details' : 'Show Details'}
      </button>

      {showDetails && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-emerald-200">{stats.totalDistance}m</div>
            <div className="text-slate-400">Total Distance</div>
          </div>
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-red-200">{stats.maxSpeed.toFixed(2)}</div>
            <div className="text-slate-400">Max Speed</div>
          </div>
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-yellow-200">{stats.maxCombo}x</div>
            <div className="text-slate-400">Max Combo</div>
          </div>
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-red-200">{stats.totalJumps}</div>
            <div className="text-slate-400">Total Jumps</div>
          </div>
          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="font-bold text-orange-200">{stats.powerupsUsed}</div>
            <div className="text-slate-400">Power-ups Used</div>
          </div>
        </div>
      )}

      {mounted && (
        <>
          <div className="mt-5 text-center text-xs text-slate-400">
            {profile.joinedAt.getTime() === 0
              ? 'Member since N/A'
              : `Member since ${profile.joinedAt.toLocaleDateString()}`}
          </div>
          <div className="text-center text-xs text-slate-400">
            {profile.lastActiveAt.getTime() === 0
              ? 'Last active N/A'
              : `Last active ${profile.lastActiveAt.toLocaleDateString()} at ${profile.lastActiveAt.toLocaleTimeString()}`}
          </div>
        </>
      )}
    </div>
  );
}
