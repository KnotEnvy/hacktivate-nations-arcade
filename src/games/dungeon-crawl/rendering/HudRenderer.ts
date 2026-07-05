// ===== src/games/dungeon-crawl/rendering/HudRenderer.ts =====
// v2 — all screen-space chrome extracted from DungeonCrawlGame: HUD panel,
// boss bar, floor banners, the relic draft, shop prompts and the death recap.
// Pure rendering: the game passes explicit view state, nothing reaches back.

import { COMBAT, OVERLAY, PALETTE, PICKUPS, PotionBuff, VIEW } from '../data/constants';
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
  buffs: ReadonlyMap<PotionBuff, number>;
  relics: ReadonlyMap<RelicId, number>;
}

export interface RecapView {
  causeLabel: string;
  causeHint: string;
  rows: Array<[string, string]>;
  timer: number;
}

export class HudRenderer {
  renderHud(ctx: CanvasRenderingContext2D, s: HudState): void {
    // Panel.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(10, 10, 250, 108);
    ctx.strokeStyle = PALETTE.hudBorder;
    ctx.strokeRect(10.5, 10.5, 250, 108);

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

    // Combo meter.
    if (s.combo > 1) {
      ctx.fillStyle = PALETTE.emberBright;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`x${s.combo} COMBO`, 140, 96);
      const frac = Math.max(0, s.comboTimer / COMBAT.COMBO_WINDOW);
      ctx.fillStyle = PALETTE.ember;
      ctx.fillRect(140, 102, 100 * frac, 4);
    }

    // Buff pips.
    let bx = 20;
    const buffColors: Record<PotionBuff, string> = {
      haste: PALETTE.potion,
      strength: PALETTE.ember,
      stoneskin: '#9aa5b5',
    };
    for (const [buff, remaining] of s.buffs) {
      ctx.fillStyle = buffColors[buff];
      ctx.fillRect(bx, 106, 26 * Math.min(1, remaining / PICKUPS.POTION_DURATION), 5);
      ctx.strokeStyle = buffColors[buff];
      ctx.strokeRect(bx + 0.5, 106.5, 26, 5);
      bx += 32;
    }

    // Relic tally (icons under panel, grows with the run).
    let rx = 14;
    ctx.font = '13px monospace';
    for (const [id, count] of s.relics) {
      ctx.fillStyle = RELICS[id].color;
      ctx.fillText(count > 1 ? `${RELICS[id].icon}×${count}` : RELICS[id].icon, rx, 134);
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
