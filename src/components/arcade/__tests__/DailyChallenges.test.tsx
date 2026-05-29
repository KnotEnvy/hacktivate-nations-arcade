import { render, screen, act } from '@testing-library/react';
import { DailyChallenges } from '@/components/arcade/DailyChallenges';
import type { Challenge, ChallengeService } from '@/services/ChallengeService';

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'daily-1',
    title: 'Score Hunter',
    description: 'Score 500 points',
    type: 'daily',
    target: 500,
    progress: 250,
    reward: 100,
    completed: false,
    expiresAt: new Date('2099-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Minimal stand-in for ChallengeService exposing only the two methods the
 * component consumes. Cast to the service type so we avoid mounting the real
 * service (which touches localStorage and random challenge generation).
 */
function makeFakeService(initial: Challenge[]) {
  let listener: ((challenges: Challenge[]) => void) | null = null;
  const service = {
    getChallenges: jest.fn(() => initial),
    onChallengesChanged: jest.fn((cb: (c: Challenge[]) => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
  };
  return {
    service: service as unknown as ChallengeService,
    emit: (challenges: Challenge[]) => listener?.(challenges),
    raw: service,
  };
}

describe('DailyChallenges', () => {
  it('renders the empty state when there are no daily challenges', () => {
    const { service } = makeFakeService([]);
    render(<DailyChallenges challengeService={service} />);

    expect(screen.getByText('No challenges available')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-challenges')).not.toBeInTheDocument();
  });

  it('renders only daily challenges, ignoring weekly ones', () => {
    const { service } = makeFakeService([
      makeChallenge({ id: 'd1', title: 'Daily One' }),
      makeChallenge({ id: 'w1', title: 'Weekly One', type: 'weekly' }),
    ]);

    render(<DailyChallenges challengeService={service} />);

    expect(screen.getByTestId('daily-challenges')).toBeInTheDocument();
    expect(screen.getByText('Daily One')).toBeInTheDocument();
    expect(screen.queryByText('Weekly One')).not.toBeInTheDocument();
  });

  it('renders challenge progress, reward and percentage', () => {
    const { service } = makeFakeService([
      makeChallenge({ progress: 250, target: 500, reward: 100 }),
    ]);

    render(<DailyChallenges challengeService={service} />);

    expect(screen.getByText('250 / 500')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
  });

  it('marks completed challenges with a checkmark', () => {
    const { service } = makeFakeService([
      makeChallenge({ title: 'Done Deal', completed: true, progress: 500 }),
    ]);

    render(<DailyChallenges challengeService={service} />);

    expect(screen.getByText(/Done Deal/)).toHaveTextContent('✅');
  });

  it('re-renders when the service emits a challenge update', () => {
    const { service, emit } = makeFakeService([
      makeChallenge({ id: 'd1', title: 'Initial' }),
    ]);

    render(<DailyChallenges challengeService={service} />);
    expect(screen.getByText('Initial')).toBeInTheDocument();

    act(() => {
      emit([makeChallenge({ id: 'd1', title: 'Updated' })]);
    });

    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.queryByText('Initial')).not.toBeInTheDocument();
  });

  it('unsubscribes on unmount', () => {
    const { service } = makeFakeService([makeChallenge()]);
    const { unmount } = render(<DailyChallenges challengeService={service} />);
    // The subscription was established once.
    expect(service.onChallengesChanged).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
  });
});
