// ===== src/games/dungeon-crawl/data/items.ts =====
// v5 Wave F — relics of the deep you can KEEP: findable equipment in three
// hero slots (weapon/armor/trinket) beside the blacksmith's gear tracks.
// Finds are run-carried and become permanent only on quest VICTORY — death
// loses whatever wasn't banked, like carried gold. Pure data; Player folds
// the merged effects, statBonus rides the Wave E effective-score math.
// Text original; generic archetypes only.

import { StatId } from './stats';
import { Rng } from '../dungeon/rng';

export type EquipSlot = 'weapon' | 'armor' | 'trinket';
export type Rarity = 'common' | 'rare' | 'legendary';

export type ItemId =
  | 'soldiers-edge'
  | 'giants-knuckle'
  | 'oathkeeper'
  | 'dawnsliver'
  | 'padded-jack'
  | 'wardens-mail'
  | 'drakescale-coat'
  | 'bulwark-of-the-deep'
  | 'lucky-knucklebone'
  | 'hawks-eye-locket'
  | 'girdle-of-the-ox'
  | 'philosophers-ring';

/** Flat, additive effect bag — every field composes with gear/boons/relics. */
export interface ItemEffects {
  damage?: number; // sword damage (daggers inherit)
  hp?: number; // max hearts (2 hp = one heart), clamped by PLAYER.HP_CAP
  speed?: number; // additive into the speed training sum
  knockback?: number; // px onto the kit's melee knockback
  daggerCap?: number;
  statBonus?: Partial<Record<StatId, number>>; // live effective-score points
}

export interface ItemDef {
  id: ItemId;
  name: string;
  blurb: string; // one line in the inventory / find banner
  icon: string;
  color: string;
  slot: EquipSlot;
  rarity: Rarity;
  effects: ItemEffects;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  // --- Weapons.
  'soldiers-edge': {
    id: 'soldiers-edge',
    name: "SOLDIER'S EDGE",
    blurb: 'An honest blade, kept keen by habit rather than magic',
    icon: '†',
    color: '#cfd6e0',
    slot: 'weapon',
    rarity: 'common',
    effects: { damage: 1 },
  },
  'giants-knuckle': {
    id: 'giants-knuckle',
    name: "GIANT'S KNUCKLE",
    blurb: 'A pommel cut from a stone ring — the blow lands like a doorway',
    icon: '⚒',
    color: '#e08a3d',
    slot: 'weapon',
    rarity: 'rare',
    effects: { damage: 1, knockback: 40 },
  },
  oathkeeper: {
    id: 'oathkeeper',
    name: 'OATHKEEPER',
    blurb: 'Sworn to mend as much as it harms',
    icon: '‡',
    color: '#e8dcbc',
    slot: 'weapon',
    rarity: 'rare',
    effects: { damage: 1, statBonus: { wis: 1 } },
  },
  dawnsliver: {
    id: 'dawnsliver',
    name: 'DAWNSLIVER',
    blurb: 'A shard of first light, honed to an edge',
    icon: '☀',
    color: '#ffe8b0',
    slot: 'weapon',
    rarity: 'legendary',
    effects: { damage: 2, speed: 0.04 },
  },
  // --- Armor.
  'padded-jack': {
    id: 'padded-jack',
    name: 'PADDED JACK',
    blurb: 'Quilted cloth that has caught its share of teeth',
    icon: '▣',
    color: '#8a7a5a',
    slot: 'armor',
    rarity: 'common',
    effects: { hp: 2 },
  },
  'wardens-mail': {
    id: 'wardens-mail',
    name: "WARDEN'S MAIL",
    blurb: 'Links forged for the long watch',
    icon: '▦',
    color: '#9aa5b5',
    slot: 'armor',
    rarity: 'rare',
    effects: { hp: 4 },
  },
  'drakescale-coat': {
    id: 'drakescale-coat',
    name: 'DRAKESCALE COAT',
    blurb: 'Scales shed freely, never taken',
    icon: '❖',
    color: '#7fae3f',
    slot: 'armor',
    rarity: 'rare',
    effects: { hp: 2, statBonus: { con: 1 } },
  },
  'bulwark-of-the-deep': {
    id: 'bulwark-of-the-deep',
    name: 'BULWARK OF THE DEEP',
    blurb: 'It remembers the pressure of drowned halls',
    icon: '⬢',
    color: '#7ae0ff',
    slot: 'armor',
    rarity: 'legendary',
    effects: { hp: 4, statBonus: { con: 1 } },
  },
  // --- Trinkets.
  'lucky-knucklebone': {
    id: 'lucky-knucklebone',
    name: 'LUCKY KNUCKLEBONE',
    blurb: 'A gambler’s die that remembers winning',
    icon: '⚅',
    color: '#ffd24a',
    slot: 'trinket',
    rarity: 'common',
    effects: { statBonus: { cha: 1 } },
  },
  'hawks-eye-locket': {
    id: 'hawks-eye-locket',
    name: "HAWK'S-EYE LOCKET",
    blurb: 'The hawk sees every opening',
    icon: '◉',
    color: '#7ae0ff',
    slot: 'trinket',
    rarity: 'rare',
    effects: { daggerCap: 1, statBonus: { dex: 1 } },
  },
  'girdle-of-the-ox': {
    id: 'girdle-of-the-ox',
    name: 'GIRDLE OF THE OX',
    blurb: 'Broad leather that lends its patience and its pull',
    icon: 'Ω',
    color: '#e05a3d',
    slot: 'trinket',
    rarity: 'rare',
    effects: { statBonus: { str: 1 } },
  },
  'philosophers-ring': {
    id: 'philosophers-ring',
    name: "PHILOSOPHER'S RING",
    blurb: 'It asks a question every dawn',
    icon: '◈',
    color: '#c9a2ff',
    slot: 'trinket',
    rarity: 'legendary',
    effects: { statBonus: { int: 1, wis: 1 } },
  },
};

export const ALL_ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const ALL_EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'trinket'];

export const ITEM_TUNING = {
  SATCHEL_MAX: 6, // run finds carried at once (full = the find stays put)
  STASH_MAX: 10, // banked-but-unequipped items per hero
  /** A duplicate or overflow find converts to banked gold at victory. */
  DUPE_GOLD: { common: 25, rare: 75, legendary: 200 } as Record<Rarity, number>,
  ELITE_DROP_CHANCE: 0.12,
  TREASURE_DROP_CHANCE: 0.35, // keyed treasure room, on unlocking
  SECRET_DROP_CHANCE: 0.35, // secret room, on revealing
  ELITE_WEIGHTS: { common: 70, rare: 27, legendary: 3 } as Record<Rarity, number>,
  TREASURE_WEIGHTS: { common: 50, rare: 40, legendary: 10 } as Record<Rarity, number>,
} as const;

/** Boss finales pay better the deeper the quest: rarity weights by kit tier. */
export function bossItemWeights(tier: number): Record<Rarity, number> {
  if (tier >= 5) return { common: 5, rare: 50, legendary: 45 };
  if (tier >= 3) return { common: 20, rare: 55, legendary: 25 };
  return { common: 40, rare: 45, legendary: 15 };
}

export function itemsOfRarity(rarity: Rarity): ItemId[] {
  return ALL_ITEM_IDS.filter(id => ITEMS[id].rarity === rarity);
}

/** Weighted rarity roll, then a uniform pick within it (live rng only). */
export function rollItemDrop(rng: Rng, weights: Record<Rarity, number>): ItemId {
  const total = weights.common + weights.rare + weights.legendary;
  let roll = rng.next() * total;
  let rarity: Rarity = 'legendary';
  for (const r of ['common', 'rare', 'legendary'] as Rarity[]) {
    roll -= weights[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  return rng.pick(itemsOfRarity(rarity));
}

/** Merged, flattened effects of an equipped set (all fields present). */
export function mergeItemEffects(ids: Iterable<ItemId>): Required<Omit<ItemEffects, 'statBonus'>> & {
  statBonus: Partial<Record<StatId, number>>;
} {
  const out = { damage: 0, hp: 0, speed: 0, knockback: 0, daggerCap: 0, statBonus: {} as Partial<Record<StatId, number>> };
  for (const id of ids) {
    const effects = ITEMS[id].effects;
    out.damage += effects.damage ?? 0;
    out.hp += effects.hp ?? 0;
    out.speed += effects.speed ?? 0;
    out.knockback += effects.knockback ?? 0;
    out.daggerCap += effects.daggerCap ?? 0;
    for (const [stat, points] of Object.entries(effects.statBonus ?? {})) {
      out.statBonus[stat as StatId] = (out.statBonus[stat as StatId] ?? 0) + (points ?? 0);
    }
  }
  return out;
}

