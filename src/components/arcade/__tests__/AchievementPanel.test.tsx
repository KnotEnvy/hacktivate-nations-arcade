import { render, screen, fireEvent, act } from '@testing-library/react';
import { AchievementPanel } from '@/components/arcade/AchievementPanel';
import type { Achievement, AchievementService } from '@/services/AchievementService';

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 'a1',
    title: 'First Steps',
    description: 'Play your first game',
    icon: '🎮',
    category: 'gameplay',
    requirement: { type: 'games_played', value: 1 },
    reward: 50,
    unlocked: false,
    ...overrides,
  };
}

/**
 * Minimal stand-in for AchievementService exposing only the methods the
 * component consumes, to avoid pulling in the achievement data set / storage.
 */
function makeFakeService(initial: Achievement[]) {
  let listener: ((a: Achievement[]) => void) | null = null;
  const service = {
    getAchievements: jest.fn(() => initial),
    onAchievementsChanged: jest.fn((cb: (a: Achievement[]) => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
  };
  return {
    service: service as unknown as AchievementService,
    emit: (achievements: Achievement[]) => listener?.(achievements),
  };
}

describe('AchievementPanel', () => {
  it('renders the panel with the unlocked / total count', () => {
    const { service } = makeFakeService([
      makeAchievement({ id: 'a1', unlocked: true }),
      makeAchievement({ id: 'a2', unlocked: false }),
    ]);

    render(<AchievementPanel achievementService={service} />);

    expect(screen.getByTestId('achievements-panel')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('renders achievement titles, descriptions and rewards', () => {
    const { service } = makeFakeService([
      makeAchievement({ id: 'a1', title: 'Sharp Shooter', description: 'Hit 10 targets', reward: 75 }),
    ]);

    render(<AchievementPanel achievementService={service} />);

    expect(screen.getByText(/Sharp Shooter/)).toBeInTheDocument();
    expect(screen.getByText('Hit 10 targets')).toBeInTheDocument();
    expect(screen.getByText('+75')).toBeInTheDocument();
  });

  it('marks unlocked achievements with a sparkle', () => {
    const { service } = makeFakeService([
      makeAchievement({ id: 'a1', title: 'Champion', unlocked: true }),
    ]);

    render(<AchievementPanel achievementService={service} />);

    expect(screen.getByText(/Champion/)).toHaveTextContent('✨');
  });

  it('filters achievements by category when a filter button is clicked', () => {
    const { service } = makeFakeService([
      makeAchievement({ id: 'a1', title: 'Gameplay Ach', category: 'gameplay' }),
      makeAchievement({ id: 'a2', title: 'Skill Ach', category: 'skill' }),
    ]);

    render(<AchievementPanel achievementService={service} />);

    // Both visible under the default "all" filter.
    expect(screen.getByText(/Gameplay Ach/)).toBeInTheDocument();
    expect(screen.getByText(/Skill Ach/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Skill/ }));

    expect(screen.queryByText(/Gameplay Ach/)).not.toBeInTheDocument();
    expect(screen.getByText(/Skill Ach/)).toBeInTheDocument();
  });

  it('shows the empty-category message when a filter matches nothing', () => {
    const { service } = makeFakeService([
      makeAchievement({ id: 'a1', category: 'gameplay' }),
    ]);

    render(<AchievementPanel achievementService={service} />);

    fireEvent.click(screen.getByRole('button', { name: /Collection/ }));

    expect(screen.getByText('No achievements in this category')).toBeInTheDocument();
  });

  it('re-renders when the service emits an achievement update', () => {
    const { service, emit } = makeFakeService([
      makeAchievement({ id: 'a1', title: 'Before', unlocked: false }),
    ]);

    render(<AchievementPanel achievementService={service} />);
    expect(screen.getByText('0 / 1')).toBeInTheDocument();

    act(() => {
      emit([makeAchievement({ id: 'a1', title: 'Before', unlocked: true })]);
    });

    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
