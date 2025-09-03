import { AchievementService } from '@/services/AchievementService';

describe('AchievementService', () => {
  test('unlocks achievements when requirement is met', () => {
    const svc = new AchievementService();
    svc.init();

    const unlocked = svc.checkAchievement('jumps', 1);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(unlocked.some(a => a.id === 'first_jump')).toBe(true);
    expect(svc.getUnlockedAchievements().some(a => a.id === 'first_jump')).toBe(true);
  });

  test('respects gameId filtering (only unlocks when matching game)', () => {
    const svc = new AchievementService();
    svc.init();

    // Wrong gameId should not unlock "puzzle" achievements
    const none = svc.checkAchievement('unique_themes', 3, 'runner');
    expect(none.some(a => a.gameId === 'puzzle')).toBe(false);

    // Correct gameId unlocks
    const some = svc.checkAchievement('unique_themes', 3, 'puzzle');
    expect(some.some(a => a.gameId === 'puzzle')).toBe(true);
  });
});

