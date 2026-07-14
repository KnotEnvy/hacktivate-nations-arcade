// ===== src/data/dungeonCrawlAchievements.ts =====
// Dungeon Crawl (Ember Depths) achievements, extracted from achievements.ts
// when the v3 waves pushed that file past the 1500-line guardrail. Every
// requirement.type MUST exactly match a key in the game's syncExtendedData()
// (see src/games/dungeon-crawl/DungeonCrawlGame.ts).

import type { Achievement } from '@/services/AchievementService';

export const DUNGEON_CRAWL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'dungeon_first_descent',
    title: 'First Descent',
    description: 'Reach floor 2 of the Ember Depths',
    icon: '🕯️',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'depth', value: 2 },
    reward: 50,
    unlocked: false
  },
  {
    id: 'dungeon_deep_delver',
    title: 'Deep Delver',
    description: 'Reach floor 5 in one run',
    icon: '⛏️',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'depth', value: 5 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_ember_lord',
    title: 'Lord of the Depths',
    description: 'Reach floor 10 in one run',
    icon: '🔥',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'depth', value: 10 },
    reward: 600,
    unlocked: false
  },
  {
    id: 'dungeon_monster_hunter',
    title: 'Monster Hunter',
    description: 'Slay 25 monsters in one run',
    icon: '⚔️',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'enemies_slain', value: 25 },
    reward: 100,
    unlocked: false
  },
  {
    id: 'dungeon_exterminator',
    title: 'Exterminator',
    description: 'Slay 75 monsters in one run',
    icon: '💀',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'enemies_slain', value: 75 },
    reward: 300,
    unlocked: false
  },
  {
    id: 'dungeon_guardian_slayer',
    title: 'Guardian Slayer',
    description: 'Defeat an Ember Guardian',
    icon: '🛡️',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'bosses_slain', value: 1 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_king_slayer',
    title: 'King Slayer',
    description: 'Defeat 3 Ember Guardians in one run',
    icon: '👑',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'bosses_slain', value: 3 },
    reward: 500,
    unlocked: false
  },
  {
    id: 'dungeon_treasure_hunter',
    title: 'Treasure Hunter',
    description: 'Plunder 100 gold in one run',
    icon: '💰',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'gold_collected', value: 100 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_relic_collector',
    title: 'Relic Collector',
    description: 'Claim 5 relics in one run',
    icon: '🔮',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'relics_collected', value: 5 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_untouchable',
    title: 'Untouchable',
    description: 'Clear a floor without taking damage',
    icon: '✨',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'perfect_floors', value: 1 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_chain_reaper',
    title: 'Chain Reaper',
    description: 'Reach a x4 kill combo',
    icon: '🔗',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'combo', value: 4 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_mimic_bane',
    title: 'Mimic Bane',
    description: 'Uncover 3 mimics in one run',
    icon: '📦',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'mimics_found', value: 3 },
    reward: 250,
    unlocked: false
  },
  {
    id: 'dungeon_elite_hunter',
    title: 'Elite Hunter',
    description: 'Slay 5 elite monsters in one run',
    icon: '🎖️',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'elites_slain', value: 5 },
    reward: 250,
    unlocked: false
  },
  {
    id: 'dungeon_trifecta',
    title: 'Guardian Trifecta',
    description: 'Fell all three Guardians in one run',
    icon: '🏆',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'unique_bosses', value: 3 },
    reward: 750,
    unlocked: false
  },
  {
    id: 'dungeon_abyss_walker',
    title: 'Abyss Walker',
    description: 'Reach floor 15 in one run',
    icon: '🌑',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'depth', value: 15 },
    reward: 1000,
    unlocked: false
  },
  {
    id: 'dungeon_shopaholic',
    title: 'Shopaholic',
    description: 'Buy 3 items from the merchant in one run',
    icon: '🛒',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'items_bought', value: 3 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_big_spender',
    title: 'Big Spender',
    description: 'Spend 150 gold at merchants in one run',
    icon: '💸',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'gold_spent', value: 150 },
    reward: 250,
    unlocked: false
  },
  {
    id: 'dungeon_untouchable_ii',
    title: 'Ghost of the Depths',
    description: 'Clear 3 floors without taking damage in one run',
    icon: '👻',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'perfect_floors', value: 3 },
    reward: 400,
    unlocked: false
  },
  // v3 — class achievements
  {
    id: 'dungeon_fighter_depths',
    title: 'Sworn to the Sword',
    description: 'Reach floor 4 as the Fighter',
    icon: '⚔️',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'fighter_depth', value: 4 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_thief_depths',
    title: 'Shadow Walker',
    description: 'Reach floor 4 as the Thief',
    icon: '🗡️',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'thief_depth', value: 4 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_cleric_depths',
    title: 'Light in the Dark',
    description: 'Reach floor 4 as the Cleric',
    icon: '✨',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'cleric_depth', value: 4 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_mage_depths',
    title: 'Arcane Descent',
    description: 'Reach floor 4 as the Mage',
    icon: '🔮',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'mage_depth', value: 4 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_signature_move',
    title: 'Signature Move',
    description: 'Use your class ability 15 times in one run',
    icon: '💫',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'abilities_used', value: 15 },
    reward: 150,
    unlocked: false
  },
  // v3 — bestiary achievements
  {
    id: 'dungeon_bane_of_restless',
    title: 'Bane of the Restless',
    description: 'Slay 25 undead in one run',
    icon: '⚰️',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'undead_slain', value: 25 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_menagerie',
    title: 'Monster Menagerie',
    description: 'Slay 10 different kinds of monster in one run',
    icon: '📖',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'unique_slain', value: 10 },
    reward: 250,
    unlocked: false
  },
  // v3 — scroll achievements
  {
    id: 'dungeon_fine_print',
    title: 'Read the Fine Print',
    description: 'Read 5 scrolls in one run',
    icon: '📜',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'scrolls_used', value: 5 },
    reward: 150,
    unlocked: false
  },
  // v4 — character progression achievements
  {
    id: 'dungeon_first_boon',
    title: 'First Lesson',
    description: 'Level up and choose your first boon',
    icon: '📚',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'boons_chosen', value: 1 },
    reward: 100,
    unlocked: false
  },
  {
    id: 'dungeon_seasoned_hero',
    title: 'Veteran of the Depths',
    description: 'Raise your hero to level 3',
    icon: '🎖️',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'character_level', value: 3 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_living_legend',
    title: 'Living Legend',
    description: 'Raise your hero to level 5',
    icon: '🏅',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'character_level', value: 5 },
    reward: 300,
    unlocked: false
  },
  {
    id: 'dungeon_xp_hunter',
    title: 'Deeds Worth Telling',
    description: 'Earn 500 experience in a single expedition',
    icon: '⭐',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'xp_earned', value: 500 },
    reward: 200,
    unlocked: false
  },
  // v4 Wave B — Lastlight quest achievements
  {
    id: 'dungeon_first_contract',
    title: 'First Contract',
    description: 'Complete a quest from the Lastlight board',
    icon: '📋',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'quests_completed', value: 1 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_campaigner',
    title: 'Campaigner',
    description: 'Complete 2 quests in a single session',
    icon: '🗺️',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'quests_completed', value: 2 },
    reward: 350,
    unlocked: false
  },
  {
    id: 'dungeon_gold_banker',
    title: 'Coin Come Home',
    description: 'Bank 300 gold in a single session',
    icon: '🏦',
    gameId: 'dungeon-crawl',
    category: 'collection',
    requirement: { type: 'gold_banked', value: 300 },
    reward: 250,
    unlocked: false
  },
  // v4 Wave C — sagas + secret rooms
  {
    id: 'dungeon_saga_told',
    title: 'The Saga Is Told',
    description: 'Complete a full saga from the Lastlight board',
    icon: '📜',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'sagas_completed', value: 1 },
    reward: 400,
    unlocked: false
  },
  {
    id: 'dungeon_chronicler',
    title: 'Chronicler of the Depths',
    description: 'Complete two sagas in a single session',
    icon: '🏛️',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'sagas_completed', value: 2 },
    reward: 600,
    unlocked: false
  },
  {
    id: 'dungeon_behind_the_cracks',
    title: 'Behind the Cracks',
    description: 'Blast open a secret room',
    icon: '🧱',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'secrets_found', value: 1 },
    reward: 150,
    unlocked: false
  },
  {
    id: 'dungeon_nest_breaker',
    title: 'Nest Breaker',
    description: 'Clear a nest stirring in a secret room',
    icon: '🕸️',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'nests_cleared', value: 1 },
    reward: 200,
    unlocked: false
  },
  // v4 Wave D — the grimoire
  {
    id: 'dungeon_first_page',
    title: 'The First Page',
    description: 'Learn a spell at level-up',
    icon: '📖',
    gameId: 'dungeon-crawl',
    category: 'progression',
    requirement: { type: 'spells_learned', value: 1 },
    reward: 200,
    unlocked: false
  },
  {
    id: 'dungeon_spellslinger',
    title: 'Spellslinger',
    description: 'Cast 10 spells in a single session',
    icon: '✨',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'spells_cast', value: 10 },
    reward: 300,
    unlocked: false
  },
  // v5 Wave F — vaults & reliquaries
  {
    id: 'dungeon_first_find',
    title: 'A Find Worth Keeping',
    description: 'Pick up a piece of equipment in the depths',
    icon: '🎒',
    gameId: 'dungeon-crawl',
    category: 'gameplay',
    requirement: { type: 'items_found', value: 1 },
    reward: 200,
    unlocked: false
  },
  // v5 Wave G — the DM wave
  {
    id: 'dungeon_the_last_page',
    title: 'The Last Page',
    description: 'Tell every saga the depths hold in a single session',
    icon: '🖋️',
    gameId: 'dungeon-crawl',
    category: 'skill',
    requirement: { type: 'sagas_completed', value: 3 },
    reward: 1000,
    unlocked: false
  },
];
