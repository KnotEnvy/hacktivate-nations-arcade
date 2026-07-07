// ===== src/games/dungeon-crawl/data/scrolls.ts =====
// v3 — one-shot scrolls. Found UNIDENTIFIED: the generator only places the
// pickup kind; identity rolls from the live gameplay rng at collection. The
// player carries one at a time and reads it with F / O. Effects resolve in
// DungeonCrawlGame/Combat; nothing here executes logic. All text original.

export type ScrollId = 'flame' | 'frost' | 'healing' | 'shielding' | 'revelation';

export interface ScrollDef {
  id: ScrollId;
  name: string;
  blurb: string; // banner line when identified / read
  icon: string; // glyph on the HUD satchel slot
  color: string;
}

export const SCROLLS: Record<ScrollId, ScrollDef> = {
  flame: {
    id: 'flame',
    name: 'SCROLL OF FLAME',
    blurb: 'Hurls a searing blast ahead of you',
    icon: '♨',
    color: '#ff7a1a',
  },
  frost: {
    id: 'frost',
    name: 'SCROLL OF FROST',
    blurb: 'Every monster in sight freezes mid-step',
    icon: '❄',
    color: '#9ad8ff',
  },
  healing: {
    id: 'healing',
    name: 'SCROLL OF HEALING',
    blurb: 'Mends two full hearts',
    icon: '✜',
    color: '#ff4d5e',
  },
  shielding: {
    id: 'shielding',
    name: 'SCROLL OF SHIELDING',
    blurb: 'The next blow shatters harmlessly',
    icon: '◈',
    color: '#9aa5b5',
  },
  revelation: {
    id: 'revelation',
    name: 'SCROLL OF REVELATION',
    blurb: 'The floor, known corridor by corridor',
    icon: '✧',
    color: '#ffe08a',
  },
};

export const ALL_SCROLL_IDS = Object.keys(SCROLLS) as ScrollId[];

export const SCROLL_TUNING = {
  FLAME_LOB_DIST: 96, // px ahead of the player
  FLAME_FLIGHT: 0.35,
  FLAME_FUSE: 0.3,
  FLAME_RADIUS: 72,
  FLAME_DAMAGE: 3,
  FROST_RADIUS: 380,
  FROST_STUN: 2.5, // seconds — reuses Enemy.stunned
  HEAL_HP: 4,
  SHIELD_INVULN: 1.0, // seconds on top of the stoneskin buff
} as const;
