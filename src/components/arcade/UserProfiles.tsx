// ===== src/components/arcade/UserProfile.tsx =====
'use client';

import { useEffect, useState } from 'react';
import {
  MAX_LEVEL,
  UserProfile as UserProfileType,
  UserStats,
  UserService,
} from '@/services/UserServices';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import { cn, formatCoins } from '@/lib/utils';

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

function StatCell({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: string | number;
  tone?: 'ink' | 'coin' | 'good' | 'brand';
}) {
  const toneClass = {
    ink: 'text-ink',
    coin: 'text-coin',
    good: 'text-good',
    brand: 'text-brand-bright',
  }[tone];

  return (
    <div className="rounded-card border border-line bg-surface-2 px-3 py-2.5">
      <div className={cn('tabular text-base font-bold leading-none', toneClass)}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}

export function CompactPlayerBadge({
  userService,
  onOpenProfile,
}: CompactPlayerBadgeProps) {
  const { profile } = useUserProfileSnapshot(userService);
  const { isMaxLevel, experienceToNextLevel, experienceProgress } =
    getLevelProgress(profile);

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      aria-label="Open player profile"
      className="hidden min-w-0 items-center gap-2.5 rounded-control border border-line bg-surface-2 px-2.5 py-1.5 text-left transition-colors hover:border-line-strong sm:flex"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-lg">
        {profile.avatar}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-ink">
            {profile.username}
          </span>
          <span className="tabular rounded bg-brand-dim px-1.5 py-0.5 text-[10px] font-bold text-brand-bright">
            {profile.level}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="block h-1 w-16 overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${experienceProgress * 100}%` }}
            />
          </span>
          <span className="tabular whitespace-nowrap text-[10px] text-ink-faint">
            {isMaxLevel ? 'Max' : `${experienceToNextLevel} XP`}
          </span>
        </span>
      </span>
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
    <Panel>
      <PanelHeader
        eyebrow="Player profile"
        title={profile.username}
        actions={
          <button
            onClick={() => setShowAvatarSelect(!showAvatarSelect)}
            aria-label="Change avatar"
            aria-expanded={showAvatarSelect}
            className="flex h-14 w-14 items-center justify-center rounded-panel border border-line bg-surface-2 text-3xl transition-colors hover:border-line-strong"
          >
            {profile.avatar}
          </button>
        }
      />

      {showAvatarSelect && (
        <div className="animate-rise-in mt-4 rounded-card border border-line bg-surface-2 p-3">
          <h5 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            Choose avatar
          </h5>
          <div className="grid grid-cols-6 gap-1.5">
            {userService.getAvailableAvatars().map(avatar => (
              <button
                key={avatar}
                onClick={() => handleAvatarChange(avatar)}
                className={cn(
                  'rounded-lg py-1.5 text-xl transition-colors',
                  profile.avatar === avatar
                    ? 'bg-brand-dim ring-1 ring-brand/50'
                    : 'bg-surface-3 hover:bg-surface-3/70'
                )}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-card border border-line bg-surface-2 p-4">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <div className="text-sm font-bold text-ink">Level {profile.level}</div>
          <div className="tabular text-xs text-ink-muted">
            {isMaxLevel ? 'Max level reached' : `${experienceToNextLevel} XP to next`}
          </div>
        </div>
        <ProgressBar
          value={experienceProgress * 100}
          max={100}
          tone={isMaxLevel ? 'good' : 'brand'}
          label="Level progress"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatCell
            label="Lifetime coins"
            value={formatCoins(profile.totalCoins)}
            tone="coin"
          />
          <StatCell
            label="Play time"
            value={`${Math.floor(profile.totalPlayTime / 60)}m`}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCell label="Games played" value={stats.gamesPlayed} />
        <StatCell label="Coins earned" value={formatCoins(stats.coinsEarned)} tone="coin" />
        <StatCell label="Achievements" value={stats.achievementsUnlocked} tone="brand" />
        <StatCell label="Challenges" value={stats.challengesCompleted} tone="good" />
      </div>

      <button
        onClick={() => setShowDetails(!showDetails)}
        aria-expanded={showDetails}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <Icon
          name="chevron-down"
          size={14}
          className={cn('transition-transform', showDetails && 'rotate-180')}
        />
        {showDetails ? 'Hide details' : 'Show details'}
      </button>

      {showDetails && (
        <div className="animate-rise-in mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <StatCell label="Total distance" value={`${stats.totalDistance}m`} />
          <StatCell label="Max speed" value={stats.maxSpeed.toFixed(2)} />
          <StatCell label="Max combo" value={`${stats.maxCombo}x`} />
          <StatCell label="Total jumps" value={stats.totalJumps} />
          <StatCell label="Power-ups used" value={stats.powerupsUsed} />
        </div>
      )}

      {mounted && (
        <div className="mt-5 space-y-0.5 text-center text-[11px] text-ink-faint">
          <div>
            {profile.joinedAt.getTime() === 0
              ? 'Member since N/A'
              : `Member since ${profile.joinedAt.toLocaleDateString()}`}
          </div>
          <div>
            {profile.lastActiveAt.getTime() === 0
              ? 'Last active N/A'
              : `Last active ${profile.lastActiveAt.toLocaleDateString()} at ${profile.lastActiveAt.toLocaleTimeString()}`}
          </div>
        </div>
      )}
    </Panel>
  );
}
