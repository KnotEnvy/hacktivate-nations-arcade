// ===== src/games/dungeon-crawl/persistence/CharacterStore.ts =====
// v4 — the hero ROSTER save file: one persistent hero per class, each leveling
// independently. Account-scoped localStorage under `dungeon-crawl-save:<ownerId>`
// (owner mirrors the platform's analytics convention: `hacktivate-session-owner`,
// falling back to 'guest'). Versioned JSON — v1 single-hero saves migrate into
// their class slot. Every touch of storage is try/catch and degrades silently;
// invalid heroes are dropped individually. Carries NO arcade rewards (those
// ride trusted session metrics).

import { CLASSES, ClassId } from '../data/classes';
import { ALL_BOON_IDS, BOONS, BoonId } from '../data/boons';
import {
  ALL_GEAR_IDS,
  ALL_PROVISION_IDS,
  GEAR_TUNING,
  GearId,
  ProvisionId,
} from '../data/gear';
import {
  ALL_EQUIP_SLOTS,
  ALL_ITEM_IDS,
  EquipSlot,
  ITEM_TUNING,
  ITEMS,
  ItemId,
} from '../data/items';
import { asLineageId, LineageId } from '../data/lineages';
import { averageHpRoll, LEVEL_CAP } from '../data/progression';
import { ALL_SAGA_IDS, SAGAS, SagaId } from '../data/sagas';
import { SpellId, spellsForClass } from '../data/spells';
import { ALL_STAT_IDS, STAT_BASES, STAT_TUNING, StatScores } from '../data/stats';

const SAVE_PREFIX = 'dungeon-crawl-save';
const SESSION_OWNER_KEY = 'hacktivate-session-owner';
const DEFAULT_OWNER = 'guest';

export interface SavedHeroStats {
  expeditions: number;
  deaths: number;
  victories: number; // reserved for Wave B (the Town / quests)
}

export interface SavedHero {
  classId: ClassId;
  name: string;
  level: number; // 1..LEVEL_CAP
  xp: number; // lifetime, never decremented
  boons: Partial<Record<BoonId, number>>; // stack counts
  createdAt: number;
  stats: SavedHeroStats;
  // v4 Wave B — the town's ledgers (all game-internal, no arcade rewards).
  gold: number; // banked gold, safe from death
  gear: Partial<Record<GearId, number>>; // blacksmith tiers 1..MAX_TIER
  provisions: ProvisionId[]; // packed for the NEXT expedition; consumed at the gate
  // v4 Wave C — chapters completed per saga (additive field, no version bump).
  sagas: Partial<Record<SagaId, number>>;
  // v4 Wave D — the grimoire: spells learned at level-up (class-legal only).
  spells: SpellId[];
  // v5 Wave E — the six ability SCORES (str/dex/con/int/wis/cha). NOT to be
  // confused with `stats` above (the expedition record). Additive field, no
  // version bump: absent on old saves → sanitize fills the flat class base.
  scores: StatScores;
  // v5 Wave F — found equipment: the worn piece per slot + the banked stash.
  // Written ONLY at quest victory and by town inventory edits — the death
  // path never touches them (unbanked finds are simply lost).
  equipment: Partial<Record<EquipSlot, ItemId>>;
  stash: ItemId[];
  // Wave I — the bloodline chosen at the forge. Additive field: absent on
  // older saves → 'human', whose passive is forge-time only, so veterans
  // play exactly as before.
  lineage: LineageId;
  // Wave L — the hit-die rolls kept from each level-up (entry 0 = reaching
  // level 2). Additive field: absent/short entries backfill the average roll
  // so pre-hit-dice veterans land mid-pool, never punished.
  hpRolls: number[];
}

export interface SavePayloadV2 {
  version: 2;
  characters: Partial<Record<ClassId, SavedHero>>;
}

/** Resolve the arcade account owner (mirrors Analytics.resolveOwnerId). */
export function resolveOwnerId(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_OWNER;
    const owner = window.localStorage.getItem(SESSION_OWNER_KEY);
    return owner && owner.trim().length > 0 ? owner : DEFAULT_OWNER;
  } catch {
    return DEFAULT_OWNER;
  }
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function emptyPayload(): SavePayloadV2 {
  return { version: 2, characters: {} };
}

/** Validate one hero record; null drops it without failing the roster. */
function sanitizeHero(raw: unknown, expectedClass: ClassId): SavedHero | null {
  if (!raw || typeof raw !== 'object') return null;
  const hero = raw as Partial<SavedHero>;
  if (hero.classId !== expectedClass) return null;

  const level = Math.floor(asFiniteNumber(hero.level, 0));
  if (level < 1 || level > LEVEL_CAP) return null;
  const xp = asFiniteNumber(hero.xp, -1);
  if (xp < 0) return null;

  const boons: Partial<Record<BoonId, number>> = {};
  if (hero.boons && typeof hero.boons === 'object') {
    for (const id of ALL_BOON_IDS) {
      const count = Math.floor(asFiniteNumber((hero.boons as Record<string, unknown>)[id], 0));
      if (count > 0) boons[id] = Math.min(count, BOONS[id].maxStacks);
    }
  }

  const gear: Partial<Record<GearId, number>> = {};
  if (hero.gear && typeof hero.gear === 'object') {
    for (const id of ALL_GEAR_IDS) {
      const tier = Math.floor(asFiniteNumber((hero.gear as Record<string, unknown>)[id], 0));
      if (tier > 0) gear[id] = Math.min(tier, GEAR_TUNING.MAX_TIER);
    }
  }

  const provisions: ProvisionId[] = Array.isArray(hero.provisions)
    ? ALL_PROVISION_IDS.filter(id => (hero.provisions as unknown[]).includes(id))
    : [];

  const sagas: Partial<Record<SagaId, number>> = {};
  if (hero.sagas && typeof hero.sagas === 'object') {
    for (const id of ALL_SAGA_IDS) {
      const done = Math.floor(asFiniteNumber((hero.sagas as Record<string, unknown>)[id], 0));
      if (done > 0) sagas[id] = Math.min(done, SAGAS[id].quests.length);
    }
  }

  // Only real, class-legal spells survive (and each at most once).
  const spells: SpellId[] = Array.isArray(hero.spells)
    ? spellsForClass(expectedClass).filter(id => (hero.spells as unknown[]).includes(id))
    : [];

  // Ability scores clamp to [class base, cap] — veterans without the field
  // land exactly on the flat base (zero deltas = their playtested feel).
  const scores = { ...STAT_BASES[expectedClass] };
  if (hero.scores && typeof hero.scores === 'object') {
    for (const id of ALL_STAT_IDS) {
      const value = Math.floor(
        asFiniteNumber((hero.scores as Record<string, unknown>)[id], scores[id]),
      );
      scores[id] = Math.min(STAT_TUNING.SCORE_MAX, Math.max(scores[id], value));
    }
  }

  // Found equipment: only real item ids survive, and a worn piece must match
  // its slot; the stash whitelist naturally dedups and caps.
  const equipment: Partial<Record<EquipSlot, ItemId>> = {};
  if (hero.equipment && typeof hero.equipment === 'object') {
    for (const slot of ALL_EQUIP_SLOTS) {
      const id = (hero.equipment as Record<string, unknown>)[slot];
      if (
        typeof id === 'string' &&
        (ALL_ITEM_IDS as string[]).includes(id) &&
        ITEMS[id as ItemId].slot === slot
      ) {
        equipment[slot] = id as ItemId;
      }
    }
  }
  const stash: ItemId[] = Array.isArray(hero.stash)
    ? ALL_ITEM_IDS.filter(id => (hero.stash as unknown[]).includes(id)).slice(
        0,
        ITEM_TUNING.STASH_MAX,
      )
    : [];

  // Wave L — hit-die rolls: exactly level-1 entries, each clamped to the
  // class die; absent or short arrays backfill the average roll (veterans
  // saved before hit dice existed land mid-pool).
  const hitDie = CLASSES[expectedClass].kit.hitDie;
  const rawRolls: unknown[] = Array.isArray(hero.hpRolls) ? hero.hpRolls : [];
  const hpRolls: number[] = [];
  for (let i = 0; i < level - 1; i++) {
    const value = Math.floor(asFiniteNumber(rawRolls[i], averageHpRoll(hitDie)));
    hpRolls.push(Math.min(hitDie, Math.max(1, value)));
  }

  const stats = hero.stats && typeof hero.stats === 'object' ? hero.stats : undefined;
  return {
    classId: expectedClass,
    name:
      typeof hero.name === 'string' && hero.name.length > 0
        ? hero.name
        : CLASSES[expectedClass].name,
    level,
    xp,
    boons,
    createdAt: asFiniteNumber(hero.createdAt, Date.now()),
    stats: {
      expeditions: Math.max(0, Math.floor(asFiniteNumber(stats?.expeditions, 0))),
      deaths: Math.max(0, Math.floor(asFiniteNumber(stats?.deaths, 0))),
      victories: Math.max(0, Math.floor(asFiniteNumber(stats?.victories, 0))),
    },
    gold: Math.max(0, Math.floor(asFiniteNumber(hero.gold, 0))),
    gear,
    provisions,
    sagas,
    spells,
    scores,
    equipment,
    stash,
    lineage: asLineageId(hero.lineage),
    hpRolls,
  };
}

export class CharacterStore {
  /** Owner is resolved per call so sign-in/out lands on the right key. */
  key(): string {
    return `${SAVE_PREFIX}:${resolveOwnerId()}`;
  }

  /**
   * Always returns a roster — empty for missing/corrupt/foreign saves. A v1
   * single-hero save migrates into its class slot (with its old stats).
   */
  load(): SavePayloadV2 {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return emptyPayload();
      const raw = window.localStorage.getItem(this.key());
      if (!raw) return emptyPayload();
      const parsed = JSON.parse(raw) as {
        version?: number;
        character?: unknown;
        stats?: unknown;
        characters?: Record<string, unknown>;
      };
      if (!parsed || typeof parsed !== 'object') return emptyPayload();

      const payload = emptyPayload();

      if (parsed.version === 2 && parsed.characters && typeof parsed.characters === 'object') {
        for (const classId of Object.keys(CLASSES) as ClassId[]) {
          const hero = sanitizeHero(parsed.characters[classId], classId);
          if (hero) payload.characters[classId] = hero;
        }
        return payload;
      }

      if (parsed.version === 1 && parsed.character && typeof parsed.character === 'object') {
        // v1 migration: the single hero (and its global stats) claims its slot.
        const legacy = parsed.character as { classId?: ClassId } & Record<string, unknown>;
        if (legacy.classId && legacy.classId in CLASSES) {
          const hero = sanitizeHero({ ...legacy, stats: parsed.stats }, legacy.classId);
          if (hero) payload.characters[legacy.classId] = hero;
        }
        return payload;
      }

      return payload;
    } catch {
      return emptyPayload();
    }
  }

  save(payload: SavePayloadV2): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(this.key(), JSON.stringify(payload));
    } catch {
      // Storage full / blocked — the roster simply doesn't persist this time.
    }
  }

  /** Wipe the whole roster (tests / full reset). */
  clear(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(this.key());
    } catch {
      // Ignore.
    }
  }
}
