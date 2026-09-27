// ===== src/games/memory/systems/icons.ts =====
//
// The card faces' pictures, drawn as vectors so they look the same on every
// OS (the Unicode glyphs they replace rendered differently everywhere and
// several were missing on Android). House style: a flat fill in the icon's
// own colour, a dark ink outline, one soft highlight. Every icon draws into
// a 100x100 box centred on the origin; the caller translates and scales.
//
// Colours avoid the platform's amber (currency) and its problem red, and
// every icon has a different silhouette, so shape alone tells pairs apart.

import { P } from './palette';

export interface IconDef {
  id: string;
  color: string;
  draw(ctx: CanvasRenderingContext2D): void;
}

const INK = P.ink;
const OUTLINE = 5;

/** Fill the current path in `fill` and outline it in ink. */
function inked(ctx: CanvasRenderingContext2D, fill: string, width = OUTLINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** A heavy ink stroke with the colour stroked down its middle. */
function inkedStroke(ctx: CanvasRenderingContext2D, color: string, width = 8) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + OUTLINE + 1;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function shine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number
) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** A crescent: circle (0,0,R) with circle (dx,dy,r) bitten out of it. */
function crescentPath(
  ctx: CanvasRenderingContext2D,
  R: number,
  r: number,
  dx: number,
  dy: number
) {
  const d = Math.hypot(dx, dy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const bx = ux * a;
  const by = uy * a;
  const p1 = { x: bx - uy * h, y: by + ux * h };
  const p2 = { x: bx + uy * h, y: by - ux * h };
  const a1 = Math.atan2(p1.y, p1.x);
  const a2 = Math.atan2(p2.y, p2.x);
  const b1 = Math.atan2(p1.y - dy, p1.x - dx);
  const b2 = Math.atan2(p2.y - dy, p2.x - dx);
  ctx.beginPath();
  ctx.arc(0, 0, R, a1, a2, false);
  ctx.arc(dx, dy, r, b2, b1, true);
  ctx.closePath();
}

/** The flame silhouette, shared with the HUD's streak mark. */
export function flamePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.bezierCurveTo(-24, 48, -36, 30, -34, 10);
  ctx.bezierCurveTo(-32, -8, -18, -16, -14, -30);
  ctx.bezierCurveTo(-5, -22, -2, -14, 0, -6);
  ctx.bezierCurveTo(4, -24, 12, -38, 8, -50);
  ctx.bezierCurveTo(28, -34, 36, -10, 34, 12);
  ctx.bezierCurveTo(32, 34, 20, 48, 0, 48);
  ctx.closePath();
}

export function flameCorePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, 42);
  ctx.bezierCurveTo(-14, 42, -18, 30, -16, 20);
  ctx.bezierCurveTo(-14, 8, -4, 2, 0, -10);
  ctx.bezierCurveTo(6, 2, 16, 10, 16, 22);
  ctx.bezierCurveTo(16, 34, 10, 42, 0, 42);
  ctx.closePath();
}

export const ICONS: readonly IconDef[] = [
  {
    id: 'star',
    color: '#2e5bd0',
    draw(ctx) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 20 : 47;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r + 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      inked(ctx, this.color);
      shine(ctx, -9, -8, 5, 10, 0.5);
    },
  },
  {
    id: 'heart',
    color: '#e0457f',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(0, 42);
      ctx.bezierCurveTo(-8, 32, -46, 12, -44, -12);
      ctx.bezierCurveTo(-42, -38, -10, -44, 0, -20);
      ctx.bezierCurveTo(10, -44, 42, -38, 44, -12);
      ctx.bezierCurveTo(46, 12, 8, 32, 0, 42);
      ctx.closePath();
      inked(ctx, this.color);
      shine(ctx, -24, -16, 7, 11, -0.6);
    },
  },
  {
    id: 'moon',
    color: '#4a3fa0',
    draw(ctx) {
      ctx.save();
      ctx.rotate(-0.25);
      crescentPath(ctx, 44, 37, 20, -12);
      inked(ctx, this.color);
      shine(ctx, -30, 2, 4, 12, 0.2);
      ctx.restore();
      // A small star keeps the moon from reading as a banana at 40px.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 ? 3.5 : 10;
        ctx.lineTo(28 + Math.cos(a) * r, 18 + Math.sin(a) * r);
      }
      ctx.closePath();
      inked(ctx, '#8f86e0', 3);
    },
  },
  {
    id: 'sun',
    color: '#f07b3f',
    draw(ctx) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r1 = i % 2 ? 40 : 46;
        ctx.moveTo(Math.cos(a) * 31, Math.sin(a) * 31);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      }
      inkedStroke(ctx, this.color, 7);
      ctx.beginPath();
      circle(ctx, 0, 0, 23);
      inked(ctx, '#f59a5e');
      shine(ctx, -8, -9, 6, 8, -0.6);
    },
  },
  {
    id: 'bolt',
    color: '#9bbb2a',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(12, -48);
      ctx.lineTo(-26, 6);
      ctx.lineTo(-3, 6);
      ctx.lineTo(-14, 48);
      ctx.lineTo(28, -10);
      ctx.lineTo(5, -10);
      ctx.lineTo(20, -48);
      ctx.closePath();
      inked(ctx, this.color);
      shine(ctx, 4, -30, 3, 10, 0.55);
    },
  },
  {
    id: 'leaf',
    color: '#5aa53e',
    draw(ctx) {
      ctx.save();
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.quadraticCurveTo(44, -8, 0, 42);
      ctx.quadraticCurveTo(-44, -8, 0, -48);
      ctx.closePath();
      inked(ctx, this.color);
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.lineTo(0, 52);
      for (const [y, s] of [
        [-16, 1],
        [-2, -1],
        [12, 1],
        [22, -1],
      ]) {
        ctx.moveTo(0, y + 8);
        ctx.lineTo(13 * s, y - 4);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'drop',
    color: '#2f9ad8',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.bezierCurveTo(12, -28, 34, -6, 34, 14);
      ctx.bezierCurveTo(34, 36, 18, 46, 0, 46);
      ctx.bezierCurveTo(-18, 46, -34, 36, -34, 14);
      ctx.bezierCurveTo(-34, -6, -12, -28, 0, -48);
      ctx.closePath();
      inked(ctx, this.color);
      shine(ctx, -15, 14, 6, 13, 0.25);
    },
  },
  {
    id: 'flame',
    color: '#e4502a',
    draw(ctx) {
      flamePath(ctx);
      inked(ctx, this.color);
      flameCorePath(ctx);
      ctx.fillStyle = '#ffd6b0';
      ctx.fill();
    },
  },
  {
    id: 'note',
    color: '#3f2d4c',
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      // Beam
      ctx.beginPath();
      ctx.moveTo(-15, -36);
      ctx.lineTo(33, -46);
      ctx.lineTo(33, -30);
      ctx.lineTo(-15, -20);
      ctx.closePath();
      ctx.fill();
      // Stems
      ctx.fillRect(-15, -34, 8, 64);
      ctx.fillRect(25, -44, 8, 64);
      // Heads
      ctx.beginPath();
      ctx.ellipse(-22, 32, 15, 11, -0.4, 0, Math.PI * 2);
      ctx.moveTo(33, 22);
      ctx.ellipse(18, 22, 15, 11, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      shine(ctx, -26, 28, 5, 3, -0.4);
      shine(ctx, 14, 18, 5, 3, -0.4);
    },
  },
  {
    id: 'clover',
    color: '#1d7550',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(6, 32, 22, 48);
      inkedStroke(ctx, '#2f8a5f', 6);
      ctx.beginPath();
      for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
        circle(ctx, Math.cos(a) * 21, Math.sin(a) * 21 - 4, 20);
      }
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.lineWidth = OUTLINE;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // Re-fill the centre so the three outlines read as one plant.
      ctx.beginPath();
      circle(ctx, 0, -4, 15);
      ctx.fill();
      shine(ctx, -6, -30, 5, 7, -0.4);
    },
  },
  {
    id: 'anchor',
    color: '#34528c',
    draw(ctx) {
      ctx.beginPath();
      circle(ctx, 0, -38, 9);
      ctx.moveTo(0, -29);
      ctx.lineTo(0, 42);
      ctx.moveTo(-20, -14);
      ctx.lineTo(20, -14);
      ctx.moveTo(
        Math.cos(0.18 * Math.PI) * 36,
        6 + Math.sin(0.18 * Math.PI) * 36
      );
      ctx.arc(0, 6, 36, 0.18 * Math.PI, 0.82 * Math.PI);
      inkedStroke(ctx, this.color, 8);
      // Flukes
      ctx.beginPath();
      for (const s of [-1, 1]) {
        const ex = s * Math.cos(0.18 * Math.PI) * 36;
        const ey = 6 + Math.sin(0.18 * Math.PI) * 36;
        ctx.moveTo(ex + s * 8, ey - 14);
        ctx.lineTo(ex + s * 6, ey + 4);
        ctx.lineTo(ex - s * 12, ey - 2);
        ctx.closePath();
      }
      inked(ctx, this.color, 4);
    },
  },
  {
    id: 'key',
    color: '#667a8e',
    draw(ctx) {
      ctx.save();
      ctx.rotate(-0.62);
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(46, -6);
      ctx.lineTo(46, 6);
      ctx.lineTo(40, 6);
      ctx.lineTo(40, 22);
      ctx.lineTo(31, 22);
      ctx.lineTo(31, 6);
      ctx.lineTo(24, 6);
      ctx.lineTo(24, 16);
      ctx.lineTo(15, 16);
      ctx.lineTo(15, 6);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      inked(ctx, this.color);
      ctx.beginPath();
      circle(ctx, -26, 0, 21);
      circle(ctx, -28, 0, 8);
      ctx.fillStyle = this.color;
      ctx.fill('evenodd');
      ctx.lineWidth = OUTLINE;
      ctx.strokeStyle = INK;
      ctx.stroke();
      shine(ctx, -36, -10, 4, 7, 0.8);
      ctx.restore();
    },
  },
  {
    id: 'gem',
    color: '#8b4fcf',
    draw(ctx) {
      ctx.lineJoin = 'round';
      // Pavilion (lower) and crown (upper) facets in three tones.
      ctx.beginPath();
      ctx.moveTo(-26, -30);
      ctx.lineTo(26, -30);
      ctx.lineTo(44, -10);
      ctx.lineTo(0, 46);
      ctx.lineTo(-44, -10);
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-26, -30);
      ctx.lineTo(26, -30);
      ctx.lineTo(14, -10);
      ctx.lineTo(-14, -10);
      ctx.closePath();
      ctx.fillStyle = '#b894ea';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-44, -10);
      ctx.lineTo(-14, -10);
      ctx.lineTo(0, 46);
      ctx.closePath();
      ctx.fillStyle = '#6c36ac';
      ctx.fill();
      // Facet lines, then the outline over everything.
      ctx.beginPath();
      ctx.moveTo(-44, -10);
      ctx.lineTo(44, -10);
      ctx.moveTo(-14, -10);
      ctx.lineTo(0, 46);
      ctx.lineTo(14, -10);
      ctx.moveTo(-26, -30);
      ctx.lineTo(-14, -10);
      ctx.moveTo(26, -30);
      ctx.lineTo(14, -10);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-26, -30);
      ctx.lineTo(26, -30);
      ctx.lineTo(44, -10);
      ctx.lineTo(0, 46);
      ctx.lineTo(-44, -10);
      ctx.closePath();
      ctx.lineWidth = OUTLINE;
      ctx.stroke();
      shine(ctx, -8, -21, 7, 3, 0);
    },
  },
  {
    id: 'bell',
    color: '#9a6240',
    draw(ctx) {
      ctx.beginPath();
      circle(ctx, 0, -42, 6);
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      circle(ctx, 0, 40, 9);
      inked(ctx, '#6f4027', 4);
      ctx.beginPath();
      ctx.moveTo(-36, 30);
      ctx.bezierCurveTo(-30, 20, -28, 10, -28, -6);
      ctx.bezierCurveTo(-28, -30, -14, -38, 0, -38);
      ctx.bezierCurveTo(14, -38, 28, -30, 28, -6);
      ctx.bezierCurveTo(28, 10, 30, 20, 36, 30);
      ctx.quadraticCurveTo(0, 38, -36, 30);
      ctx.closePath();
      inked(ctx, this.color);
      shine(ctx, -14, -12, 4, 14, 0.1);
    },
  },
  {
    id: 'planet',
    color: '#4a86a3',
    draw(ctx) {
      const ring = (from: number, to: number) => {
        ctx.save();
        ctx.rotate(-0.38);
        ctx.beginPath();
        ctx.ellipse(0, 0, 50, 14, 0, from, to);
        inkedStroke(ctx, '#e0a3bd', 6);
        ctx.restore();
      };
      ring(Math.PI, Math.PI * 2);
      ctx.beginPath();
      circle(ctx, 0, 0, 29);
      inked(ctx, this.color);
      ctx.save();
      ctx.beginPath();
      circle(ctx, 0, 0, 27);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(-30, -14, 60, 7);
      ctx.fillRect(-30, 8, 60, 5);
      ctx.restore();
      ring(0, Math.PI);
      shine(ctx, -12, -14, 6, 8, -0.6);
    },
  },
  {
    id: 'fish',
    color: '#17928c',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(48, -24);
      ctx.quadraticCurveTo(40, 0, 48, 24);
      ctx.closePath();
      inked(ctx, '#127571');
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.quadraticCurveTo(4, -40, 16, -20);
      ctx.closePath();
      inked(ctx, '#127571', 4);
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.bezierCurveTo(-24, -30, 20, -30, 32, 0);
      ctx.bezierCurveTo(20, 30, -24, 30, -40, 0);
      ctx.closePath();
      inked(ctx, this.color);
      ctx.beginPath();
      ctx.arc(-14, 0, 14, -1.1, 1.1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      circle(ctx, -26, -5, 5);
      ctx.fillStyle = INK;
      ctx.fill();
      shine(ctx, 4, -12, 10, 4, -0.1);
    },
  },
  {
    id: 'cherry',
    color: '#b8233c',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-18, 10);
      ctx.quadraticCurveTo(-10, -26, 8, -40);
      ctx.moveTo(20, 14);
      ctx.quadraticCurveTo(18, -18, 8, -40);
      inkedStroke(ctx, '#4d8a32', 4);
      ctx.beginPath();
      ctx.moveTo(8, -40);
      ctx.quadraticCurveTo(24, -54, 40, -40);
      ctx.quadraticCurveTo(24, -30, 8, -40);
      ctx.closePath();
      inked(ctx, '#5aa53e', 4);
      ctx.beginPath();
      circle(ctx, -18, 24, 19);
      inked(ctx, this.color);
      ctx.beginPath();
      circle(ctx, 20, 28, 19);
      inked(ctx, this.color);
      shine(ctx, -25, 16, 4, 7, 0.5);
      shine(ctx, 13, 20, 4, 7, 0.5);
    },
  },
  {
    id: 'snowflake',
    color: '#3fa9cf',
    draw(ctx) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 2;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        ctx.moveTo(0, 0);
        ctx.lineTo(cx * 44, cy * 44);
        for (const t of [22, 34]) {
          const bx = cx * t;
          const by = cy * t;
          for (const s of [-1, 1]) {
            const ba = a + s * 0.8;
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(ba) * 11, by + Math.sin(ba) * 11);
          }
        }
      }
      inkedStroke(ctx, this.color, 6);
      ctx.beginPath();
      circle(ctx, 0, 0, 9);
      inked(ctx, '#8fd3ec', 4);
    },
  },
  {
    id: 'crown',
    color: '#b0529e',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-36, 24);
      ctx.lineTo(-42, -20);
      ctx.lineTo(-18, 2);
      ctx.lineTo(0, -32);
      ctx.lineTo(18, 2);
      ctx.lineTo(42, -20);
      ctx.lineTo(36, 24);
      ctx.closePath();
      inked(ctx, this.color);
      ctx.beginPath();
      ctx.rect(-38, 24, 76, 14);
      inked(ctx, '#8d3a7e');
      ctx.beginPath();
      circle(ctx, -42, -24, 6);
      circle(ctx, 0, -36, 6);
      circle(ctx, 42, -24, 6);
      inked(ctx, this.color, 4);
      ctx.beginPath();
      for (const x of [-20, 0, 20]) circle(ctx, x, 31, 3.5);
      ctx.fillStyle = P.ivory;
      ctx.fill();
      shine(ctx, -24, 0, 3, 9, -0.4);
    },
  },
];

/** Draw icon `index` centred at (x, y), `size` px across. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  size: number
): void {
  const icon = ICONS[index % ICONS.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  icon.draw(ctx);
  ctx.restore();
}
