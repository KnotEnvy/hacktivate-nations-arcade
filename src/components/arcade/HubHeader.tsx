// ===== src/components/arcade/HubHeader.tsx =====
'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { cn } from '@/lib/utils';

export type ArcadeTab =
  | 'games'
  | 'leaderboards'
  | 'challenges'
  | 'achievements'
  | 'profile';

export const ARCADE_TABS: Array<{ id: ArcadeTab; label: string; icon: IconName }> = [
  { id: 'games', label: 'Games', icon: 'games' },
  { id: 'leaderboards', label: 'Leaderboards', icon: 'trophy' },
  { id: 'challenges', label: 'Challenges', icon: 'target' },
  { id: 'achievements', label: 'Achievements', icon: 'medal' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

interface HubHeaderProps {
  activeTab: ArcadeTab;
  onTabChange: (tab: ArcadeTab) => void;
  /** Tabs are hidden behind the auth gate and while a game is running. */
  showTabs: boolean;
  inGame: boolean;
  onBackToHub: () => void;
  signedIn: boolean;
  authDisabled: boolean;
  playerName: string;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenHelp: () => void;
  onOpenAudio: () => void;
  /** Right-hand cluster: coin balance and player badge, owned by the hub. */
  walletSlot?: ReactNode;
  playerSlot?: ReactNode;
  syncSlot?: ReactNode;
  /** Development-only actions, appended to the overflow menu. */
  devMenuItems?: ReactNode;
}

function TabList({
  activeTab,
  onTabChange,
  className,
}: Pick<HubHeaderProps, 'activeTab' | 'onTabChange'> & { className?: string }) {
  return (
    <nav
      aria-label="Arcade sections"
      className={cn('flex items-center gap-1 rounded-control bg-surface-2 p-1', className)}
    >
      {ARCADE_TABS.map(tab => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            data-testid={`arcade-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3',
              'text-[13px] font-semibold transition-colors duration-150',
              selected
                ? 'bg-surface-3 text-ink shadow-panel'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function HubHeader({
  activeTab,
  onTabChange,
  showTabs,
  inGame,
  onBackToHub,
  signedIn,
  authDisabled,
  playerName,
  onOpenAuth,
  onSignOut,
  onOpenHelp,
  onOpenAudio,
  walletSlot,
  playerSlot,
  syncSlot,
  devMenuItems,
}: HubHeaderProps) {
  return (
    <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3">
        {inGame && (
          <Button variant="secondary" size="sm" onClick={onBackToHub} className="-ml-1">
            <Icon name="arrow-left" size={16} />
            <span className="hidden sm:inline">Back to hub</span>
          </Button>
        )}

        <div className="flex min-w-0 items-center gap-2.5">
          {/* In a run the game's own title bar identifies the screen, so the
              wordmark steps aside and only the back action leads. */}
          {!inGame && (
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white"
            >
              <Icon name="games" size={18} />
            </span>
          )}
          <h1
            className={cn(
              'truncate font-display text-sm font-bold tracking-tight text-ink sm:text-base',
              // In a run the wordmark yields to the game's own title bar.
              inGame && 'sr-only'
            )}
          >
            Hacktivate Nations Arcade
          </h1>
        </div>

        {showTabs && (
          <TabList
            activeTab={activeTab}
            onTabChange={onTabChange}
            className="mx-auto hidden lg:flex"
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          {syncSlot}
          {walletSlot}
          {playerSlot}

          {!signedIn && !authDisabled && (
            <Button size="sm" onClick={onOpenAuth}>
              Sign in
            </Button>
          )}

          <Menu
            ariaLabel="More options"
            testId="hub-menu"
            triggerClassName="h-9 w-9 px-0"
            label={<Icon name="more" size={16} />}
          >
            {close => (
              <>
                {signedIn && (
                  <MenuLabel>Signed in as {playerName}</MenuLabel>
                )}
                <MenuItem
                  icon={<Icon name="help" size={16} />}
                  onClick={() => {
                    close();
                    onOpenHelp();
                  }}
                >
                  How to play
                </MenuItem>
                <MenuItem
                  icon={<Icon name="audio" size={16} />}
                  onClick={() => {
                    close();
                    onOpenAudio();
                  }}
                >
                  Audio settings
                </MenuItem>
                <MenuItem icon={<Icon name="sliders" size={16} />} href="/instructions">
                  Full instructions
                </MenuItem>
                {devMenuItems && (
                  <>
                    <MenuSeparator />
                    <MenuLabel>Development</MenuLabel>
                    {devMenuItems}
                  </>
                )}
                {signedIn && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Icon name="close" size={16} />}
                      tone="danger"
                      onClick={() => {
                        close();
                        onSignOut();
                      }}
                    >
                      Sign out
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Menu>
        </div>
      </div>

      {showTabs && (
        <div className="mx-auto max-w-7xl overflow-x-auto pb-3 scrollbar-none lg:hidden">
          <TabList activeTab={activeTab} onTabChange={onTabChange} className="w-max" />
        </div>
      )}
    </header>
  );
}
