// ===== src/games/tapdodge/systems/Backdrop.ts =====
//
// The world under the hazards, in three cheap layers plus the road:
//
//   1. a deep gradient with the road surface laid on it   (cached per zone)
//   2. a slow drift of specks far below                   (40 dots)
//   3. one scenery band on the shoulders — clouds, rooftops, canyon walls or
//      storm — generated once per zone into a strip that tiles vertically
//      and scrolls at a parallax rate                     (cached per zone)
//
// Then the road itself: faint dashed lane dividers that scroll, the two lit
// rails in the zone accent, and ROAD PAINT — zone names and RUSH markings
// painted across the lanes that ride the road toward the ship, under every
// hazard, so an announcement never hides one.
//
// Zone changes crossfade over a second instead of cutting.

import { displayFont } from '@/games/shared/hud/canvasUi';
import { chevronPair } from './icons';
import {
  DECK_Y,
  GANTRY_H,
  LANES,
  LANE_W,
  ROAD_W,
  ROAD_X,
  VIEW_H,
  VIEW_W,
  mulberry32,
} from './layout';
import { RUSH_HOT, ZONES, ZoneStyle } from './palette';

const FADE_SECONDS = 1;
const SCENERY_PARALLAX = 0.45;
const SPECKS = 40;

type RGB = [number, number, number];

function rgbOf(hex: string): RGB {
  const p = parseInt(hex.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
}

function blend(a: string, b: string, t: number): RGB {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(x[0] + (y[0] - x[0]) * k),
    Math.round(x[1] + (y[1] - x[1]) * k),
    Math.round(x[2] + (y[2] - x[2]) * k),
  ];
}

export function rgba(c: RGB, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

interface Paint {
  text: string;
  sub: string;
  color: string;
  y: number;
  chevrons: boolean;
}

interface Speck {
  x: number;
  y: number;
  depth: number;
  size: number;
}

function makeCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  return c;
}

export class Backdrop {
  private zone = 0;
  private fromZone = 0;
  private fade = 1;
  private sceneryY = 0;
  private dashY = 0;
  private specks: Speck[] = [];
  private paints: Paint[] = [];
  private bases: (HTMLCanvasElement | null)[] = [];
  private strips: (HTMLCanvasElement | null)[] = [];

  constructor() {
    const rnd = mulberry32(90210);
    for (let i = 0; i < SPECKS; i++) {
      this.specks.push({
        x: rnd() * VIEW_W,
        y: rnd() * VIEW_H,
        depth: 0.15 + rnd() * 0.3,
        size: 0.8 + rnd() * 1.2,
      });
    }
  }

  reset(): void {
    this.zone = 0;
    this.fromZone = 0;
    this.fade = 1;
    this.sceneryY = 0;
    this.dashY = 0;
    this.paints = [];
  }

  setZone(zone: number): void {
    if (zone === this.zone) return;
    this.fromZone = this.zone;
    this.zone = zone;
    this.fade = 0;
  }

  getZone(): number {
    return this.zone;
  }

  /** The accent right now, mid-crossfade and mid-rush included. */
  accentRgb(rushBlend = 0, pulse = 0): RGB {
    const from = ZONES[this.fromZone].accent;
    const to = ZONES[this.zone].accent;
    const base = blend(from, to, this.fade);
    if (rushBlend <= 0) return base;
    const hex = `#${base.map(v => v.toString(16).padStart(2, '0')).join('')}`;
    return blend(hex, RUSH_HOT, rushBlend * (0.75 + 0.25 * pulse));
  }

  /** Paint text across the lanes at the far end of the road. */
  paint(text: string, color: string, sub = '', chevrons = false): void {
    this.paints.push({ text, sub, color, y: GANTRY_H - 70, chevrons });
  }

  update(dt: number, dy: number): void {
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / FADE_SECONDS);
    this.sceneryY = (this.sceneryY + dy * SCENERY_PARALLAX) % VIEW_H;
    this.dashY = (this.dashY + dy) % 62;
    for (const s of this.specks) {
      s.y += dy * s.depth;
      if (s.y > VIEW_H) s.y -= VIEW_H;
    }
    for (const p of this.paints) p.y += dy;
    this.paints = this.paints.filter(p => p.y < DECK_Y + 90);
  }

  render(ctx: CanvasRenderingContext2D, time: number, rushBlend: number): void {
    const fading = this.fade < 1;
    if (fading) this.drawZone(ctx, this.fromZone, 1);
    this.drawZone(ctx, this.zone, fading ? this.fade : 1);

    if (rushBlend > 0) {
      ctx.fillStyle = rgba(rgbOf(RUSH_HOT), 0.05 * rushBlend);
      ctx.fillRect(ROAD_X, 0, ROAD_W, VIEW_H);
    }

    this.drawDividers(ctx);
    this.drawPaint(ctx);
    const pulse = rushBlend > 0 ? 0.5 + 0.5 * Math.sin(time * 9) : 0;
    this.drawRails(ctx, this.accentRgb(rushBlend, pulse), rushBlend, pulse);
  }

  // ------------------------------------------------------------ layers

  private drawZone(
    ctx: CanvasRenderingContext2D,
    zone: number,
    alpha: number
  ): void {
    const style = ZONES[zone];
    ctx.save();
    ctx.globalAlpha = alpha;
    const base = this.base(zone);
    if (base) ctx.drawImage(base, 0, 0);
    else this.paintBase(ctx, style);

    ctx.fillStyle = style.detail;
    for (const s of this.specks) {
      ctx.globalAlpha = alpha * (0.12 + s.depth * 0.6);
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = alpha;

    const strip = this.strip(zone);
    const off = this.sceneryY;
    if (strip) {
      ctx.drawImage(strip, 0, off - VIEW_H);
      ctx.drawImage(strip, 0, off);
    }
    ctx.restore();
  }

  private drawDividers(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.lineWidth = 2;
    ctx.setLineDash([28, 34]);
    ctx.lineDashOffset = -this.dashY;
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      const x = ROAD_X + i * LANE_W;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawRails(
    ctx: CanvasRenderingContext2D,
    accent: RGB,
    rushBlend: number,
    pulse: number
  ): void {
    const glowA = 0.16 + 0.22 * rushBlend * pulse;
    ctx.save();
    for (const x of [ROAD_X, ROAD_X + ROAD_W]) {
      ctx.strokeStyle = rgba(accent, glowA);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
      ctx.stroke();
      ctx.strokeStyle = rgba(accent, 0.95);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Reflector studs riding the rails with the road.
    ctx.fillStyle = rgba(accent, 0.8);
    for (let y = (this.dashY * 2) % 124; y < VIEW_H; y += 62) {
      ctx.fillRect(ROAD_X - 7, y, 3, 8);
      ctx.fillRect(ROAD_X + ROAD_W + 4, y, 3, 8);
    }
    ctx.restore();
  }

  private drawPaint(ctx: CanvasRenderingContext2D): void {
    if (this.paints.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = ROAD_X + ROAD_W / 2;
    for (const p of this.paints) {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.font = displayFont(44, 800);
      ctx.fillText(p.text, cx, p.y);
      if (p.sub) {
        ctx.font = displayFont(16, 700);
        ctx.fillText(p.sub, cx, p.y - 40);
      }
      if (p.chevrons) {
        for (let l = 0; l < LANES; l++) {
          chevronPair(
            ctx,
            ROAD_X + LANE_W * (l + 0.5),
            p.y + 46,
            26,
            'down',
            4
          );
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ caches

  private base(zone: number): HTMLCanvasElement | null {
    if (this.bases[zone] === undefined) {
      const c = makeCanvas();
      const g = c?.getContext('2d');
      if (c && g) this.paintBase(g, ZONES[zone]);
      this.bases[zone] = c && g ? c : null;
    }
    return this.bases[zone];
  }

  private paintBase(ctx: CanvasRenderingContext2D, style: ZoneStyle): void {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, style.skyTop);
    g.addColorStop(1, style.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = rgba(rgbOf(style.road), 0.9);
    ctx.fillRect(ROAD_X, 0, ROAD_W, VIEW_H);
  }

  private strip(zone: number): HTMLCanvasElement | null {
    if (this.strips[zone] === undefined) {
      const c = makeCanvas();
      const g = c?.getContext('2d');
      if (c && g) paintScenery(g, ZONES[zone], zone);
      this.strips[zone] = c && g ? c : null;
    }
    return this.strips[zone];
  }
}

// ---------------------------------------------------------------- scenery
//
// Each band is drawn for y in [0, VIEW_H) and repeated at ±VIEW_H so the
// strip's top and bottom edges meet seamlessly when it tiles.

function paintScenery(
  ctx: CanvasRenderingContext2D,
  style: ZoneStyle,
  zone: number
): void {
  const rnd = mulberry32(1000 + zone * 77);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ROAD_X - 2, VIEW_H);
  ctx.rect(ROAD_X + ROAD_W + 2, 0, VIEW_W - ROAD_X - ROAD_W - 2, VIEW_H);
  ctx.clip();
  for (const side of [0, 1]) {
    const edge = side === 0 ? 0 : VIEW_W;
    const dir = side === 0 ? 1 : -1;
    switch (style.scenery) {
      case 'clouds':
        clouds(ctx, style, rnd, edge, dir);
        break;
      case 'towers':
        towers(ctx, style, rnd, edge, dir);
        break;
      case 'canyon':
        canyon(ctx, style, rnd, edge, dir);
        break;
      case 'storm':
        storm(ctx, style, rnd, edge, dir);
        break;
    }
  }
  ctx.restore();
}

function wrapped(y: number, draw: (yy: number) => void): void {
  draw(y);
  draw(y - VIEW_H);
  draw(y + VIEW_H);
}

function clouds(
  ctx: CanvasRenderingContext2D,
  style: ZoneStyle,
  rnd: () => number,
  edge: number,
  dir: number
): void {
  // Seen from above at speed, the deck below is long streaks of cloud laid
  // along the direction of travel: a body tone and a thin lit core.
  for (let i = 0; i < 11; i++) {
    const y = rnd() * VIEW_H;
    const x = edge + dir * (12 + rnd() * 76);
    const rx = 9 + rnd() * 14;
    const ry = 46 + rnd() * 70;
    wrapped(y, yy => {
      ctx.fillStyle = style.far;
      ctx.beginPath();
      ctx.ellipse(x, yy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.near;
      ctx.beginPath();
      ctx.ellipse(
        x + dir * rx * 0.2,
        yy - ry * 0.1,
        rx * 0.45,
        ry * 0.7,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }
}

function towers(
  ctx: CanvasRenderingContext2D,
  style: ZoneStyle,
  rnd: () => number,
  edge: number,
  dir: number
): void {
  let y = 0;
  while (y < VIEW_H) {
    const h = 34 + rnd() * 60;
    const w = 44 + rnd() * 46;
    const inset = 4 + rnd() * 10;
    const x0 = dir > 0 ? edge + inset : edge - inset - w;
    const roofs = 1 + Math.floor(rnd() * 3);
    const lights = Array.from({ length: 3 + Math.floor(rnd() * 5) }, () => ({
      lx: 6 + rnd() * (w - 12),
      ly: 6 + rnd() * (h - 12),
    }));
    const yy0 = y;
    wrapped(yy0, yy => {
      ctx.fillStyle = style.far;
      ctx.fillRect(x0, yy, w, h - 6);
      ctx.fillStyle = style.near;
      for (let r = 0; r < roofs; r++) {
        ctx.fillRect(x0 + 5 + r * 12, yy + 5, 8, 8);
      }
      ctx.strokeStyle = style.near;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 2.5, yy + 2.5, w - 5, h - 11);
      ctx.fillStyle = style.detail;
      ctx.globalAlpha = 0.55;
      for (const l of lights) ctx.fillRect(x0 + l.lx, yy + l.ly, 2, 2);
      ctx.globalAlpha = 1;
    });
    y += h;
  }
}

function canyon(
  ctx: CanvasRenderingContext2D,
  style: ZoneStyle,
  rnd: () => number,
  edge: number,
  dir: number
): void {
  // Integer harmonics of the strip height keep the wall edge periodic.
  const waves = [1, 3, 7].map(k => ({ k, a: 4 + rnd() * 10, p: rnd() * 7 }));
  const edgeAt = (y: number, base: number) =>
    base +
    waves.reduce(
      (s, w) => s + w.a * Math.sin((Math.PI * 2 * w.k * y) / VIEW_H + w.p),
      0
    );
  for (const [base, color] of [
    [82, style.far],
    [52, style.near],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(edge, 0);
    for (let y = 0; y <= VIEW_H; y += 10) {
      ctx.lineTo(edge + dir * edgeAt(y, base), y);
    }
    ctx.lineTo(edge, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = style.detail;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const y = rnd() * VIEW_H;
    const len = 14 + rnd() * 26;
    const x = edge + dir * (6 + rnd() * 30);
    wrapped(y, yy => {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + dir * len, yy + 3);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
}

function storm(
  ctx: CanvasRenderingContext2D,
  style: ZoneStyle,
  rnd: () => number,
  edge: number,
  dir: number
): void {
  for (let i = 0; i < 7; i++) {
    const y = (i / 7) * VIEW_H + rnd() * 50;
    const x = edge + dir * (25 + rnd() * 45);
    const r = 30 + rnd() * 26;
    wrapped(y, yy => {
      ctx.fillStyle = style.far;
      ctx.beginPath();
      ctx.ellipse(x, yy, r * 1.2, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.near;
      ctx.beginPath();
      ctx.ellipse(x + dir * 6, yy - 6, r * 0.7, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.strokeStyle = style.detail;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  for (let i = 0; i < 46; i++) {
    const y = rnd() * VIEW_H;
    const x = edge + dir * rnd() * 96;
    wrapped(y, yy => {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x - 5, yy + 16);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
}
