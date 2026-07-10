// ===== src/games/dungeon-crawl/rendering/HudRenderer.ts =====
// v2 — all screen-space chrome extracted from DungeonCrawlGame: HUD panel,
// boss bar, floor banners, the relic draft, shop prompts and the death recap.
// Pure rendering: the game passes explicit view state, nothing reaches back.

import { BOONS, BoonId } from '../data/boons';
import { CLASSES, ClassId } from '../data/classes';
import { COMBAT, OVERLAY, PALETTE, PICKUPS, PotionBuff, VIEW } from '../data/constants';
import { GEAR, GEAR_TUNING, GearId, PROVISIONS, ProvisionId } from '../data/gear';
import { QUESTS, QuestId } from '../data/quests';
import { RELICS, RelicId } from '../data/relics';

export interface HudState {
  score: number;
  goldBalance: number;
  floor: number;
  hp: number;
  maxHp: number;
  daggers: number;
  keys: number;
  combo: number;
  comboTimer: number;
  dashFrac: number; // dash cooldown remaining, 0 = ready
  // v3 — class ability pip; null before the class pick.
  ability: { frac: number; icon: string; color: string } | null;
  // v3 wave 3 — held scroll (one satchel slot); null when empty.
  scroll: { icon: string; color: string } | null;
  // v4 — the persistent hero's level + progress to the next.
  hero: { level: number; xpFrac: number } | null;
  buffs: ReadonlyMap<PotionBuff, number>;
  relics: ReadonlyMap<RelicId, number>;
}

export interface RecapView {
  causeLabel: string;
  causeHint: string;
  rows: Array<[string, string]>;
  timer: number;
  // v4 — persistence messaging + the hold-R retire affordance.
  heroLine?: string;
  retireFrac?: number;
}

export class HudRenderer {
  renderHud(ctx: CanvasRenderingContext2D, s: HudState): void {
    // Panel (v4: one row taller for the hero's XP bar).
    const panelH = s.hero ? 124 : 108;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(10, 10, 250, panelH);
    ctx.strokeStyle = PALETTE.hudBorder;
    ctx.strokeRect(10.5, 10.5, 250, panelH);

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textWarm;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`SCORE ${s.score}`, 20, 32);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`GOLD  ${s.goldBalance}`, 20, 52);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`FLOOR ${s.floor}`, 170, 32);

    // Hearts (2 hp per heart).
    const hearts = Math.ceil(s.maxHp / 2);
    for (let i = 0; i < hearts; i++) {
      const hx = 20 + i * 20;
      const hy = 62;
      const hpInHeart = Math.max(0, Math.min(2, s.hp - i * 2));
      ctx.fillStyle = hpInHeart === 0 ? '#3a2a2a' : PALETTE.heart;
      if (hpInHeart === 1) {
        ctx.fillStyle = '#3a2a2a';
        this.drawHeart(ctx, hx, hy);
        ctx.fillStyle = PALETTE.heart;
        ctx.save();
        ctx.beginPath();
        ctx.rect(hx, hy - 6, 8, 16);
        ctx.clip();
        this.drawHeart(ctx, hx, hy);
        ctx.restore();
      } else {
        this.drawHeart(ctx, hx, hy);
      }
    }

    // Daggers + keys.
    ctx.fillStyle = PALETTE.dagger;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`🗡 ${s.daggers}`, 20, 96);
    ctx.fillStyle = PALETTE.keyGold;
    ctx.fillText(`⚷ ${s.keys}`, 84, 96);

    // Dash cooldown pip.
    const dashReady = s.dashFrac <= 0;
    ctx.fillStyle = dashReady ? '#9a7bff' : '#3d3652';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DASH', 170, 52);
    ctx.fillStyle = '#241d38';
    ctx.fillRect(216, 42, 34, 8);
    ctx.fillStyle = '#9a7bff';
    ctx.fillRect(216, 42, 34 * (1 - Math.max(0, Math.min(1, s.dashFrac))), 8);

    // v3 — class ability pip (Q), mirroring the dash row.
    if (s.ability) {
      const ready = s.ability.frac <= 0;
      ctx.fillStyle = ready ? s.ability.color : '#3d3652';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Q ${s.ability.icon}`, 170, 72);
      ctx.fillStyle = '#241d38';
      ctx.fillRect(216, 62, 34, 8);
      ctx.fillStyle = s.ability.color;
      ctx.fillRect(216, 62, 34 * (1 - Math.max(0, Math.min(1, s.ability.frac))), 8);
    }

    // v3 wave 3 — scroll satchel slot (F to read).
    if (s.scroll) {
      ctx.fillStyle = s.scroll.color;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`F ${s.scroll.icon}`, 216, 96);
    }

    // Combo meter.
    if (s.combo > 1) {
      ctx.fillStyle = PALETTE.emberBright;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`x${s.combo} COMBO`, 140, 96);
      const frac = Math.max(0, s.comboTimer / COMBAT.COMBO_WINDOW);
      ctx.fillStyle = PALETTE.ember;
      ctx.fillRect(140, 102, 100 * frac, 4);
    }

    // v4 — hero level + XP bar row.
    if (s.hero) {
      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`LV ${s.hero.level}`, 20, 116);
      ctx.fillStyle = '#241d38';
      ctx.fillRect(58, 108, 150, 7);
      ctx.fillStyle = s.ability?.color ?? PALETTE.emberBright;
      ctx.fillRect(58, 108, 150 * Math.max(0, Math.min(1, s.hero.xpFrac)), 7);
      ctx.strokeStyle = PALETTE.hudBorder;
      ctx.strokeRect(58.5, 108.5, 150, 7);
    }

    // Buff pips (sit below the XP row when a hero exists).
    const buffY = s.hero ? 122 : 106;
    let bx = 20;
    const buffColors: Record<PotionBuff, string> = {
      haste: PALETTE.potion,
      strength: PALETTE.ember,
      stoneskin: '#9aa5b5',
    };
    for (const [buff, remaining] of s.buffs) {
      ctx.fillStyle = buffColors[buff];
      ctx.fillRect(bx, buffY, 26 * Math.min(1, remaining / PICKUPS.POTION_DURATION), 5);
      ctx.strokeStyle = buffColors[buff];
      ctx.strokeRect(bx + 0.5, buffY + 0.5, 26, 5);
      bx += 32;
    }

    // Relic tally (icons under panel, grows with the run).
    const relicY = s.hero ? 150 : 134;
    let rx = 14;
    ctx.font = '13px monospace';
    for (const [id, count] of s.relics) {
      ctx.fillStyle = RELICS[id].color;
      ctx.fillText(count > 1 ? `${RELICS[id].icon}×${count}` : RELICS[id].icon, rx, relicY);
      rx += count > 1 ? 40 : 22;
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillRect(x, y - 5, 6, 6);
    ctx.fillRect(x + 8, y - 5, 6, 6);
    ctx.fillRect(x + 1, y - 1, 12, 6);
    ctx.fillRect(x + 4, y + 5, 6, 4);
  }

  renderBossBar(
    ctx: CanvasRenderingContext2D,
    name: string,
    hp: number,
    maxHp: number,
    enraged: boolean,
  ): void {
    const w = 400;
    const x = (VIEW.WIDTH - w) / 2;
    const y = VIEW.HEIGHT - 40;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(x - 6, y - 20, w + 12, 36);
    ctx.strokeStyle = enraged ? PALETTE.blood : PALETTE.hudBorder;
    ctx.strokeRect(x - 5.5, y - 19.5, w + 11, 35);
    ctx.fillStyle = PALETTE.textWarm;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(enraged ? `${name} — ENRAGED` : name, VIEW.WIDTH / 2, y - 6);
    ctx.fillStyle = '#3a1408';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = enraged ? PALETTE.blood : PALETTE.ember;
    ctx.fillRect(x, y, w * Math.max(0, hp / maxHp), 10);
  }

  renderBanner(ctx: CanvasRenderingContext2D, text: string, sub: string, timer: number): void {
    const total = OVERLAY.BANNER_FADE_IN + OVERLAY.BANNER_HOLD + OVERLAY.BANNER_FADE_OUT;
    const elapsed = total - timer;
    let alpha = 1;
    if (elapsed < OVERLAY.BANNER_FADE_IN) alpha = elapsed / OVERLAY.BANNER_FADE_IN;
    else if (timer < OVERLAY.BANNER_FADE_OUT) alpha = timer / OVERLAY.BANNER_FADE_OUT;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(5, 3, 8, 0.75)';
    ctx.fillRect(0, 180, VIEW.WIDTH, 110);
    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.WIDTH / 2, 230);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(sub, VIEW.WIDTH / 2, 262);
    ctx.restore();
  }

  /** Floating "buy" prompt above the shop pedestal the player is touching. */
  renderShopPrompt(
    ctx: CanvasRenderingContext2D,
    label: string,
    canAfford: boolean,
    deniedFlash: number,
  ): void {
    const y = VIEW.HEIGHT - 76;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(VIEW.WIDTH / 2 - 170, y - 20, 340, 32);
    ctx.strokeStyle = canAfford ? PALETTE.hudBorder : PALETTE.blood;
    ctx.strokeRect(VIEW.WIDTH / 2 - 169.5, y - 19.5, 339, 31);
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    if (deniedFlash > 0 && Math.floor(deniedFlash * 8) % 2 === 0) {
      ctx.fillStyle = PALETTE.blood;
      ctx.fillText('NOT ENOUGH GOLD', VIEW.WIDTH / 2, y + 1);
    } else {
      ctx.fillStyle = canAfford ? PALETTE.textWarm : PALETTE.textDim;
      ctx.fillText(label, VIEW.WIDTH / 2, y + 1);
    }
  }

  /** v3 — run-start class draft: four hero cards, relic-draft house style. */
  renderClassSelect(
    ctx: CanvasRenderingContext2D,
    ids: readonly ClassId[],
    selectedIndex: number,
    title = 'CHOOSE YOUR HERO',
    subtitle = '← → to browse · SPACE to choose · 1-4 direct',
    heroInfo?: (id: ClassId) => { name: string; level: number } | null,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.82)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW.WIDTH / 2, 104);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px monospace';
    ctx.fillText(subtitle, VIEW.WIDTH / 2, 132);

    const cardW = 168;
    const cardH = 280;
    const gap = 20;
    const startX = (VIEW.WIDTH - cardW * ids.length - gap * (ids.length - 1)) / 2;
    for (let i = 0; i < ids.length; i++) {
      const def = CLASSES[ids[i]];
      const x = startX + i * (cardW + gap);
      const y = 168;
      const selected = i === selectedIndex;

      ctx.fillStyle = selected ? 'rgba(45, 25, 10, 0.95)' : 'rgba(18, 12, 8, 0.95)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = selected ? def.color : '#4d4238';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW, cardH);
      ctx.lineWidth = 1;

      ctx.fillStyle = selected ? def.color : PALETTE.textDim;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y - 10);

      ctx.fillStyle = def.color;
      ctx.font = 'bold 40px monospace';
      ctx.fillText(def.icon, x + cardW / 2, y + 64);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(def.name, x + cardW / 2, y + 100);

      // Hearts row shows the kit's toughness at a glance.
      const hearts = Math.ceil(def.kit.maxHp / 2);
      ctx.fillStyle = PALETTE.heart;
      ctx.font = '13px monospace';
      ctx.fillText('♥'.repeat(hearts).split('').join(' '), x + cardW / 2, y + 124);

      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = '12px monospace';
      this.wrapText(ctx, def.blurb, x + cardW / 2, y + 152, cardW - 20, 15);

      ctx.fillStyle = def.color;
      ctx.font = 'bold 12px monospace';
      this.wrapText(ctx, def.abilityName, x + cardW / 2, y + 212, cardW - 20, 14);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '11px monospace';
      this.wrapText(ctx, def.abilityBlurb, x + cardW / 2, y + 232, cardW - 20, 13);

      // v4.1 — the roster line: this class's persistent hero (or the lack).
      const hero = heroInfo?.(def.id) ?? null;
      ctx.font = 'bold 11px monospace';
      if (hero) {
        ctx.fillStyle = PALETTE.textWarm;
        this.wrapText(ctx, `${hero.name} · LV ${hero.level}`, x + cardW / 2, y + cardH - 12, cardW - 12, 12);
      } else {
        ctx.fillStyle = PALETTE.textDim;
        ctx.fillText('UNPROVEN', x + cardW / 2, y + cardH - 12);
      }
    }
  }

  /** v4 Wave B — the quest board: pick an expedition, confirming departs. */
  renderQuestBoard(
    ctx: CanvasRenderingContext2D,
    ids: readonly QuestId[],
    selectedIndex: number,
    heroLevel: number,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.85)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('THE QUEST BOARD', VIEW.WIDTH / 2, 104);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '13px monospace';
    ctx.fillText('SPACE departs at once · ← → to browse · E steps away', VIEW.WIDTH / 2, 130);

    const cardW = 148;
    const cardH = 300;
    const gap = 8;
    const startX = (VIEW.WIDTH - cardW * ids.length - gap * (ids.length - 1)) / 2;
    for (let i = 0; i < ids.length; i++) {
      const quest = QUESTS[ids[i]];
      const x = startX + i * (cardW + gap);
      const y = 160;
      const selected = i === selectedIndex;
      const under = heroLevel < quest.minLevel;

      ctx.fillStyle = selected ? 'rgba(45, 25, 10, 0.95)' : 'rgba(18, 12, 8, 0.95)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = selected ? PALETTE.emberBright : '#4d4238';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW, cardH);
      ctx.lineWidth = 1;

      ctx.fillStyle = selected ? PALETTE.emberBright : PALETTE.textDim;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y - 8);

      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = 'bold 13px monospace';
      this.wrapText(ctx, quest.name, x + cardW / 2, y + 28, cardW - 14, 16);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '11px monospace';
      this.wrapText(ctx, quest.blurb, x + cardW / 2, y + 76, cardW - 16, 14);

      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(quest.floors > 0 ? `${quest.floors} FLOORS` : 'NO END', x + cardW / 2, y + 170);
      ctx.fillStyle = under ? PALETTE.blood : PALETTE.textDim;
      ctx.fillText(`LEVEL ${quest.minLevel}+`, x + cardW / 2, y + 192);
      if (quest.floors > 0) {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillText(`${quest.rewardGold}g`, x + cardW / 2, y + 226);
        ctx.fillStyle = '#7ae0a8';
        ctx.fillText(`${quest.rewardXp} XP`, x + cardW / 2, y + 246);
      } else {
        ctx.fillStyle = PALETTE.textDim;
        ctx.fillText('GLORY ONLY', x + cardW / 2, y + 226);
      }
    }
  }

  /** v4 Wave B — the blacksmith: permanent gear from banked gold. */
  renderSmith(
    ctx: CanvasRenderingContext2D,
    ids: readonly GearId[],
    selectedIndex: number,
    tierOf: (id: GearId) => number,
    gold: number,
  ): void {
    this.renderShopFrame(ctx, 'THE BLACKSMITH', gold, 'SPACE buys the next tier · E steps away');
    const cardW = 168;
    const cardH = 250;
    const gap = 20;
    const startX = (VIEW.WIDTH - cardW * ids.length - gap * (ids.length - 1)) / 2;
    for (let i = 0; i < ids.length; i++) {
      const gear = GEAR[ids[i]];
      const x = startX + i * (cardW + gap);
      const y = 180;
      const selected = i === selectedIndex;
      const tier = tierOf(gear.id);
      const maxed = tier >= GEAR_TUNING.MAX_TIER;

      this.shopCard(ctx, x, y, cardW, cardH, selected, gear.color, i);
      ctx.fillStyle = gear.color;
      ctx.font = 'bold 38px monospace';
      ctx.fillText(gear.icon, x + cardW / 2, y + 66);
      ctx.font = 'bold 13px monospace';
      this.wrapText(ctx, gear.name, x + cardW / 2, y + 100, cardW - 16, 15);
      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = '11px monospace';
      this.wrapText(ctx, gear.blurb, x + cardW / 2, y + 134, cardW - 20, 14);

      // Tier pips.
      const pipY = y + 186;
      for (let t = 0; t < GEAR_TUNING.MAX_TIER; t++) {
        ctx.fillStyle = t < tier ? gear.color : '#3a3226';
        ctx.fillRect(x + cardW / 2 - 26 + t * 20, pipY, 12, 8);
      }

      ctx.font = 'bold 13px monospace';
      if (maxed) {
        ctx.fillStyle = PALETTE.textDim;
        ctx.fillText('FULLY FORGED', x + cardW / 2, y + cardH - 20);
      } else {
        const price = gear.prices[tier];
        ctx.fillStyle = gold >= price ? PALETTE.gold : PALETTE.blood;
        ctx.fillText(`${price}g`, x + cardW / 2, y + cardH - 20);
      }
    }
  }

  /** v4 Wave B — the alchemist: one-expedition provisions. */
  renderAlchemist(
    ctx: CanvasRenderingContext2D,
    ids: readonly ProvisionId[],
    selectedIndex: number,
    packed: (id: ProvisionId) => boolean,
    gold: number,
  ): void {
    this.renderShopFrame(ctx, 'THE ALCHEMIST', gold, 'SPACE packs it for the next expedition · E steps away');
    const cardW = 190;
    const cardH = 240;
    const gap = 26;
    const startX = (VIEW.WIDTH - cardW * ids.length - gap * (ids.length - 1)) / 2;
    for (let i = 0; i < ids.length; i++) {
      const provision = PROVISIONS[ids[i]];
      const x = startX + i * (cardW + gap);
      const y = 190;
      const selected = i === selectedIndex;

      this.shopCard(ctx, x, y, cardW, cardH, selected, provision.color, i);
      ctx.fillStyle = provision.color;
      ctx.font = 'bold 40px monospace';
      ctx.fillText(provision.icon, x + cardW / 2, y + 70);
      ctx.font = 'bold 14px monospace';
      this.wrapText(ctx, provision.name, x + cardW / 2, y + 106, cardW - 16, 16);
      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = '12px monospace';
      this.wrapText(ctx, provision.blurb, x + cardW / 2, y + 146, cardW - 24, 15);

      ctx.font = 'bold 13px monospace';
      if (packed(provision.id)) {
        ctx.fillStyle = '#7ae0a8';
        ctx.fillText('PACKED', x + cardW / 2, y + cardH - 20);
      } else {
        ctx.fillStyle = gold >= provision.price ? PALETTE.gold : PALETTE.blood;
        ctx.fillText(`${provision.price}g`, x + cardW / 2, y + cardH - 20);
      }
    }
  }

  private renderShopFrame(
    ctx: CanvasRenderingContext2D,
    title: string,
    gold: number,
    hint: string,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.85)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);
    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW.WIDTH / 2, 104);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`BANKED GOLD ${gold}`, VIEW.WIDTH / 2, 132);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '13px monospace';
    ctx.fillText(hint, VIEW.WIDTH / 2, 154);
  }

  private shopCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
    color: string,
    index: number,
  ): void {
    ctx.fillStyle = selected ? 'rgba(45, 25, 10, 0.95)' : 'rgba(18, 12, 8, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = selected ? color : '#4d4238';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.lineWidth = 1;
    ctx.fillStyle = selected ? color : PALETTE.textDim;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${index + 1}]`, x + w / 2, y - 8);
  }

  /** v4 Wave B — quest complete: the run's spoils, banked and safe. */
  renderVictory(
    ctx: CanvasRenderingContext2D,
    questName: string,
    rows: Array<[string, string]>,
    timer: number,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.88)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 44px monospace';
    ctx.fillText('QUEST COMPLETE', VIEW.WIDTH / 2, 130);
    ctx.fillStyle = PALETTE.textWarm;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(questName, VIEW.WIDTH / 2, 168);

    ctx.font = 'bold 16px monospace';
    let y = 240;
    for (const [label, value] of rows) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(label, VIEW.WIDTH / 2 - 16, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = label === 'GOLD BANKED' ? PALETTE.gold : PALETTE.textWarm;
      ctx.fillText(value, VIEW.WIDTH / 2 + 16, y);
      y += 28;
    }

    if (timer > 1.0) {
      const blink = Math.floor(timer * 2) % 2 === 0;
      if (blink) {
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.emberBright;
        ctx.font = 'bold 16px monospace';
        ctx.fillText('PRESS SPACE — LASTLIGHT AWAITS', VIEW.WIDTH / 2, y + 30);
      }
    }
  }

  /** v4 — level-up boon draft: same card language as the relic draft. */
  renderBoonDraft(
    ctx: CanvasRenderingContext2D,
    choices: readonly BoonId[],
    selectedIndex: number,
    ownedCount: (id: BoonId) => number,
    newLevel: number,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.82)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${newLevel}!`, VIEW.WIDTH / 2, 130);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px monospace';
    ctx.fillText('choose your training · ← → · SPACE', VIEW.WIDTH / 2, 158);

    const cardW = 190;
    const cardH = 220;
    const gap = 30;
    const startX = (VIEW.WIDTH - cardW * choices.length - gap * (choices.length - 1)) / 2;
    for (let i = 0; i < choices.length; i++) {
      const boon = BOONS[choices[i]];
      const x = startX + i * (cardW + gap);
      const y = 200;
      const selected = i === selectedIndex;

      ctx.fillStyle = selected ? 'rgba(45, 25, 10, 0.95)' : 'rgba(18, 12, 8, 0.95)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = selected ? boon.color : '#4d4238';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW, cardH);
      ctx.lineWidth = 1;

      ctx.fillStyle = boon.color;
      ctx.font = 'bold 44px monospace';
      ctx.fillText(boon.icon, x + cardW / 2, y + 84);
      ctx.font = 'bold 15px monospace';
      this.wrapText(ctx, boon.name, x + cardW / 2, y + 124, cardW - 20, 18);
      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = '13px monospace';
      this.wrapText(ctx, boon.blurb, x + cardW / 2, y + 162, cardW - 24, 17);

      const owned = ownedCount(boon.id);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12px monospace';
      if (owned > 0) {
        ctx.fillText(`trained ×${owned} of ${boon.maxStacks}`, x + cardW / 2, y + cardH - 14);
      }
      ctx.fillStyle = selected ? boon.color : PALETTE.textDim;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y - 10);
    }
  }

  renderRelicDraft(
    ctx: CanvasRenderingContext2D,
    choices: RelicId[],
    selectedIndex: number,
    ownedCount: (id: RelicId) => number,
  ): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.82)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.fillStyle = PALETTE.emberBright;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE A RELIC', VIEW.WIDTH / 2, 130);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px monospace';
    ctx.fillText('← → to browse · SPACE to claim · then descend', VIEW.WIDTH / 2, 158);

    const cardW = 190;
    const cardH = 220;
    const gap = 30;
    const startX = (VIEW.WIDTH - cardW * 3 - gap * 2) / 2;
    for (let i = 0; i < choices.length; i++) {
      const relic = RELICS[choices[i]];
      const x = startX + i * (cardW + gap);
      const y = 200;
      const selected = i === selectedIndex;

      ctx.fillStyle = selected ? 'rgba(45, 25, 10, 0.95)' : 'rgba(18, 12, 8, 0.95)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = selected ? relic.color : '#4d4238';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cardW, cardH);
      ctx.lineWidth = 1;

      ctx.fillStyle = relic.color;
      ctx.font = 'bold 44px monospace';
      ctx.fillText(relic.icon, x + cardW / 2, y + 84);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(relic.name, x + cardW / 2, y + 130);
      ctx.fillStyle = PALETTE.textWarm;
      ctx.font = '13px monospace';
      this.wrapText(ctx, relic.blurb, x + cardW / 2, y + 158, cardW - 24, 17);

      const owned = ownedCount(relic.id);
      if (owned > 0) {
        ctx.fillStyle = PALETTE.textDim;
        ctx.font = '12px monospace';
        ctx.fillText(`owned ×${owned}`, x + cardW / 2, y + cardH - 14);
      }
      ctx.fillStyle = selected ? relic.color : PALETTE.textDim;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y - 10);
    }
  }

  renderRecap(ctx: CanvasRenderingContext2D, recap: RecapView): void {
    ctx.fillStyle = 'rgba(5, 3, 8, 0.88)';
    ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.blood;
    ctx.font = 'bold 44px monospace';
    ctx.fillText('YOU HAVE FALLEN', VIEW.WIDTH / 2, 120);
    ctx.fillStyle = PALETTE.textWarm;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(recap.causeLabel, VIEW.WIDTH / 2, 156);

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px monospace';
    ctx.fillText(recap.causeHint, VIEW.WIDTH / 2, 186);

    // v4 — the hero endures (or was just retired).
    if (recap.heroLine) {
      ctx.fillStyle = PALETTE.emberBright;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(recap.heroLine, VIEW.WIDTH / 2, 210);
    }

    ctx.font = 'bold 16px monospace';
    let y = 240;
    for (const [label, value] of recap.rows) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.textDim;
      ctx.fillText(label, VIEW.WIDTH / 2 - 16, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = label === 'FINAL SCORE' ? PALETTE.emberBright : PALETTE.textWarm;
      ctx.fillText(value, VIEW.WIDTH / 2 + 16, y);
      y += 28;
    }

    if (recap.timer > OVERLAY.RECAP_INPUT_LOCKOUT) {
      const blink = Math.floor(recap.timer * 2) % 2 === 0;
      if (blink) {
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.emberBright;
        ctx.font = 'bold 16px monospace';
        ctx.fillText('PRESS SPACE', VIEW.WIDTH / 2, y + 24);
      }

      // v4 — hold-to-retire affordance with a fill bar.
      if (recap.retireFrac !== undefined) {
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.textDim;
        ctx.font = '12px monospace';
        ctx.fillText('HOLD R TO RETIRE YOUR HERO', VIEW.WIDTH / 2, y + 50);
        if (recap.retireFrac > 0) {
          ctx.fillStyle = '#241d38';
          ctx.fillRect(VIEW.WIDTH / 2 - 80, y + 58, 160, 6);
          ctx.fillStyle = PALETTE.blood;
          ctx.fillRect(
            VIEW.WIDTH / 2 - 80,
            y + 58,
            160 * Math.max(0, Math.min(1, recap.retireFrac)),
            6,
          );
        }
      }
    }
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): void {
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (const word of words) {
      const candidate = line.length > 0 ? `${line} ${word}` : word;
      if (ctx.measureText && ctx.measureText(candidate).width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = candidate;
      }
    }
    if (line.length > 0) ctx.fillText(line, x, cursorY);
  }
}
