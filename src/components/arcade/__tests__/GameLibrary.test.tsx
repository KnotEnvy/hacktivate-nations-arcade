import { render, screen, fireEvent, within } from '@testing-library/react';
import { GameLibrary } from '@/components/arcade/GameLibrary';
import type { GameManifest } from '@/lib/types';

// `runner` (tier 0, default-unlocked) and `space` (tier 2) are real,
// implemented/registered game IDs in the game registry, so the library's
// `isGameImplemented` checks resolve deterministically. `ice-hockey` is a real
// catalog-only entry, so it always resolves as coming soon.
const RUNNER: GameManifest = {
  id: 'runner',
  title: 'Endless Runner',
  thumbnail: '/games/runner/runner-thumb.svg',
  inputSchema: ['keyboard', 'touch'],
  assetBudgetKB: 50,
  tier: 0,
  category: 'Action',
  tagline: 'Run, jump, never stop',
  description: 'Jump and collect coins!',
};

const SPACE: GameManifest = {
  id: 'space',
  title: 'Space Shooter',
  thumbnail: '/games/space/space-thumb.svg',
  inputSchema: ['keyboard'],
  assetBudgetKB: 100,
  tier: 2,
  category: 'Shooter',
  tagline: 'Hold the line',
  description: 'Defend Earth!',
};

const ICE_HOCKEY: GameManifest = {
  id: 'ice-hockey',
  title: 'Ice Hockey',
  thumbnail: '/games/coming-soon-thumb.svg',
  inputSchema: ['keyboard'],
  assetBudgetKB: 200,
  tier: 3,
  category: 'Sports',
  tagline: 'Fast breaks on thin ice',
  description: 'Coming soon!',
};

function renderLibrary(
  overrides: Partial<React.ComponentProps<typeof GameLibrary>> = {}
) {
  const props: React.ComponentProps<typeof GameLibrary> = {
    games: [RUNNER, SPACE, ICE_HOCKEY],
    unlockedTiers: [0],
    unlockedGames: [],
    currentCoins: 0,
    onGameSelect: jest.fn(),
    onTierUnlock: jest.fn(),
    onGameUnlock: jest.fn(),
    ...overrides,
  };
  const utils = render(<GameLibrary {...props} />);
  return { ...utils, props };
}

describe('GameLibrary', () => {
  it('renders the library shell and a card per game', () => {
    renderLibrary();
    expect(screen.getByTestId('game-library')).toBeInTheDocument();
    expect(screen.getByTestId('game-card-runner')).toBeInTheDocument();
    expect(screen.getByTestId('game-card-space')).toBeInTheDocument();
    expect(screen.getByTestId('game-card-ice-hockey')).toBeInTheDocument();
  });

  it('marks each card with the status the player can act on', () => {
    renderLibrary({ unlockedTiers: [0], currentCoins: 0 });
    expect(screen.getByTestId('game-card-runner')).toHaveAttribute(
      'data-status',
      'playable'
    );
    expect(screen.getByTestId('game-card-space')).toHaveAttribute(
      'data-status',
      'tier-locked'
    );
    expect(screen.getByTestId('game-card-ice-hockey')).toHaveAttribute(
      'data-status',
      'coming-soon'
    );
  });

  it('features an unlocked game and plays it from the featured card', () => {
    const { props } = renderLibrary();
    const featured = screen.getByTestId('library-featured');
    expect(within(featured).getByText('Endless Runner')).toBeInTheDocument();

    fireEvent.click(within(featured).getByRole('button', { name: /Play now/i }));
    expect(props.onGameSelect).toHaveBeenCalledWith('runner');
  });

  it('plays a game from its card button', () => {
    const { props } = renderLibrary();
    fireEvent.click(screen.getByTestId('game-play-runner'));
    expect(props.onGameSelect).toHaveBeenCalledWith('runner');
  });

  it('disables the tier unlock button when coins are insufficient', () => {
    renderLibrary({ unlockedTiers: [0], currentCoins: 0 });
    // Tier 2 costs 5000; with 0 coins the unlock button is disabled.
    expect(screen.getByTestId('tier-unlock-2')).toBeDisabled();
  });

  it('enables the tier unlock button and fires onTierUnlock when coins suffice', () => {
    const { props } = renderLibrary({ unlockedTiers: [0], currentCoins: 5000 });
    const tierUnlock = screen.getByTestId('tier-unlock-2');
    expect(tierUnlock).not.toBeDisabled();

    fireEvent.click(tierUnlock);
    expect(props.onTierUnlock).toHaveBeenCalledWith(2, 5000);
  });

  it('shows a game unlock button inside an unlocked tier and fires onGameUnlock', () => {
    const { props } = renderLibrary({
      unlockedTiers: [0, 2],
      unlockedGames: [],
      currentCoins: 5000,
    });

    const gameUnlock = screen.getByTestId('game-unlock-space');
    fireEvent.click(gameUnlock);
    // First paid game in tier 2: increment(5000) * (0 + 1) = 5000.
    expect(props.onGameUnlock).toHaveBeenCalledWith('space', 5000);
  });

  it('shows a Play button for an already-unlocked paid game', () => {
    const { props } = renderLibrary({
      unlockedTiers: [0, 2],
      unlockedGames: ['space'],
      currentCoins: 0,
    });

    fireEvent.click(screen.getByTestId('game-play-space'));
    expect(props.onGameSelect).toHaveBeenCalledWith('space');
  });

  it('filters the grid by search term', () => {
    renderLibrary({ unlockedTiers: [0, 2], unlockedGames: ['space'] });

    fireEvent.change(screen.getByTestId('library-search'), {
      target: { value: 'space' },
    });

    expect(screen.getByTestId('game-card-space')).toBeInTheDocument();
    expect(screen.queryByTestId('game-card-runner')).not.toBeInTheDocument();
  });

  it('filters the grid by status', () => {
    renderLibrary({ unlockedTiers: [0] });

    fireEvent.click(screen.getByRole('button', { name: /Ready to play/i }));

    expect(screen.getByTestId('game-card-runner')).toBeInTheDocument();
    expect(screen.queryByTestId('game-card-space')).not.toBeInTheDocument();
    expect(screen.queryByTestId('game-card-ice-hockey')).not.toBeInTheDocument();
  });

  it('offers a way back when a filter matches nothing', () => {
    renderLibrary();

    fireEvent.change(screen.getByTestId('library-search'), {
      target: { value: 'nothing matches this' },
    });
    expect(screen.getByText(/Nothing matches those filters/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Clear filters/i })[0]);
    expect(screen.getByTestId('game-card-runner')).toBeInTheDocument();
  });

  it('features the most recently played game when there is play history', () => {
    renderLibrary({
      unlockedTiers: [0, 2],
      unlockedGames: ['space'],
      activity: {
        runner: { plays: 3, lastPlayed: Date.now() - 86_400_000 * 4 },
        space: { plays: 1, lastPlayed: Date.now() - 1000 },
      },
    });

    const featured = screen.getByTestId('library-featured');
    expect(within(featured).getByText('Space Shooter')).toBeInTheDocument();
    expect(within(featured).getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });
});
