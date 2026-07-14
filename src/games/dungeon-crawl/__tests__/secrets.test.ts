// v4 Wave C tests: secret rooms at the game level — ONLY player-sourced
// blasts break cracked walls (bomber bombs never reveal a secret), breaking
// the seal counts secrets_found, and a revealed nest stirs on entry then pays
// its hoard into the run wallet when the pack falls (nests_cleared).

import { TILE } from '@/games/dungeon-crawl/data/constants';
import { QUESTS, QuestDef } from '@/games/dungeon-crawl/data/quests';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { SecretRoomPlan } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { Tile, TileMap } from '@/games/dungeon-crawl/dungeon/TileMap';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function wireHeldKeys(h: Harness): Set<string> {
  const held = new Set<string>();
  const input = h.services.input as unknown as {
    isKeyPressed: jest.Mock;
    isLeftPressed: jest.Mock;
    isRightPressed: jest.Mock;
    isUpPressed: jest.Mock;
    isDownPressed: jest.Mock;
  };
  input.isKeyPressed.mockImplementation((code: string) => held.has(code));
  input.isLeftPressed.mockImplementation(() => held.has('ArrowLeft'));
  input.isRightPressed.mockImplementation(() => held.has('ArrowRight'));
  input.isUpPressed.mockImplementation(() => held.has('ArrowUp'));
  input.isDownPressed.mockImplementation(() => held.has('ArrowDown'));
  return held;
}

interface StagedExplosion {
  x: number;
  y: number;
  fuse: number;
  radius: number;
  source: 'enemy' | 'player';
  damage: number;
}

interface GameInternals {
  departOnQuest(quest: QuestDef): void;
  loadFloor(): void;
  crackWall(tx: number, ty: number): void;
  floor: number;
  goldBalance: number;
  state: string;
  map: TileMap;
  plan: { secrets: SecretRoomPlan[] };
  enemies: Array<{ alive: boolean }>;
  player: { placeAt(x: number, y: number): void };
  combat: { explosions: StagedExplosion[] };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

function startWithFighter(h: Harness): Set<string> {
  const held = wireHeldKeys(h);
  held.add('Digit1');
  h.game.update(1 / 60); // pick fighter -> town
  held.clear();
  h.game.update(1 / 60);
  return held;
}

/** Walk the endless depths until a floor rolls a secret (optionally a nest). */
function findSecret(game: GameInternals, wantNest: boolean): SecretRoomPlan {
  game.departOnQuest(QUESTS.endless);
  // v5 Wave G — skip the DM briefing (this helper walks the generator, not
  // the flow; the floor pokes below load their own maps).
  game.state = 'playing';
  for (let floor = 1; floor <= 40; floor++) {
    if (floor % 3 === 0) continue; // classic boss arenas carry no secrets
    game.floor = floor;
    game.loadFloor();
    const hit = game.plan.secrets.find(s => (wantNest ? s.nest !== null : true));
    if (hit) return hit;
  }
  throw new Error('no secret room rolled across 40 floors — check the generator');
}

describe('cracked walls', () => {
  test('player blasts break the seal; enemy bombs never do', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);
    const secret = findSecret(game, false);
    const seal = secret.seal;
    expect(game.map.get(seal.tx, seal.ty)).toBe(Tile.CrackedWall);
    const cx = (seal.tx + 0.5) * TILE;
    const cy = (seal.ty + 0.5) * TILE;

    // A bomber's blast bursting right on the seal leaves it standing.
    game.combat.explosions.push({ x: cx, y: cy, fuse: 0.01, radius: 60, source: 'enemy', damage: 1 });
    h.game.update(1 / 60);
    expect(game.map.get(seal.tx, seal.ty)).toBe(Tile.CrackedWall);
    expect(metrics(h).secrets_found).toBe(0);

    // The player's own blast breaks it open and counts the discovery.
    game.combat.explosions.push({ x: cx, y: cy, fuse: 0.01, radius: 60, source: 'player', damage: 1 });
    h.game.update(1 / 60);
    expect(game.map.get(seal.tx, seal.ty)).toBe(Tile.Floor);
    expect(metrics(h).secrets_found).toBe(1);
  });

  test('a revealed nest stirs on entry and pays its hoard when cleared', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);
    const secret = findSecret(game, true);
    const nest = secret.nest!;

    game.crackWall(secret.seal.tx, secret.seal.ty);
    expect(game.map.get(secret.seal.tx, secret.seal.ty)).toBe(Tile.Floor);
    h.game.update(1 / 60);
    expect(metrics(h).secrets_found).toBe(1);

    // Step into the room: the pack spawns.
    const before = new Set(game.enemies);
    const room = secret.room;
    game.player.placeAt(
      (room.tx + room.w / 2) * TILE,
      (room.ty + room.h / 2) * TILE,
    );
    h.game.update(1 / 60);
    const pack = game.enemies.filter(e => !before.has(e));
    expect(pack).toHaveLength(nest.spawns.length);

    // The last of the nest falls: the hoard pays into the run wallet.
    const goldBefore = game.goldBalance;
    for (const enemy of pack) enemy.alive = false;
    h.game.update(1 / 60);
    expect(game.goldBalance).toBe(goldBefore + nest.rewardGold);
    expect(metrics(h).nests_cleared).toBe(1);
  });
});
