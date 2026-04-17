import { act, renderHook, waitFor } from '@testing-library/react';
import { useArcadeUnlockState } from '@/hooks/useArcadeUnlockState';

describe('useArcadeUnlockState', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not rerun unlock hydration when the sync callback identity changes', async () => {
    localStorage.setItem(
      'hacktivate-unlocks-v2',
      JSON.stringify({
        tiers: [0, 2],
        games: ['runner', 'space'],
      })
    );

    const achievementService = {
      checkAchievement: jest.fn(),
    };
    const initialSchedulePlayerSync = jest.fn();

    const { result, rerender } = renderHook(
      ({ schedulePlayerSync }) =>
        useArcadeUnlockState({
          achievementService: achievementService as never,
          schedulePlayerSync,
        }),
      {
        initialProps: {
          schedulePlayerSync: initialSchedulePlayerSync,
        },
      }
    );

    await waitFor(() => {
      expect(result.current.unlockedTiers).toEqual([0, 2]);
    });
    expect(result.current.unlockedGames).toEqual(
      expect.arrayContaining(['runner', 'space'])
    );
    expect(initialSchedulePlayerSync).toHaveBeenCalledTimes(1);
    expect(achievementService.checkAchievement).toHaveBeenCalledTimes(1);

    const nextSchedulePlayerSync = jest.fn();
    rerender({ schedulePlayerSync: nextSchedulePlayerSync });

    await act(async () => {
      await Promise.resolve();
    });

    expect(nextSchedulePlayerSync).not.toHaveBeenCalled();
    expect(initialSchedulePlayerSync).toHaveBeenCalledTimes(1);
    expect(achievementService.checkAchievement).toHaveBeenCalledTimes(1);
  });
});
