// ===== src/games/runner/systems/HudRenderer.ts =====
//
// Every pixel of chrome the runner draws. It lives apart from RunnerGame for
// two reasons: the game file was already the largest in the folder, and the
// HUD is the one part of a game that has to obey the arcade's design system
// rather than the game's own art direction.
//
// Palette and type are taken from the @theme block in src/app/globals.css
// (see DOCS/UI-DESIGN-SYSTEM-HANDOFF.md): a dark neutral ramp, amber ALWAYS
// meaning currency, emerald meaning earned, red meaning a problem, and the
// stage accent used only to tint the frame the run is currently in.

import { PowerUpType, powerUpStyle } from '../entities/PowerUp';

/** Design tokens, mirrored from globals.css so canvas can use them. */
export const UI = {
  canvasDeep: '#06070a',
  surface: 'rgba(16, 18, 25, 0.82)',
  surfaceSolid: '#101219',
  line: 'rgba(255, 255, 255, 0.10)',
  lineStrong: 'rgba(255, 255, 255, 0.18)',
  ink: '#edeff5',
  inkMuted: '#a2a9b8',
  inkFaint: '#6d7484',
  brand: '#7c6bff',
  brandBright: '#9182ff',
  coin: '#f0b429',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
} as const;

/**
 * next/font exposes the real family name through a CSS variable. Canvas can
 * not read a CSS var inside a font string, so resolve it once here and keep a
 * plain system fallback for jsdom and for the frames before the font loads.
 */
function resolveFamily(variable: string, fallback: string): string {
  try {
    if (typeof document === 'undefined') return fallback;
    // layout.tsx puts the next/font variables on <body>, not on <html>, so
    // read the body first and only fall back to the root element.
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const value = getComputedStyle(el).getPropertyValue(variable).trim();
      if (value) return `${value}, ${fallback}`;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

let displayFamily: string | null = null;
let sansFamily_: string | null = null;
let monoFamily: string | null = null;

/** Orbitron: the wordmark and big numerals only. */
export function displayFont(size: number, weight = 700): string {
  if (displayFamily === null) {
    displayFamily = resolveFamily('--font-orbitron', 'system-ui, sans-serif');
  }
  return `${weight} ${size}px ${displayFamily}`;
}

/** Inter: everything the player reads as prose. */
export function sansFont(size: number, weight = 600): string {
  return `${weight} ${size}px ${sansFamily()}`;
}

/** The resolved Inter family on its own, for callers that build their own
 *  font strings (the score popups draw in the game layer, not the HUD). */
export function sansFamily(): string {
  if (sansFamily_ === null) {
    sansFamily_ = resolveFamily('--font-inter', 'system-ui, sans-serif');
  }
  return sansFamily_;
}

/** JetBrains Mono: anything the player reads as a value. */
export function monoFont(size: number, weight = 600): string {
  if (monoFamily === null) {
    monoFamily = resolveFamily('--font-jetbrains-mono', 'ui-monospace, monospace');
  }
  return `${weight} ${size}px ${monoFamily}`;
}

export interface BossHudState {
  name: string;
  number: number;
  health: number;
  maxHealth: number;
  phase: string;
  /** True during the post-attack window when it can be stomped. */
  exposed: boolean;
  glowColor: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface ActivePowerUpState {
  type: PowerUpType;
  duration: number;
  maxDuration: number;
}

export interface HudState {
  score: number;
  coins: number;
  lives: number;
  maxLives: number;
  distance: number;
  speed: number;
  combo: number;
  comboTimeLeft: number;
  comboTimeLimit: number;
  comboMultiplier: number;
  comboScale: number;
  powerUps: ActivePowerUpState[];
  eventMeter: number;
  eventThreshold: number;
  activeEvent: 'none' | 'coin-shower' | 'speed-zone';
  eventTimeLeft: number;
  eventDuration: number;
  boss: BossHudState | null;
  /** Metres until the boss arrives, or null when that is not imminent. */
  bossIn: number | null;
  /** Live near-miss chain, and how much of its window is left. */
  grazeStreak: number;
  grazeWindowLeft: number;
  /** Progress through the stage toward its boss, 0-1. */
  stageProgress: number;
  /** Metres run since the last hit, for the clean-run readout. */
  cleanDistance: number;
  /** A first-encounter card for a stage feature, or null. */
  hint: { title: string; body: string; alpha: number } | null;
  stageName: string;
  stageNumber: number;
  accent: string;
  /** 0-1 fade for the "stage begins" banner. */
  stageBanner: number;
  invulnerable: boolean;
}

export class HudRenderer {
  private width: number;
  private height: number;
  private time = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  update(dt: number): void {
    this.time += dt;
  }

  // ======================================================== in-run HUD ====

  renderPlaying(
    ctx: CanvasRenderingContext2D,
    s: HudState,
    showEventStrip = true
  ): void {
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    this.renderStageTrack(ctx, s);
    this.renderScoreCluster(ctx, s);
    this.renderRunStats(ctx, s);
    if (s.combo > 1) this.renderCombo(ctx, s);
    this.renderPowerUps(ctx, s);
    // Special events cannot fire during the tutorial, so the meter is noise
    // while the player is still learning the three moves.
    if (showEventStrip) this.renderEventStrip(ctx, s);
    if (s.boss) this.renderBossBar(ctx, s.boss);
    else if (s.bossIn !== null) this.renderBossWarning(ctx, s);
    this.renderStageChip(ctx, s);
    if (s.stageBanner > 0) this.renderStageBanner(ctx, s);
    if (s.hint) this.renderFeatureHint(ctx, s);

    ctx.restore();
  }

  /**
   * A hairline across the very top: how far through the stage the run is, and
   * therefore how close the boss is. An endless runner with no visible
   * structure feels like it is going nowhere; this is the cheapest possible
   * way to give every stage a beginning, a middle and an end.
   */
  private renderStageTrack(ctx: CanvasRenderingContext2D, s: HudState): void {
    const h = 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(0, 0, this.width, h);

    if (s.boss) {
      // In the fight: the whole track burns, so the bar reads as "this is the
      // end of the stage" rather than as stalled progress.
      const pulse = 0.55 + Math.abs(Math.sin(this.time * 6)) * 0.45;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = UI.bad;
      ctx.fillRect(0, 0, this.width, h);
      ctx.globalAlpha = 1;
      return;
    }

    const t = Math.max(0, Math.min(1, s.stageProgress));
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, 0, this.width * t, h);

    // A marker at the head of the fill, so slow progress is still visible.
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(Math.max(0, this.width * t - 2), 0, 2, h);
    ctx.globalAlpha = 1;
  }

  /**
   * The first time a run meets a stage feature, say what it is for. These
   * mechanics are only readable if the player is told once — after that the
   * shape of the thing is the instruction.
   */
  private renderFeatureHint(ctx: CanvasRenderingContext2D, s: HudState): void {
    if (!s.hint) return;
    const cx = this.width / 2;
    const y = 158;
    const w = 300;

    ctx.save();
    ctx.globalAlpha = s.hint.alpha;
    this.panel(ctx, cx - w / 2, y, w, 58, 10, 0.92);

    ctx.textAlign = 'center';
    ctx.fillStyle = s.accent;
    ctx.font = displayFont(15);
    ctx.fillText(s.hint.title, cx, y + 24);

    ctx.fillStyle = UI.ink;
    ctx.font = sansFont(12, 500);
    ctx.fillText(s.hint.body, cx, y + 44);
    ctx.restore();
  }

  /** Top left: what the run is worth. */
  private renderScoreCluster(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = 18;
    const y = 16;
    const w = 186;

    // Tall enough to hold the clean-run line: at h = 80 it spilled out of the
    // panel and landed behind the event meter below.
    this.panel(ctx, x, y, w, 98);

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(9, 700);
    this.tracked(ctx, 'SCORE', x + 12, y + 19, 1.4);

    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(24);
    ctx.fillText(String(s.score).padStart(5, '0'), x + 12, y + 46);

    // Lives on the left of the footer row, coins on the right.
    this.renderLives(ctx, x + 18, y + 66, s);

    // Distance since the last hit. Only shown once it is worth protecting,
    // so it arrives as a reward rather than as another number to ignore.
    if (s.cleanDistance >= 250) {
      ctx.textAlign = 'left';
      ctx.fillStyle = UI.good;
      ctx.font = monoFont(10, 700);
      ctx.fillText(`CLEAN ${Math.floor(s.cleanDistance)}m`, x + 12, y + 88);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = UI.coin;
    ctx.font = monoFont(15, 700);
    ctx.fillText(String(s.coins), x + w - 12, y + 70);
    // Currency is always amber — it never borrows another colour.
    this.coinGlyph(ctx, x + w - 24 - ctx.measureText(String(s.coins)).width, y + 65, 7);
    ctx.textAlign = 'left';
  }

  /** Lives as chevrons: full ones in the stage accent, spent ones hollow. */
  private renderLives(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: HudState
  ): void {
    for (let i = 0; i < s.maxLives; i++) {
      const cx = x + i * 17;
      const alive = i < s.lives;
      // The last life pulses, and the whole row flashes while invulnerable.
      const pulse =
        alive && i === s.lives - 1 && s.lives === 1
          ? 0.55 + Math.abs(Math.sin(this.time * 6)) * 0.45
          : 1;

      ctx.save();
      ctx.globalAlpha = s.invulnerable && alive ? 0.4 + pulse * 0.3 : pulse;
      ctx.beginPath();
      ctx.moveTo(cx, y - 8);
      ctx.lineTo(cx + 6, y - 1);
      ctx.lineTo(cx, y + 3);
      ctx.lineTo(cx - 6, y - 1);
      ctx.closePath();
      if (alive) {
        ctx.fillStyle = s.lives === 1 ? UI.bad : s.accent;
        ctx.fill();
      } else {
        ctx.strokeStyle = UI.lineStrong;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Top right: how far and how fast. */
  private renderRunStats(ctx: CanvasRenderingContext2D, s: HudState): void {
    const right = this.width - 18;

    this.panel(ctx, right - 150, 16, 150, 56);

    ctx.textAlign = 'right';
    ctx.fillStyle = UI.ink;
    ctx.font = monoFont(19, 700);
    ctx.fillText(`${Math.floor(s.distance)}`, right - 26, 40);
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(11, 700);
    ctx.fillText('M', right - 12, 40);

    // Speed reads as a threat as it climbs, so it warms up with the number.
    const heat = Math.min(1, Math.max(0, (s.speed - 1) / 3));
    ctx.fillStyle = this.mix(UI.inkMuted, UI.warn, heat);
    ctx.font = monoFont(11, 700);
    ctx.fillText(`${s.speed.toFixed(1)}x SPEED`, right - 12, 58);

    // A thin speed rail, so acceleration is visible and not just numeric.
    const railW = 126;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(right - railW - 12, 64, railW, 3);
    ctx.fillStyle = this.mix(UI.good, UI.bad, heat);
    ctx.fillRect(right - railW - 12, 64, railW * heat, 3);
  }

  private renderCombo(ctx: CanvasRenderingContext2D, s: HudState): void {
    const right = this.width - 18;
    const w = 150;
    const x = right - w;
    const y = 80;

    this.panel(ctx, x, y, w, 50);

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(9, 700);
    this.tracked(ctx, 'COMBO', x + 12, y + 20, 1.4);

    // The number pops on a milestone; the label under it stays put.
    ctx.save();
    ctx.textAlign = 'right';
    ctx.translate(right - 12, y + 24);
    ctx.scale(s.comboScale, s.comboScale);
    ctx.fillStyle = UI.warn;
    ctx.font = displayFont(22);
    ctx.fillText(`${s.combo}x`, 0, 0);
    ctx.restore();

    // The multiplier is the part that actually pays, so it is named.
    if (s.comboMultiplier > 1) {
      ctx.textAlign = 'left';
      ctx.fillStyle = UI.coin;
      ctx.font = monoFont(10, 700);
      ctx.fillText(`COINS x${s.comboMultiplier}`, x + 12, y + 38);
    }

    // Drain bar rides the bottom edge of the panel.
    const barW = w - 2;
    const t = Math.max(0, Math.min(1, s.comboTimeLeft / s.comboTimeLimit));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 1, y + 45, barW, 3);
    ctx.fillStyle = t < 0.3 ? UI.bad : UI.warn;
    ctx.fillRect(x + 1, y + 45, barW * t, 3);
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D, s: HudState): void {
    if (s.powerUps.length === 0) return;
    const right = this.width - 18;
    let y = s.combo > 1 ? 140 : 82;

    for (const p of s.powerUps) {
      const style = powerUpStyle(p.type);
      const w = 150;
      const x = right - w;
      const t = Math.max(0, Math.min(1, p.duration / p.maxDuration));

      this.panel(ctx, x, y, w, 26, 6);

      // A colour dot rather than an icon: at 26px tall an icon is mush.
      ctx.fillStyle = style.core;
      ctx.beginPath();
      ctx.arc(x + 15, y + 13, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = UI.ink;
      ctx.font = sansFont(11, 600);
      ctx.fillText(style.label, x + 27, y + 17);

      ctx.textAlign = 'right';
      // Blink the clock once it is nearly out.
      ctx.fillStyle = p.duration < 2 && Math.sin(this.time * 12) < 0 ? UI.bad : UI.inkMuted;
      ctx.font = monoFont(11, 700);
      ctx.fillText(`${Math.ceil(p.duration)}s`, x + w - 10, y + 17);

      // The bar rides the bottom edge of the chip.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(x + 1, y + 23, w - 2, 2);
      ctx.fillStyle = style.core;
      ctx.fillRect(x + 1, y + 23, (w - 2) * t, 2);

      y += 31;
    }
  }

  /** Bottom left: the charge toward a special event, or the event running. */
  private renderEventStrip(ctx: CanvasRenderingContext2D, s: HudState): void {
    // Top left under the score block: the bottom-left corner is where the
    // runner actually stands, and a panel there covers them.
    const x = 30;
    const y = 144;
    const barW = 168;

    this.panel(ctx, 18, y - 22, 186, 46, 8);

    if (s.activeEvent === 'none') {
      const t = Math.max(0, Math.min(1, s.eventMeter / s.eventThreshold));
      ctx.textAlign = 'left';
      ctx.fillStyle = UI.inkFaint;
      ctx.font = sansFont(9, 700);
      this.tracked(ctx, 'EVENT CHARGE', x, y, 1.3);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x, y + 6, barW, 5);
      const fill = ctx.createLinearGradient(x, 0, x + barW, 0);
      fill.addColorStop(0, UI.brand);
      fill.addColorStop(1, UI.coin);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y + 6, barW * t, 5);

      // A live near-miss chain shares this panel, because grazing is the
      // other way to charge it. When one is running it is the more urgent
      // number, so it takes the slot.
      ctx.textAlign = 'right';
      if (s.grazeStreak > 1) {
        ctx.fillStyle = '#7dd3fc';
        ctx.font = monoFont(10, 700);
        ctx.fillText(`NEAR MISS x${s.grazeStreak}`, x + barW, y);
      } else if (t > 0.75) {
        // Nearly full: the player's cue to keep the chain going.
        ctx.fillStyle = UI.coin;
        ctx.font = monoFont(10, 700);
        ctx.fillText('READY SOON', x + barW, y);
      }
      return;
    }

    const isShower = s.activeEvent === 'coin-shower';
    const color = isShower ? UI.coin : UI.brandBright;
    const label = isShower ? 'COIN SHOWER' : 'SPEED ZONE';
    const t = Math.max(0, Math.min(1, s.eventTimeLeft / s.eventDuration));

    // The banner pulses so it cannot be missed during a busy screen.
    const pulse = 0.72 + Math.abs(Math.sin(this.time * 5)) * 0.28;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    ctx.fillRect(x - 6, y - 14, 4, 28);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = displayFont(14);
    ctx.fillText(label, x + 6, y - 1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x + 6, y + 7, barW - 24, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 6, y + 7, (barW - 24) * t, 4);
  }

  private renderStageChip(ctx: CanvasRenderingContext2D, s: HudState): void {
    const y = this.height - 24;

    ctx.textAlign = 'left';
    ctx.font = sansFont(10, 600);
    const label = s.stageName.toUpperCase();
    const w = ctx.measureText(label).width + 84;
    const x = this.width - 18 - w;

    this.panel(ctx, x, y - 14, w, 20, 6, 0.6);

    ctx.fillStyle = s.accent;
    ctx.font = monoFont(10, 700);
    ctx.fillText(`STAGE ${s.stageNumber}`, x + 10, y);

    ctx.fillStyle = UI.inkMuted;
    ctx.font = sansFont(10, 600);
    ctx.fillText(label, x + 72, y);
  }

  /** The card that announces a new stage, fading in and out over a few seconds. */
  private renderStageBanner(ctx: CanvasRenderingContext2D, s: HudState): void {
    const alpha = s.stageBanner;
    const cx = this.width / 2;
    const y = 132;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';

    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(11, 700);
    this.trackedCenter(ctx, `STAGE ${s.stageNumber}`, cx, y - 26, 3);

    ctx.fillStyle = s.accent;
    ctx.font = displayFont(30);
    ctx.fillText(s.stageName.toUpperCase(), cx, y + 6);

    // A rule that draws itself out as the banner appears.
    const ruleW = 150 * alpha;
    ctx.fillStyle = s.accent;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillRect(cx - ruleW / 2, y + 18, ruleW, 2);
    ctx.restore();
  }

  // ------------------------------------------------------------- the boss --

  private renderBossBar(ctx: CanvasRenderingContext2D, boss: BossHudState): void {
    const cx = this.width / 2;
    const barW = 320;
    const barH = 16;
    const x = cx - barW / 2;
    const y = 44;
    const pct = Math.max(0, boss.health / boss.maxHealth);
    const raging = boss.phase === 'rage';

    ctx.textAlign = 'center';

    // Name plate. The tag sits above the name, not beside it — side by side
    // they collided the moment a boss had a long name.
    ctx.fillStyle = UI.inkFaint;
    ctx.font = monoFont(9, 700);
    this.trackedCenter(ctx, `BOSS ${boss.number}`, cx, y - 28, 2);

    ctx.fillStyle = boss.glowColor;
    ctx.font = displayFont(17);
    ctx.fillText(boss.name.toUpperCase(), cx, y - 9);

    // Track.
    ctx.fillStyle = 'rgba(6, 7, 10, 0.85)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y, barW, barH);

    // Fill.
    const fill = ctx.createLinearGradient(x, 0, x + barW, 0);
    if (raging) {
      const pulse = 0.6 + Math.abs(Math.sin(this.time * 9)) * 0.4;
      fill.addColorStop(0, `rgba(248, 113, 113, ${pulse})`);
      fill.addColorStop(1, '#dc2626');
    } else {
      fill.addColorStop(0, boss.primaryColor);
      fill.addColorStop(1, boss.secondaryColor);
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, barW * pct, barH);

    // Hit pips: one notch per point of health, so a stomp reads as progress.
    if (boss.maxHealth <= 30) {
      ctx.strokeStyle = 'rgba(6, 7, 10, 0.55)';
      ctx.lineWidth = 1;
      for (let i = 1; i < boss.maxHealth; i++) {
        const nx = x + (barW / boss.maxHealth) * i;
        ctx.beginPath();
        ctx.moveTo(nx, y);
        ctx.lineTo(nx, y + barH);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = raging ? UI.bad : boss.glowColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);

    ctx.fillStyle = UI.ink;
    ctx.font = monoFont(11, 700);
    ctx.fillText(`${boss.health} / ${boss.maxHealth}`, cx, y + barH + 14);

    if (boss.exposed) {
      // The opening is the most urgent thing on screen while it lasts.
      const pulse = 0.6 + Math.abs(Math.sin(this.time * 10)) * 0.4;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = UI.good;
      ctx.font = displayFont(12);
      this.trackedCenter(ctx, 'OPENING — STRIKE NOW', cx, y + barH + 28, 2.5);
      ctx.globalAlpha = 1;
    } else if (raging) {
      ctx.fillStyle = UI.bad;
      ctx.font = displayFont(11);
      this.trackedCenter(ctx, 'ENRAGED', cx, y + barH + 28, 3);
    } else if (boss.phase === 'intro') {
      ctx.fillStyle = UI.warn;
      ctx.font = displayFont(11);
      this.trackedCenter(ctx, 'INCOMING', cx, y + barH + 28, 3);
    } else {
      // The one instruction that matters, for anyone meeting a boss cold.
      ctx.fillStyle = UI.inkFaint;
      ctx.font = sansFont(11, 600);
      ctx.fillText('Dodge its attack, then land on it from above', cx, y + barH + 28);
    }
  }

  private renderBossWarning(ctx: CanvasRenderingContext2D, s: HudState): void {
    if (s.bossIn === null) return;
    const cx = this.width / 2;
    const pulse = 0.65 + Math.abs(Math.sin(this.time * 6)) * 0.35;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';

    const label = `BOSS IN ${Math.max(0, Math.floor(s.bossIn))}M`;
    ctx.font = displayFont(15);
    const w = ctx.measureText(label).width + 40;

    ctx.fillStyle = 'rgba(120, 20, 20, 0.85)';
    ctx.fillRect(cx - w / 2, 22, w, 28);
    ctx.fillStyle = UI.bad;
    ctx.fillRect(cx - w / 2, 22, w, 2);
    ctx.fillRect(cx - w / 2, 48, w, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, cx, 42);
    ctx.restore();
  }

  // ========================================================== full screens ==

  /** Scrim used by every full-screen state, so they feel like one family. */
  private scrim(ctx: CanvasRenderingContext2D, strength = 0.82): void {
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, `rgba(6, 7, 10, ${strength})`);
    g.addColorStop(0.5, `rgba(6, 7, 10, ${Math.min(1, strength + 0.1)})`);
    g.addColorStop(1, `rgba(6, 7, 10, ${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  renderMenu(
    ctx: CanvasRenderingContext2D,
    selection: 'play' | 'tutorial',
    best: number | null
  ): void {
    ctx.save();
    this.scrim(ctx, 0.78);
    const cx = this.width / 2;

    // Wordmark.
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(12, 700);
    this.trackedCenter(ctx, 'HACKTIVATE ARCADE', cx, 96, 5);

    // A soft glow behind the title so it lifts off the scene behind it.
    const glow = ctx.createRadialGradient(cx, 146, 10, cx, 146, 260);
    glow.addColorStop(0, 'rgba(124, 107, 255, 0.35)');
    glow.addColorStop(1, 'rgba(124, 107, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 280, 40, 560, 220);

    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(46);
    ctx.fillText('ENDLESS', cx, 156);
    ctx.fillStyle = UI.brandBright;
    ctx.fillText('RUNNER', cx, 204);

    ctx.fillStyle = UI.inkMuted;
    ctx.font = sansFont(14, 500);
    ctx.fillText(
      'Five stages. Five bosses. One long sprint.',
      cx,
      236
    );

    // Options.
    const items: { id: 'play' | 'tutorial'; label: string; hint: string }[] = [
      { id: 'play', label: 'START RUN', hint: 'Jump straight in' },
      { id: 'tutorial', label: 'HOW TO PLAY', hint: 'Learn the three moves' },
    ];

    items.forEach((item, i) => {
      const y = 288 + i * 76;
      const active = selection === item.id;
      const w = 300;
      const x = cx - w / 2;

      if (active) {
        // The selected row gets the brand; nothing else in the menu does.
        const pulse = 0.85 + Math.abs(Math.sin(this.time * 3)) * 0.15;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = UI.brand;
        ctx.fillRect(x, y - 26, w, 56);
        ctx.globalAlpha = 1;
        ctx.fillStyle = UI.brandBright;
        ctx.fillRect(x, y - 26, 4, 56);
      } else {
        this.panel(ctx, x, y - 26, w, 56, 8);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = active ? '#FFFFFF' : UI.ink;
      ctx.font = displayFont(18);
      ctx.fillText(item.label, x + 22, y - 2);

      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.75)' : UI.inkFaint;
      ctx.font = sansFont(11, 500);
      ctx.fillText(item.hint, x + 22, y + 16);

      if (active) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = displayFont(16);
        ctx.fillText('>', x + w - 20, y + 2);
      }
    });

    // Best score, when there is one to beat.
    if (best !== null && best > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = UI.inkFaint;
      ctx.font = sansFont(10, 700);
      this.trackedCenter(ctx, 'BEST THIS SESSION', cx, 456, 2.5);
      ctx.fillStyle = UI.coin;
      ctx.font = monoFont(18, 700);
      ctx.fillText(String(best), cx, 480);
    }

    // Controls.
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(11, 500);
    ctx.fillText(
      'UP / DOWN to choose     SPACE to confirm',
      cx,
      this.height - 28
    );

    ctx.restore();
  }

  renderTutorial(
    ctx: CanvasRenderingContext2D,
    step: number,
    done: number,
    needed: number
  ): void {
    const steps = [
      {
        title: 'JUMP',
        body: 'Tap SPACE to jump. Hold it longer to jump higher.',
        unit: 'jumps',
      },
      {
        title: 'SLIDE',
        body: 'Hold DOWN to slide under the hanging barriers.',
        unit: 'slides',
      },
      {
        title: 'COLLECT',
        body: 'Grab coins without a break to build a combo multiplier.',
        unit: 'coins',
      },
      { title: 'READY', body: 'That is everything. Good luck out there.', unit: '' },
    ];
    const current = steps[Math.min(step, steps.length - 1)];
    const cx = this.width / 2;
    const w = 420;
    const x = cx - w / 2;
    // Below the left-hand HUD panels, not across them: at y = 74 the card's
    // left edge clipped the score block.
    const y = 162;

    ctx.save();
    this.panel(ctx, x, y, w, 96, 10, 0.92);

    // Step dots along the top edge.
    for (let i = 0; i < 3; i++) {
      const dx = x + 18 + i * 14;
      ctx.beginPath();
      ctx.arc(dx, y + 16, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < step ? UI.good : i === step ? UI.brandBright : UI.lineStrong;
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = step >= 3 ? UI.good : UI.brandBright;
    ctx.font = displayFont(18);
    ctx.fillText(current.title, x + 18, y + 46);

    ctx.fillStyle = UI.ink;
    ctx.font = sansFont(13, 500);
    ctx.fillText(current.body, x + 18, y + 68);

    if (current.unit) {
      // Progress toward the step, as pips rather than a fraction.
      ctx.textAlign = 'right';
      ctx.fillStyle = UI.inkFaint;
      ctx.font = monoFont(11, 700);
      ctx.fillText(`${done} / ${needed} ${current.unit}`, x + w - 18, y + 46);

      const pipW = 14;
      for (let i = 0; i < needed; i++) {
        const px = x + w - 18 - (needed - i) * (pipW + 4);
        ctx.fillStyle = i < done ? UI.good : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(px, y + 58, pipW, 5);
      }
    }
    ctx.restore();
  }

  renderBossVictory(
    ctx: CanvasRenderingContext2D,
    bossesDefeated: number,
    bonusCoins: number,
    nextStage: string,
    accent: string,
    secondsLeft: number,
    totalSeconds: number
  ): void {
    ctx.save();
    this.scrim(ctx, 0.8);
    const cx = this.width / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = UI.good;
    ctx.font = sansFont(12, 700);
    this.trackedCenter(ctx, 'BOSS DOWN', cx, 176, 5);

    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(40);
    ctx.fillText('STAGE CLEAR', cx, 230);

    // Two reward tiles, on the same grid as the recap.
    const tiles: [string, string, string][] = [
      ['BOSSES BEATEN', String(bossesDefeated), UI.ink],
      ['BONUS COINS', `+${bonusCoins}`, UI.coin],
    ];
    tiles.forEach(([label, value, color], i) => {
      const w = 160;
      const x = cx - 168 + i * 176;
      this.panel(ctx, x, 262, w, 66, 8);
      ctx.textAlign = 'center';
      ctx.fillStyle = UI.inkFaint;
      ctx.font = sansFont(9, 700);
      this.trackedCenter(ctx, label, x + w / 2, 284, 1.5);
      ctx.fillStyle = color;
      ctx.font = displayFont(24);
      ctx.fillText(value, x + w / 2, 314);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(11, 600);
    ctx.fillText('NEXT STAGE', cx, 372);
    ctx.fillStyle = accent;
    ctx.font = displayFont(22);
    ctx.fillText(nextStage.toUpperCase(), cx, 402);

    // Countdown rail.
    const railW = 220;
    const t = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(cx - railW / 2, 424, railW, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - railW / 2, 424, railW * t, 4);

    ctx.restore();
  }

  renderRecap(
    ctx: CanvasRenderingContext2D,
    stats: { label: string; value: string; highlight?: boolean }[],
    score: number,
    grade: { letter: string; color: string; caption: string },
    isNewBest: boolean
  ): void {
    ctx.save();
    this.scrim(ctx, 0.88);
    const cx = this.width / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = UI.bad;
    ctx.font = sansFont(12, 700);
    this.trackedCenter(ctx, 'RUN OVER', cx, 56, 5);

    // Score and grade share the top row: the number, then the judgement.
    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(52);
    ctx.fillText(String(score), cx - 54, 116);
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(10, 700);
    this.trackedCenter(ctx, 'FINAL SCORE', cx - 54, 136, 2);

    // Grade badge.
    const gx = cx + 96;
    ctx.beginPath();
    ctx.arc(gx, 100, 38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = grade.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = grade.color;
    ctx.font = displayFont(36);
    ctx.fillText(grade.letter, gx, 113);
    ctx.fillStyle = UI.inkMuted;
    ctx.font = sansFont(10, 600);
    ctx.fillText(grade.caption, gx, 152);

    if (isNewBest) {
      ctx.fillStyle = UI.coin;
      ctx.font = displayFont(13);
      this.trackedCenter(ctx, 'NEW SESSION BEST', cx, 176, 3);
    }

    // Stat grid: four columns across two rows, centred in the space the
    // header leaves. Three columns left the bottom third of the screen empty.
    const cols = 4;
    const cellW = 178;
    const cellH = 74;
    const rows = Math.ceil(stats.length / cols);
    const gridX = cx - (cols * cellW) / 2;
    const gridY = (this.height - rows * (cellH + 12)) / 2 + 66;

    stats.forEach((stat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridX + col * cellW;
      const y = gridY + row * (cellH + 12);

      this.panel(ctx, x + 6, y, cellW - 12, cellH, 8);

      ctx.textAlign = 'left';
      ctx.fillStyle = UI.inkFaint;
      ctx.font = sansFont(9, 700);
      this.tracked(ctx, stat.label.toUpperCase(), x + 20, y + 24, 1.4);

      ctx.fillStyle = stat.highlight ? UI.coin : UI.ink;
      ctx.font = monoFont(21, 700);
      ctx.fillText(stat.value, x + 20, y + 54);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = UI.inkFaint;
    ctx.font = sansFont(12, 500);
    ctx.fillText('Press SPACE to continue', cx, this.height - 30);

    ctx.restore();
  }

  // =============================================================== atoms ===

  private panel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r = 10,
    alpha = 0.72
  ): void {
    ctx.save();
    ctx.fillStyle = `rgba(16, 18, 25, ${alpha})`;
    this.roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = UI.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  private coinGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number
  ): void {
    ctx.save();
    ctx.fillStyle = UI.coin;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Canvas has no letter-spacing, so tracked text is drawn glyph by glyph. */
  private tracked(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    spacing: number
  ): void {
    let cursor = x;
    for (const ch of text) {
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + spacing;
    }
  }

  private trackedWidth(
    ctx: CanvasRenderingContext2D,
    text: string,
    spacing: number
  ): number {
    let total = 0;
    for (const ch of text) total += ctx.measureText(ch).width + spacing;
    return Math.max(0, total - spacing);
  }

  private trackedCenter(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    y: number,
    spacing: number
  ): void {
    const align = ctx.textAlign;
    ctx.textAlign = 'left';
    this.tracked(ctx, text, cx - this.trackedWidth(ctx, text, spacing) / 2, y, spacing);
    ctx.textAlign = align;
  }

  private trackedRight(
    ctx: CanvasRenderingContext2D,
    text: string,
    right: number,
    y: number,
    spacing: number
  ): void {
    const align = ctx.textAlign;
    ctx.textAlign = 'left';
    this.tracked(ctx, text, right - this.trackedWidth(ctx, text, spacing), y, spacing);
    ctx.textAlign = align;
  }

  /** Blend two hex colours, for values that heat up as they climb. */
  private mix(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = Math.round((pa >> 16) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    const g = Math.round(
      ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t)
    );
    const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
    return `rgb(${r}, ${g}, ${bl})`;
  }
}
