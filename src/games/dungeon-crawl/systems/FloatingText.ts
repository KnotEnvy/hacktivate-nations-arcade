// ===== src/games/dungeon-crawl/systems/FloatingText.ts =====
// Wave L — floating combat numbers: damage taken (blood), heals (green),
// damage dealt (pale). The dice roll internally; only RESULTS reach the
// screen. World-space (camera translate already applied), capped, ticked on
// REAL dt beside the particles so hit-stop never freezes the readout.

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

const MAX_TEXTS = 40;
const LIFE = 0.7;

export class FloatingTextSystem {
  private texts: FloatingText[] = [];

  push(x: number, y: number, text: string, color: string, scale = 1): void {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    this.texts.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vy: -34,
      text,
      color,
      life: LIFE,
      maxLife: LIFE,
      scale,
    });
  }

  count(): number {
    return this.texts.length;
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.max(0, 1 - 2.2 * dt); // the rise eases off
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, (t.life / t.maxLife) * 1.6));
      ctx.fillStyle = t.color;
      ctx.font = `bold ${Math.round(12 * t.scale)}px monospace`;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.texts = [];
  }
}
