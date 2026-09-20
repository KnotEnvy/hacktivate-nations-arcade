// ===== src/games/runner/systems/ScorePopups.ts =====
//
// Floating text that rises off whatever just happened. The runner had no
// score popups at all, which meant most of what the player earned — a stomp,
// a boss hit, a near miss — happened silently and only showed up on the recap.

export type PopupKind =
  | 'coin'
  | 'graze'
  | 'stomp'
  | 'boss'
  | 'bonus'
  | 'warn';

interface Popup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  kind: PopupKind;
  life: number;
  maxLife: number;
  /** Extra pop on the first beat, so a big award lands harder. */
  punch: number;
}

const STYLES: Record<PopupKind, { color: string; size: number; weight: number }> = {
  coin: { color: '#f0b429', size: 14, weight: 700 },
  graze: { color: '#7dd3fc', size: 13, weight: 700 },
  stomp: { color: '#34d399', size: 16, weight: 700 },
  boss: { color: '#f87171', size: 18, weight: 800 },
  bonus: { color: '#ffffff', size: 20, weight: 800 },
  warn: { color: '#fbbf24', size: 15, weight: 700 },
};

export class ScorePopups {
  private popups: Popup[] = [];
  /** Hard cap: a coin shower can fire dozens of these in a second. */
  private readonly limit = 24;
  private width = 800;
  private height = 600;

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  add(x: number, y: number, text: string, kind: PopupKind = 'coin'): void {
    if (this.popups.length >= this.limit) {
      // Drop the oldest rather than the newest — the newest is the one the
      // player is looking for.
      this.popups.shift();
    }

    // A popup is spawned at whatever it is reporting, which can be behind or
    // above the player and therefore off the edge. Keep it in view: an award
    // the player cannot read is not feedback.
    const margin = 52;
    this.popups.push({
      x: Math.max(margin, Math.min(this.width - margin, x)),
      y: Math.max(28, Math.min(this.height - 40, y)),
      // A slight sideways drift so a stack of popups fans out instead of
      // overprinting into an unreadable blur.
      vx: (Math.random() - 0.5) * 26,
      vy: -46 - Math.random() * 14,
      text,
      kind,
      life: kind === 'bonus' || kind === 'boss' ? 1.15 : 0.8,
      maxLife: kind === 'bonus' || kind === 'boss' ? 1.15 : 0.8,
      punch: 1,
    });
  }

  update(dt: number): void {
    this.popups = this.popups.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Drag, so they slow into their resting drift rather than sailing off.
      p.vy *= Math.max(0, 1 - dt * 2.2);
      p.vx *= Math.max(0, 1 - dt * 3);
      p.punch = Math.max(0, p.punch - dt * 6);
      return p.life > 0;
    });
  }

  render(ctx: CanvasRenderingContext2D, fontFamily: string): void {
    if (this.popups.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    for (const p of this.popups) {
      const style = STYLES[p.kind];
      const t = p.life / p.maxLife;
      // Hold full opacity for the first half, then fade — a popup that starts
      // fading immediately reads as faint rather than as rising.
      const alpha = Math.min(1, t * 2);
      const scale = 1 + p.punch * 0.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);
      ctx.font = `${style.weight} ${style.size}px ${fontFamily}`;

      // Outline first: these are drawn over a moving world of every colour.
      ctx.strokeStyle = 'rgba(6, 7, 10, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = style.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  clear(): void {
    this.popups = [];
  }

  get count(): number {
    return this.popups.length;
  }
}
