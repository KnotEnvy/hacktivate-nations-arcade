// ===== src/games/dungeon-crawl/data/causes.ts =====
// Death-recap copy for every DeathCause: the headline and the tactical hint.
// Pure data, extracted from DungeonCrawlGame. TypeScript errors here if a new
// DeathCause is added without its label + hint — that's the point.

import { DeathCause } from '../systems/Combat';

export const CAUSE_LABELS: Record<DeathCause, string> = {
  slime: 'DISSOLVED BY A SLIME',
  skeleton: 'CUT DOWN BY A SKELETON',
  bat: 'SWARMED BY BATS',
  sorcerer_bolt: 'STRUCK BY SORCERY',
  knight: 'CRUSHED BY A KNIGHT',
  mimic: 'EATEN BY A MIMIC',
  bomber: 'MUGGED BY A BOMBER',
  wraith: 'CHILLED BY A WRAITH',
  beetle: 'PINCERED BY A FIRE BEETLE',
  zombie: 'DRAGGED DOWN BY A ZOMBIE',
  ghoul: 'TORN APART BY A GHOUL',
  ooze: 'ENGULFED BY AN OOZE',
  lizardman: 'SPEARED BY A LIZARDMAN',
  shade: 'SMOTHERED BY A SHADE',
  hound: 'RUN DOWN BY A CINDER HOUND',
  salamander: 'SCORCHED BY A SALAMANDER',
  bone_arrow: 'FEATHERED BY A BONE ARCHER',
  drowned: 'PULLED UNDER BY THE DROWNED',
  wight: 'DRAINED BY AN EMBER WIGHT',
  gargoyle: 'DASHED APART BY A GARGOYLE',
  hazard: 'CAUGHT BY A TRAP',
  explosion: 'CAUGHT IN THE BLAST',
  shockwave: 'FLATTENED BY THE SLAM',
  boss_touch: 'BURNED BY THE GUARDIAN',
  boss_charge: 'TRAMPLED BY THE GUARDIAN',
  boss_bolt: 'SCORCHED BY GUARDIAN FIRE',
};

export const CAUSE_HINTS: Record<DeathCause, string> = {
  slime: 'Slimes split when they die — finish the minis fast.',
  skeleton: 'Skeletons chase in straight lines. Kite them around corners.',
  bat: 'Bats weave — wait for the lunge, then swing.',
  sorcerer_bolt: 'Sorcerer bolts telegraph. Sidestep on the flash.',
  knight: 'Knights block frontal swings. Flank them — or daggers pierce.',
  mimic: 'Not every chest is a friend. Watch for the ones that breathe.',
  bomber: 'Bombers lob where you WILL be. Change direction on the throw.',
  wraith: 'Wraiths walk through walls. Open ground is your friend.',
  beetle: 'Fire beetles light their own way — you always see them coming. Use that.',
  zombie: 'Zombies are slow as grave-dirt. Never let them corner you.',
  ghoul: 'Ghouls hunt in fearless packs. Thin them at range before they close.',
  ooze: 'Oozes split when they die. Clear the halves before carving the next one.',
  lizardman: 'Lizardmen are tough and hit hard. Trade carefully — or not at all.',
  shade: 'Shades slip through walls like the wraiths they serve. Keep to open ground.',
  hound: 'Cinder hounds outrun you in a straight line. Dash sideways, not away.',
  salamander: 'Salamanders duel happily at range. Close the gap — the fire lives in the spit, not the fangs.',
  bone_arrow: 'Bone archers loose along sight-lines. Break theirs before they draw.',
  drowned: 'The drowned are slow, patient and tireless. Never trade with them in a doorway.',
  wight: 'Wights turn frontal blows like knights do. Flank them — or let daggers bite.',
  gargoyle: 'Stone wings stoop fast out of the dark. Swing where it will land, not where it is.',
  hazard: 'Traps telegraph before they strike. Watch the floor.',
  explosion: 'The blast ring shows the radius. Dash out — Shift is faster than feet.',
  shockwave: 'Shockwave rings have gaps in time, not space. Dash through the ring.',
  boss_touch: 'Keep moving — the Guardian punishes standing still.',
  boss_charge: 'The charge telegraphs with a glowing ring. Break line with a pillar.',
  boss_bolt: 'The bolt ring has gaps. Walk, don’t panic-run.',
};
