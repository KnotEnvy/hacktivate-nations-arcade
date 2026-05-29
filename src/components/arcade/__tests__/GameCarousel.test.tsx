import { render, screen, fireEvent } from '@testing-library/react';
import { GameCarousel } from '@/components/arcade/GameCarousel';
import type { GameManifest } from '@/lib/types';

// `runner` (tier 0, default-unlocked) and `space` (tier 2) are real,
// implemented/registered game IDs in the game registry, so the component's
// `isGameImplemented` checks resolve deterministically.
const RUNNER: GameManifest = {
  id: 'runner',
  title: 'Endless Runner',
  thumbnail: '/games/runner/runner-thumb.svg',
  inputSchema: ['keyboard', 'touch'],
  assetBudgetKB: 50,
  tier: 0,
  description: 'Jump and collect coins!',
};

const SPACE: GameManifest = {
  id: 'space',
  title: 'Space Shooter',
  thumbnail: '/games/space/space-thumb.svg',
  inputSchema: ['keyboard'],
  assetBudgetKB: 100,
  tier: 2,
  description: 'Defend Earth!',
};

function renderCarousel(overrides: Partial<React.ComponentProps<typeof GameCarousel>> = {}) {
  const props: React.ComponentProps<typeof GameCarousel> = {
    games: [RUNNER, SPACE],
    unlockedTiers: [0],
    unlockedGames: [],
    currentCoins: 0,
    onGameSelect: jest.fn(),
    onTierUnlock: jest.fn(),
    onGameUnlock: jest.fn(),
    ...overrides,
  };
  const utils = render(<GameCarousel {...props} />);
  return { ...utils, props };
}

describe('GameCarousel', () => {
  it('renders the carousel shell and a card per game', () => {
    renderCarousel();
    expect(screen.getByTestId('game-carousel')).toBeInTheDocument();
    expect(screen.getByTestId('game-card-runner')).toBeInTheDocument();
    expect(screen.getByTestId('game-card-space')).toBeInTheDocument();
    expect(screen.getByText('Endless Runner')).toBeInTheDocument();
    expect(screen.getByText('Space Shooter')).toBeInTheDocument();
  });

  it('shows a Play button for the default-unlocked tier-0 game and fires onGameSelect', () => {
    const { props } = renderCarousel();
    const playButton = screen.getByTestId('game-play-runner');
    expect(playButton).toBeInTheDocument();

    fireEvent.click(playButton);
    expect(props.onGameSelect).toHaveBeenCalledWith('runner');
  });

  it('renders a locked tier overlay with a disabled unlock button when coins are insufficient', () => {
    renderCarousel({ unlockedTiers: [0], currentCoins: 0 });
    const tierUnlock = screen.getByTestId('tier-unlock-2');
    expect(tierUnlock).toBeInTheDocument();
    // Tier 2 costs 5000; with 0 coins the unlock button is disabled.
    expect(tierUnlock).toBeDisabled();
  });

  it('enables the tier unlock button and fires onTierUnlock when coins suffice', () => {
    const { props } = renderCarousel({ unlockedTiers: [0], currentCoins: 5000 });
    const tierUnlock = screen.getByTestId('tier-unlock-2');
    expect(tierUnlock).not.toBeDisabled();

    fireEvent.click(tierUnlock);
    // Tier 2 unlock cost is 5000.
    expect(props.onTierUnlock).toHaveBeenCalledWith(2, 5000);
  });

  it('shows a game unlock button inside an unlocked tier and fires onGameUnlock', () => {
    const { props } = renderCarousel({
      unlockedTiers: [0, 2],
      unlockedGames: [],
      currentCoins: 5000,
    });

    const gameUnlock = screen.getByTestId('game-unlock-space');
    expect(gameUnlock).toBeInTheDocument();

    fireEvent.click(gameUnlock);
    // First paid game in tier 2: increment(5000) * (0 + 1) = 5000.
    expect(props.onGameUnlock).toHaveBeenCalledWith('space', 5000);
  });

  it('shows a Play button for an already-unlocked paid game', () => {
    const { props } = renderCarousel({
      unlockedTiers: [0, 2],
      unlockedGames: ['space'],
      currentCoins: 0,
    });

    const playSpace = screen.getByTestId('game-play-space');
    expect(playSpace).toBeInTheDocument();

    fireEvent.click(playSpace);
    expect(props.onGameSelect).toHaveBeenCalledWith('space');
  });

  it('selecting a card highlights it without triggering game selection', () => {
    const { props } = renderCarousel({ unlockedTiers: [0] });
    const card = screen.getByTestId('game-card-space');

    fireEvent.click(card);
    // Clicking the card body should not select/play a game.
    expect(props.onGameSelect).not.toHaveBeenCalled();
    expect(card.className).toContain('ring-2');
  });
});
