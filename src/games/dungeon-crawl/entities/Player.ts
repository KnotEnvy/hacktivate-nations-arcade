// ===== src/games/dungeon-crawl/entities/Player.ts =====
// The hero: smooth tile-collided movement, sword arc melee, dagger throwing,
// hearts, i-frames, and relic/potion stat stacking. DungeonCrawlGame owns
// damage bookkeeping; this class owns the body.

import { BoonId, BOON_TUNING } from '../data/boons';
import { ClassDef, ClassId, ClassKit, CLASS_TUNING, DEFAULT_KIT } from '../data/classes';
import { GEAR_TUNING, GearId } from '../data/gear';
import { ItemEffects } from '../data/items';
import { LINEAGE_TUNING, LineageId } from '../data/lineages';
import { LevelGain } from '../data/progression';
import { PLAYER, PICKUPS, PotionBuff } from '../data/constants';
import { RelicId, RELIC_TUNING } from '../data/relics';
import { ScrollId } from '../data/scrolls';
import { SpellId } from '../data/spells';
import { STAT_TUNING, StatId, zeroStatMods } from '../data/stats';
import { TileMap } from '../dungeon/TileMap';

export interface SwordSwing {
  timer: number; // counts down from SWORD_ACTIVE while damage window is live
  dirX: number;
  dirY: number;
  hitIds: Set<number>; // enemies already damaged by this swing
}

export class Player {
  x = 0;
  y = 0;
  readonly size = PLAYER.HITBOX;

  hp: number = PLAYER.MAX_HP;
  maxHp: number = PLAYER.MAX_HP;
  invuln = 0; // i-frame seconds remaining
  hitFlash = 0;

  // Facing — unit-ish vector of last movement (defaults to "down" for the sprite).
  faceX = 0;
  faceY = 1;
  moving = false;

  daggers: number = PLAYER.START_DAGGERS;
  keys = 0;

  swing: SwordSwing | null = null;
  private swordCooldown = 0;
  private daggerCooldown = 0;
  swingAnim = 0; // longer visual tail than the damage window

  // v2 — dodge dash.
  dashTimer = 0; // > 0 while mid-dash
  dashCooldown = 0;
  // Wave K — public: TileRenderer draws the dash ghost trail along these.
  dashDirX = 0;
  dashDirY = 1;

  // v3 — class kit (neutral until the run-start pick) + signature ability.
  kit: ClassKit = DEFAULT_KIT;
  classId: ClassId | null = null;
  abilityCooldown = 0;
  hiddenTimer = 0; // thief Hide in Shadows — enemies drop aggro while > 0
  private manaRegenTimer = 0;

  // v3 wave 3 — the scroll satchel (one at a time) + Ring of Renewal timer.
  scroll: ScrollId | null = null;
  private hpRegenTimer = 0;

  // v4 Wave D — grimoire cooldowns: seconds remaining per learned spell.
  private spellCds = new Map<SpellId, number>();

  // v4 — persistent hero training, re-applied from the save each run.
  boons = new Map<BoonId, number>();
  levelBonus = { hp: 0, speed: 0, daggerCap: 0 };
  // v5 Wave E — ability-score modifier DELTAS vs the class base (all zero =
  // the pre-stats game). Folded into the derived-stat getters below.
  statMods: Record<StatId, number> = zeroStatMods();
  // v5 Wave F — merged flat effects of worn equipment (statBonus rides
  // statMods upstream; this bag is everything else).
  itemEffects = { damage: 0, hp: 0, speed: 0, knockback: 0, daggerCap: 0 };
  survivorUsed = false;
  // v4 Wave B — blacksmith gear tiers + the alchemist's candle.
  gear = new Map<GearId, number>();
  provisionTorch = 0;

  // Relic stacks + potion buffs.
  relics = new Map<RelicId, number>();
  buffs = new Map<PotionBuff, number>(); // buff -> seconds remaining
  killsSinceHeal = 0; // vampire fang counter
  phoenixUsed = 0; // consumed Phoenix Feather stacks

  // Wave I — the bloodline (applied beside applyKit; 'human' is neutral).
  lineage: LineageId = 'human';
  stoneSenseSpent = false; // dwarf: recharged each floor by the game
  luckUsed = false; // halfling: once per expedition (reset() = depart)

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.kit = DEFAULT_KIT;
    this.classId = null;
    this.abilityCooldown = 0;
    this.hiddenTimer = 0;
    this.manaRegenTimer = 0;
    this.scroll = null;
    this.hpRegenTimer = 0;
    this.boons.clear();
    this.levelBonus = { hp: 0, speed: 0, daggerCap: 0 };
    this.statMods = zeroStatMods();
    this.itemEffects = { damage: 0, hp: 0, speed: 0, knockback: 0, daggerCap: 0 };
    this.survivorUsed = false;
    this.gear.clear();
    this.provisionTorch = 0;
    this.hp = this.kit.maxHp;
    this.maxHp = this.kit.maxHp;
    this.invuln = 0;
    this.hitFlash = 0;
    this.faceX = 0;
    this.faceY = 1;
    this.daggers = this.kit.startDaggers;
    this.keys = 0;
    this.swing = null;
    this.swordCooldown = 0;
    this.daggerCooldown = 0;
    this.swingAnim = 0;
    this.relics.clear();
    this.buffs.clear();
    this.killsSinceHeal = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.phoenixUsed = 0;
    this.spellCds.clear();
    this.lineage = 'human';
    this.stoneSenseSpent = false;
    this.luckUsed = false;
  }

  /** Wave I — set the hero's bloodline (call right after applyKit). */
  applyLineage(id: LineageId): void {
    this.lineage = id;
  }

  /** Wave I — a new floor re-arms the dwarf's trap warning. */
  rechargeStoneSense(): void {
    this.stoneSenseSpent = false;
  }

  /**
   * Wave I — STONE-SENSE: a dwarf shrugs off the first trap each floor.
   * Deterministic (no roll); only fires when the hit would actually land.
   */
  tryConsumeStoneSense(): boolean {
    if (this.lineage !== 'dwarf' || this.stoneSenseSpent || this.invuln > 0) return false;
    this.stoneSenseSpent = true;
    return true;
  }

  /**
   * Wave I — LUCK'S LAST WORD: a halfling's killing blow misses once per
   * expedition. Checked after phoenix and survivor (magic, grit, then luck).
   */
  tryConsumeLuck(): boolean {
    if (this.lineage !== 'halfling' || this.luckUsed) return false;
    this.luckUsed = true;
    this.hp = LINEAGE_TUNING.HALFLING_ESCAPE_HP;
    this.invuln = LINEAGE_TUNING.HALFLING_ESCAPE_INVULN;
    this.hitFlash = 0;
    return true;
  }

  // v4 Wave D — grimoire cooldown plumbing (ticked in update).
  spellCooldown(id: SpellId): number {
    return this.spellCds.get(id) ?? 0;
  }

  /** v5 Wave E — Intelligence returns spells sooner (per delta point). */
  spellCooldownFull(baseSeconds: number): number {
    return baseSeconds * Math.pow(STAT_TUNING.INT_SPELL_CD_MULT, this.statMods.int);
  }

  startSpellCooldown(id: SpellId, seconds: number): void {
    this.spellCds.set(id, this.spellCooldownFull(seconds));
  }

  /** Move to a new floor: position resets, run state (relics, hp) persists. */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.swing = null;
    this.swingAnim = 0;
    this.dashTimer = 0;
  }

  /** v3 — the run-start class pick: kit stats, hearts and daggers in one go. */
  applyKit(def: ClassDef): void {
    this.kit = def.kit;
    this.classId = def.id;
    this.maxHp = def.kit.maxHp;
    this.hp = def.kit.maxHp;
    this.daggers = def.kit.startDaggers;
    this.abilityCooldown = 0;
    this.hiddenTimer = 0;
    this.manaRegenTimer = def.kit.daggerRegenInterval;
  }

  boonCount(id: BoonId): number {
    return this.boons.get(id) ?? 0;
  }

  gearTier(id: GearId): number {
    return this.gear.get(id) ?? 0;
  }

  /**
   * v4 — apply the hero's banked training on top of the class kit: level
   * gains + boon stacks + blacksmith gear. Call right after applyKit at
   * expedition start.
   */
  applyProgression(
    gains: { hp: number; speed: number; daggerCap: number },
    boons: Partial<Record<BoonId, number>>,
    gear: Partial<Record<GearId, number>> = {},
    statDeltas: Record<StatId, number> = zeroStatMods(),
  ): void {
    this.levelBonus = { ...gains };
    this.statMods = { ...statDeltas };
    // Equipment re-arms separately (applyEquipment) — start from bare.
    this.itemEffects = { damage: 0, hp: 0, speed: 0, knockback: 0, daggerCap: 0 };
    this.boons.clear();
    for (const [id, count] of Object.entries(boons)) {
      if (typeof count === 'number' && count > 0) this.boons.set(id as BoonId, count);
    }
    this.gear.clear();
    for (const [id, tier] of Object.entries(gear)) {
      if (typeof tier === 'number' && tier > 0) this.gear.set(id as GearId, tier);
    }
    this.survivorUsed = false;
    this.maxHp = Math.min(
      PLAYER.HP_CAP,
      this.kit.maxHp +
        gains.hp +
        this.boonCount('toughness') * BOON_TUNING.TOUGHNESS_HP +
        this.gearTier('armor') * GEAR_TUNING.ARMOR_HP +
        this.statMods.con * STAT_TUNING.CON_HP,
    );
    this.hp = this.maxHp;
    this.daggers = Math.min(
      this.daggerCap(),
      this.kit.startDaggers + this.gearTier('quiver') * GEAR_TUNING.QUIVER_START,
    );
  }

  /** v4 — a mid-run level-up lands its gains (and heals what it grants). */
  gainLevelBenefits(gain: LevelGain): void {
    this.levelBonus.hp += gain.hp ?? 0;
    this.levelBonus.speed += gain.speed ?? 0;
    this.levelBonus.daggerCap += gain.daggerCap ?? 0;
    if (gain.hp) {
      this.maxHp = Math.min(PLAYER.HP_CAP, this.maxHp + gain.hp);
      this.hp = Math.min(this.maxHp, this.hp + gain.hp);
    }
  }

  /**
   * v5 Wave F — worn equipment's merged flat effects land (or re-land after
   * a swap): hp moves the ceiling by its delta, everything else folds live
   * through the getters. statBonus is handled upstream via setStatMods.
   */
  applyEquipment(effects: Required<Omit<ItemEffects, 'statBonus'>>): void {
    const hpGain = effects.hp - this.itemEffects.hp;
    this.itemEffects = {
      damage: effects.damage,
      hp: effects.hp,
      speed: effects.speed,
      knockback: effects.knockback,
      daggerCap: effects.daggerCap,
    };
    if (hpGain !== 0) {
      this.maxHp = Math.max(2, Math.min(PLAYER.HP_CAP, this.maxHp + hpGain));
      this.hp = Math.max(1, Math.min(this.maxHp, this.hp + Math.max(0, hpGain)));
    }
    this.daggers = Math.min(this.daggerCap(), this.daggers);
  }

  /**
   * v5 Wave E — a milestone stat bump (or any mid-run score change) lands its
   * new deltas; a CON rise grants its hearts on the spot like Toughness does.
   */
  setStatMods(mods: Record<StatId, number>): void {
    const conGain = (mods.con - this.statMods.con) * STAT_TUNING.CON_HP;
    this.statMods = { ...mods };
    if (conGain > 0) {
      this.maxHp = Math.min(PLAYER.HP_CAP, this.maxHp + conGain);
      this.hp = Math.min(this.maxHp, this.hp + conGain);
    }
  }

  /** v4 — a freshly chosen boon takes hold immediately. */
  gainBoon(id: BoonId): void {
    this.boons.set(id, this.boonCount(id) + 1);
    if (id === 'toughness') {
      this.maxHp = Math.min(PLAYER.HP_CAP, this.maxHp + BOON_TUNING.TOUGHNESS_HP);
      this.hp = Math.min(this.maxHp, this.hp + BOON_TUNING.TOUGHNESS_HP);
    }
  }

  relicCount(id: RelicId): number {
    return this.relics.get(id) ?? 0;
  }

  addRelic(id: RelicId): void {
    this.relics.set(id, this.relicCount(id) + 1);
    if (id === 'tower-shield') {
      this.maxHp = Math.min(PLAYER.HP_CAP, this.maxHp + RELIC_TUNING.TOWER_SHIELD_HP);
      this.hp = Math.min(this.maxHp, this.hp + RELIC_TUNING.TOWER_SHIELD_HP);
    }
    if (id === 'dagger-sage') {
      this.daggers = Math.min(this.daggerCap(), this.daggers + 2);
    }
  }

  daggerCap(): number {
    return (
      this.kit.daggerCap +
      this.levelBonus.daggerCap +
      this.gearTier('quiver') * GEAR_TUNING.QUIVER_CAP +
      this.relicCount('dagger-sage') * RELIC_TUNING.DAGGER_SAGE_CAP_BONUS +
      this.itemEffects.daggerCap +
      // Wave I — KEEN QUIVER: one more blade rides an elf's sheath.
      (this.lineage === 'elf' ? LINEAGE_TUNING.ELF_DAGGER_CAP : 0)
    );
  }

  daggersPierce(): boolean {
    return this.relicCount('dagger-sage') > 0;
  }

  speed(): number {
    let mult = 1 + this.relicCount('swift-boots') * RELIC_TUNING.SWIFT_BOOTS_SPEED_MULT;
    if (this.buffs.has('haste')) mult *= 1.35;
    const training =
      1 +
      this.levelBonus.speed +
      this.boonCount('fleet-foot') * BOON_TUNING.FLEET_FOOT_SPEED +
      this.gearTier('boots') * GEAR_TUNING.BOOTS_SPEED +
      this.statMods.dex * STAT_TUNING.DEX_SPEED +
      this.itemEffects.speed;
    return PLAYER.SPEED * this.kit.speedMult * training * mult;
  }

  meleeRange(): number {
    return this.kit.meleeRange;
  }

  meleeArcDeg(): number {
    return this.kit.meleeArcDeg;
  }

  meleeKnockback(): number {
    const ogre = this.relicCount('ogre-gauntlets');
    const base =
      this.kit.meleeKnockback +
      this.statMods.str * STAT_TUNING.STR_KNOCKBACK +
      this.itemEffects.knockback;
    return base * (1 + ogre * RELIC_TUNING.OGRE_KNOCKBACK_MULT);
  }

  swordDamage(): number {
    let dmg =
      1 +
      this.kit.meleeDamageBonus +
      this.boonCount('weapon-specialization') * BOON_TUNING.WEAPON_SPEC_DAMAGE +
      this.gearTier('blade') * GEAR_TUNING.BLADE_DAMAGE +
      this.relicCount('ember-blade') * RELIC_TUNING.EMBER_BLADE_DAMAGE +
      this.statMods.str * STAT_TUNING.STR_DAMAGE +
      this.itemEffects.damage;
    if (this.buffs.has('strength')) dmg += 1;
    if (
      this.relicCount('berserker-rage') > 0 &&
      this.hp <= RELIC_TUNING.BERSERKER_THRESHOLD_HP
    ) {
      dmg += RELIC_TUNING.BERSERKER_DAMAGE * this.relicCount('berserker-rage');
    }
    return dmg;
  }

  daggerDamage(): number {
    // Daggers ride the melee stack, plus dedicated Marksman training.
    return this.swordDamage() + this.boonCount('marksman') * BOON_TUNING.MARKSMAN_DAMAGE;
  }

  /** Heart pickups: kit bonus (cleric) + Herbalism training + Wisdom. */
  heartHealBonus(): number {
    return (
      this.kit.healBonus +
      this.boonCount('herbalism') * BOON_TUNING.HERBALISM_HEAL +
      this.statMods.wis * STAT_TUNING.WIS_HEAL
    );
  }

  torchBonus(): number {
    return this.relicCount('keen-eye') + this.provisionTorch;
  }

  hasCoinMagnet(): boolean {
    return this.relicCount('coin-magnet') > 0;
  }

  addBuff(buff: PotionBuff): void {
    this.buffs.set(buff, PICKUPS.POTION_DURATION);
  }

  /** Returns true if damage was applied (not absorbed / i-framed). */
  takeDamage(amount: number): boolean {
    if (this.invuln > 0) return false;
    if (this.buffs.has('stoneskin')) {
      this.buffs.delete('stoneskin'); // absorbs one hit, then shatters
      this.invuln = PLAYER.HIT_INVULN * 0.5;
      return false;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.invuln =
      PLAYER.HIT_INVULN *
      (1 + this.boonCount('blind-fighting') * BOON_TUNING.BLIND_FIGHT_INVULN_MULT);
    this.hitFlash = 0.4;
    return true;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * v2 — Phoenix Feather: consume an unspent stack to cheat death.
   * Returns true when the revive fired (caller restores the run).
   */
  tryConsumePhoenix(): boolean {
    if (this.relicCount('phoenix-feather') <= this.phoenixUsed) return false;
    this.phoenixUsed++;
    this.hp = RELIC_TUNING.PHOENIX_REVIVE_HP;
    this.invuln = RELIC_TUNING.PHOENIX_INVULN;
    this.hitFlash = 0;
    return true;
  }

  /**
   * v4 — Survivor training: cheat death once per expedition. Checked after
   * Phoenix Feathers (magic burns before grit).
   */
  tryConsumeSurvivor(): boolean {
    if (this.boonCount('survivor') === 0 || this.survivorUsed) return false;
    this.survivorUsed = true;
    this.hp = BOON_TUNING.SURVIVOR_HP;
    this.invuln = BOON_TUNING.SURVIVOR_INVULN;
    this.hitFlash = 0;
    return true;
  }

  /** Vampire Fang bookkeeping — call once per kill; returns true when it heals. */
  onKill(): boolean {
    if (this.relicCount('vampire-fang') === 0) return false;
    this.killsSinceHeal++;
    const needed = Math.max(
      3,
      Math.ceil(RELIC_TUNING.VAMPIRE_KILLS_PER_HEAL / this.relicCount('vampire-fang')),
    );
    if (this.killsSinceHeal >= needed) {
      this.killsSinceHeal = 0;
      this.heal(1);
      return true;
    }
    return false;
  }

  update(dt: number, moveX: number, moveY: number, map: TileMap): void {
    // Timers.
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.swordCooldown > 0) this.swordCooldown = Math.max(0, this.swordCooldown - dt);
    if (this.daggerCooldown > 0) this.daggerCooldown = Math.max(0, this.daggerCooldown - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.hiddenTimer > 0) this.hiddenTimer = Math.max(0, this.hiddenTimer - dt);
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - dt);
    for (const [id, cd] of this.spellCds) {
      if (cd > 0) this.spellCds.set(id, Math.max(0, cd - dt));
    }
    // v3 — dagger regen: mage kit and/or Bottomless Quiver (fastest wins).
    const quiver = this.relicCount('bottomless-quiver');
    const quiverInterval = quiver > 0 ? RELIC_TUNING.QUIVER_REGEN_INTERVAL / quiver : 0;
    const kitInterval = this.kit.daggerRegenInterval;
    const regenInterval =
      kitInterval > 0 && quiverInterval > 0
        ? Math.min(kitInterval, quiverInterval)
        : kitInterval || quiverInterval;
    if (regenInterval > 0 && this.daggers < this.daggerCap()) {
      this.manaRegenTimer -= dt;
      if (this.manaRegenTimer <= 0) {
        this.daggers++;
        this.manaRegenTimer += regenInterval;
      }
    }

    // v3 — Ring of Renewal: wounds slowly knit closed.
    const renewal = this.relicCount('ring-of-renewal');
    if (renewal > 0 && this.hp < this.maxHp) {
      this.hpRegenTimer += dt;
      const interval = RELIC_TUNING.RENEWAL_INTERVAL / renewal;
      if (this.hpRegenTimer >= interval) {
        this.hpRegenTimer -= interval;
        this.heal(1);
      }
    } else {
      this.hpRegenTimer = 0;
    }
    if (this.swing) {
      this.swing.timer -= dt;
      if (this.swing.timer <= 0) this.swing = null;
    }
    for (const [buff, remaining] of this.buffs) {
      const next = remaining - dt;
      if (next <= 0) this.buffs.delete(buff);
      else this.buffs.set(buff, next);
    }

    // Mid-dash: locked into the dash vector, normal steering suspended.
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      const moved = map.moveWithCollision(
        this.x,
        this.y,
        this.size,
        this.dashDirX * PLAYER.DASH_SPEED * dt,
        this.dashDirY * PLAYER.DASH_SPEED * dt,
      );
      this.x = moved.x;
      this.y = moved.y;
      this.moving = true;
      return;
    }

    // Movement (normalized diagonals).
    this.moving = moveX !== 0 || moveY !== 0;
    if (this.moving) {
      const len = Math.hypot(moveX, moveY);
      const nx = moveX / len;
      const ny = moveY / len;
      this.faceX = nx;
      this.faceY = ny;
      const speed = this.speed();
      const moved = map.moveWithCollision(this.x, this.y, this.size, nx * speed * dt, ny * speed * dt);
      this.x = moved.x;
      this.y = moved.y;
    }
  }

  /**
   * v2 — attempt a dash toward the held movement direction (facing when
   * standing still). Returns true when the dash started.
   */
  tryDash(moveX: number, moveY: number): boolean {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return false;
    let dx = moveX;
    let dy = moveY;
    if (dx === 0 && dy === 0) {
      dx = this.faceX;
      dy = this.faceY;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;
    this.faceX = this.dashDirX;
    this.faceY = this.dashDirY;
    this.dashTimer = PLAYER.DASH_DURATION;
    const cloak = this.relicCount('shadow-cloak');
    this.dashCooldown = this.dashCooldownFull();
    // Dash grants i-frames through the burst plus a small tail.
    const iframes =
      PLAYER.DASH_DURATION +
      PLAYER.DASH_IFRAME_TAIL +
      cloak * RELIC_TUNING.SHADOW_CLOAK_IFRAME_BONUS;
    this.invuln = Math.max(this.invuln, iframes);
    return true;
  }

  /** Full dash cooldown after relic discounts + Dexterity. */
  dashCooldownFull(): number {
    const cloak = this.relicCount('shadow-cloak');
    return (
      PLAYER.DASH_COOLDOWN *
      Math.pow(RELIC_TUNING.SHADOW_CLOAK_COOLDOWN_MULT, cloak) *
      Math.pow(STAT_TUNING.DEX_DASH_CD_MULT, this.statMods.dex)
    );
  }

  /** Fraction of dash cooldown remaining (1 = just used, 0 = ready). */
  dashCooldownFrac(): number {
    const full = this.dashCooldownFull();
    return full > 0 ? this.dashCooldown / full : 0;
  }

  /** Full ability cooldown after relic + training discounts. */
  abilityCooldownFull(): number {
    const bracers = this.relicCount('war-bracers');
    const ironWill = this.boonCount('iron-will');
    return (
      this.kit.abilityCooldown *
      Math.pow(RELIC_TUNING.WAR_BRACERS_CD_MULT, bracers) *
      Math.pow(BOON_TUNING.IRON_WILL_CD_MULT, ironWill)
    );
  }

  /**
   * v3 — start the signature ability's cooldown. Effects resolve in the game
   * (they touch enemies/projectiles); this only gates and times the cast.
   */
  tryAbility(): boolean {
    if (this.abilityCooldown > 0) return false;
    this.abilityCooldown = this.abilityCooldownFull();
    return true;
  }

  /** Fraction of ability cooldown remaining (1 = just used, 0 = ready). */
  abilityCooldownFrac(): number {
    const full = this.abilityCooldownFull();
    return full > 0 ? this.abilityCooldown / full : 0;
  }

  /** Thief Hide in Shadows: untargetable, safety riding the shared invuln. */
  startHide(): void {
    this.hiddenTimer = CLASS_TUNING.HIDE_DURATION;
    this.invuln = Math.max(this.invuln, CLASS_TUNING.HIDE_DURATION);
  }

  /** Attempt a sword swing. Returns true if it started (cooldown ready). */
  trySwing(): boolean {
    if (this.swordCooldown > 0) return false;
    this.swordCooldown = this.kit.meleeCooldown;
    this.swing = {
      timer: PLAYER.SWORD_ACTIVE,
      dirX: this.faceX,
      dirY: this.faceY,
      hitIds: new Set(),
    };
    this.swingAnim = 0.22;
    return true;
  }

  /** Attempt a dagger throw. Returns the direction if thrown, else null. */
  tryThrowDagger(): { dirX: number; dirY: number } | null {
    if (this.daggerCooldown > 0 || this.daggers <= 0) return null;
    this.daggerCooldown = PLAYER.DAGGER_COOLDOWN;
    this.daggers--;
    return { dirX: this.faceX, dirY: this.faceY };
  }

  /** Whether a world point is inside the live sword arc. */
  swingHits(targetX: number, targetY: number, targetRadius: number): boolean {
    if (!this.swing) return false;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.kit.meleeRange + targetRadius) return false;
    if (dist < 0.001) return true;
    const dot = (dx / dist) * this.swing.dirX + (dy / dist) * this.swing.dirY;
    const halfArcCos = Math.cos(((this.kit.meleeArcDeg / 2) * Math.PI) / 180);
    return dot >= halfArcCos;
  }
}
