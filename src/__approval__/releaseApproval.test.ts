import fs from 'fs';
import path from 'path';
import { AVAILABLE_GAMES } from '@/data/Games';
import {
  COMING_SOON_GAME_CATALOG,
  PLAYABLE_GAME_CATALOG,
  isGameImplemented,
} from '@/lib/gameCatalog';
import { GAME_CONFIG, PERFORMANCE, TIER_GAME_COST_INCREMENTS, TIER_UNLOCK_COSTS } from '@/lib/constants';
import {
  DEFAULT_UNLOCKED_GAME_IDS,
  getNextGameUnlockCost,
  getTierUnlockCost,
  isGameUnlocked,
} from '@/lib/unlocks';
import {
  buildTrustedSessionProgressionState,
  calculateTrustedGameReward,
  getTrustedSessionAchievementIds,
  validateTrustedGameSession,
} from '@/lib/trustedProgression';
import {
  DAILY_CHALLENGE_TEMPLATES,
  getChallengeTemplate,
} from '@/lib/challenges';
import { ChallengeService } from '@/services/ChallengeService';
import {
  getTracksForGame,
  TRACK_DEFINITIONS,
} from '@/services/ProceduralMusicEngine';
import { gameLoader } from '@/games/registry';
import { assertSupabaseEnv } from '@/lib/supabase';

const EXPECTED_PLAYABLE_GAME_IDS = [
  'asteroids',
  'bowling',
  'breakout',
  'bubble',
  'color-drop',
  'frog-hop',
  'memory',
  'mini-golf',
  'minesweeper',
  'platform-adventure',
  'puzzle',
  'runner',
  'snake',
  'space',
  'speed-racer',
  'tapdodge',
  'tower-builder',
] as const;

const speedRacerSession = {
  gameId: 'speed-racer',
  score: 5000,
  pickups: 12,
  timePlayedMs: 90_000,
  metrics: {
    distance: 6200,
    enemies_destroyed: 25,
    max_speed: 640,
    max_combo: 5,
    sections_cleared: 3,
  },
};

describe('release approval checks', () => {
  it('keeps the release catalog at the expected 17 playable games and 10 coming-soon games', () => {
    const ids = AVAILABLE_GAMES.map(game => game.id);

    expect(new Set(ids).size).toBe(AVAILABLE_GAMES.length);
    expect(AVAILABLE_GAMES).toHaveLength(27);
    expect(PLAYABLE_GAME_CATALOG).toHaveLength(17);
    expect(COMING_SOON_GAME_CATALOG).toHaveLength(10);
  });

  it('keeps the registry and playable catalog in sync', () => {
    const registeredIds = [...gameLoader.getAvailableGames()].sort();
    const playableIds = PLAYABLE_GAME_CATALOG.map(game => game.id).sort();

    expect(registeredIds).toEqual([...EXPECTED_PLAYABLE_GAME_IDS].sort());
    expect(playableIds).toEqual(registeredIds);
    expect(COMING_SOON_GAME_CATALOG.every(game => !isGameImplemented(game.id))).toBe(true);
  });

  it('loads every registered game module with matching manifest metadata', async () => {
    const loadedGames = await Promise.all(
      PLAYABLE_GAME_CATALOG.map(async manifest => {
        const game = await gameLoader.loadGame(manifest.id);
        return { manifest, game };
      })
    );

    loadedGames.forEach(({ manifest, game }) => {
      expect(game).not.toBeNull();
      expect(game?.manifest.id).toBe(manifest.id);
      expect(game?.manifest.title).toBe(manifest.title);
      expect(typeof game?.init).toBe('function');
      expect(typeof game?.update).toBe('function');
      expect(typeof game?.render).toBe('function');
    });
  });

  it('ships usable catalog assets and sane runtime budgets', () => {
    expect(GAME_CONFIG.CANVAS_WIDTH).toBe(800);
    expect(GAME_CONFIG.CANVAS_HEIGHT).toBe(600);

    PLAYABLE_GAME_CATALOG.forEach(game => {
      const assetPath = path.join(process.cwd(), 'public', game.thumbnail.replace(/^\//, ''));

      expect(fs.existsSync(assetPath)).toBe(true);
      expect(game.assetBudgetKB).toBeGreaterThan(0);
      expect(game.assetBudgetKB).toBeLessThanOrEqual(PERFORMANCE.MAX_ASSET_SIZE_KB);
      expect(game.inputSchema.length).toBeGreaterThan(0);
    });
  });

  it('keeps unlock rules aligned with the signed-in progression model', () => {
    expect(DEFAULT_UNLOCKED_GAME_IDS).toEqual(['runner']);
    expect(isGameUnlocked('runner', [0], [])).toBe(true);
    expect(isGameUnlocked('snake', [0], [])).toBe(false);
    expect(isGameUnlocked('snake', [0], ['snake'])).toBe(true);
    expect(isGameUnlocked('speed-racer', [0, 1, 2], [])).toBe(false);
    expect(isGameUnlocked('speed-racer', [0, 1, 2], ['speed-racer'])).toBe(true);
    expect(isGameUnlocked(COMING_SOON_GAME_CATALOG[0].id, [0, 1, 2, 3, 4], [COMING_SOON_GAME_CATALOG[0].id])).toBe(false);

    expect(getTierUnlockCost(0)).toBe(TIER_UNLOCK_COSTS[0]);
    expect(getNextGameUnlockCost(0, 0)).toBe(TIER_GAME_COST_INCREMENTS[0]);
    expect(getNextGameUnlockCost(2, 1)).toBe(TIER_GAME_COST_INCREMENTS[2] * 2);
  });

  it('generates real daily challenges from valid templates', () => {
    const challengeService = new ChallengeService();
    challengeService.init();
    const generated = challengeService.getChallenges();

    expect(generated).toHaveLength(3);
    expect(new Set(generated.map(challenge => challenge.id)).size).toBe(3);

    generated.forEach(challenge => {
      const template = getChallengeTemplate(challenge.id);

      expect(template).not.toBeNull();
      expect(challenge.type).toBe('daily');
      expect(challenge.target).toBeGreaterThan(0);
      expect(challenge.reward).toBeGreaterThan(0);
      expect(challenge.expiresAt.getTime()).toBeGreaterThan(Date.now());
      if (challenge.gameId) {
        expect(isGameImplemented(challenge.gameId)).toBe(true);
      }
    });

    DAILY_CHALLENGE_TEMPLATES.forEach(template => {
      if (template.gameId) {
        expect(isGameImplemented(template.gameId)).toBe(true);
      }
    });
  });

  it('validates a real Speed Racer session and derives server-side reward', () => {
    const session = validateTrustedGameSession(speedRacerSession);

    expect(session).toEqual(speedRacerSession);
    expect(calculateTrustedGameReward({
      level: 1,
      score: session.score,
      pickups: session.pickups,
      dailyChallengeMultiplierActive: false,
    })).toBe(170);
    expect(() =>
      validateTrustedGameSession({
        gameId: COMING_SOON_GAME_CATALOG[0].id,
        score: 100,
        pickups: 1,
      })
    ).toThrow('Game is not registered');
  });

  it('updates trusted progression and achievements from the real Speed Racer payload', () => {
    const session = validateTrustedGameSession(speedRacerSession);
    const rewardAwarded = calculateTrustedGameReward({
      level: 1,
      score: session.score,
      pickups: session.pickups,
      dailyChallengeMultiplierActive: false,
    });
    const progression = buildTrustedSessionProgressionState({
      currentStats: {},
      currentSettings: {},
      currentGamesPlayed: 0,
      currentTotalPlayTime: 0,
      session,
      rewardAwarded,
    });
    const achievementIds = getTrustedSessionAchievementIds({
      session,
      totalPlayTime: progression.totalPlayTime,
      stats: progression.stats,
      settings: progression.settings,
      existingAchievementIds: [],
    });

    expect(progression.gamesPlayed).toBe(1);
    expect(progression.totalPlayTime).toBe(90);
    expect(progression.stats.coinsEarned).toBe(rewardAwarded);
    expect(progression.settings.playedGameIds).toEqual(['speed-racer']);
    expect(progression.settings.bestScoresByGame['speed-racer']).toBe(5000);
    expect(achievementIds).toEqual(
      expect.arrayContaining([
        'first_game',
        'speedracer_first_blood',
        'speedracer_road_warrior',
        'speedracer_distance_runner',
        'speedracer_combo_starter',
        'speedracer_top_speed',
        'speedracer_section_one',
        'speedracer_section_three',
      ])
    );
  });

  it('keeps procedural music assignments available for the hub and every playable game', () => {
    expect(TRACK_DEFINITIONS.hub_sb32_intro.name).toBe('SB32 Power-On');
    expect(TRACK_DEFINITIONS.action_chase.name).toBe('Hot Pursuit');

    PLAYABLE_GAME_CATALOG.forEach(game => {
      const tracks = getTracksForGame(game.id);

      expect(tracks.primary.name).toBeTruthy();
      expect(tracks.secondary.name).toBeTruthy();
    });
  });

  it('fails closed when Supabase public auth configuration is missing', () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(() => assertSupabaseEnv()).toThrow('Supabase env vars are missing');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'approval-test-anon-key';
      expect(() => assertSupabaseEnv()).not.toThrow();
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    }
  });
});
