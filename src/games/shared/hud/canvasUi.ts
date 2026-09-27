// ===== src/games/shared/hud/canvasUi.ts =====
//
// The arcade design system, for canvas. Every game owns its own internal art
// direction, but the chrome a player reads (score, lives, timers, banners,
// power-up chips) has to look like it belongs to the same cabinet as the hub
// and the run shell. This module mirrors the @theme tokens in
// src/app/globals.css (see DOCS/UI-DESIGN-SYSTEM-HANDOFF.md) so a game can
// draw that chrome without hand-rolling colours and font strings.
//
// Rules the tokens encode:
//   - amber (`coin`) ALWAYS means currency and is never decorative
//   - emerald (`good`) means earned or safe, red (`bad`) means a problem
//   - Orbitron is display only (big numerals, titles); Inter is prose;
//     JetBrains Mono is for any value the player reads as a number
//   - depth comes from surface value, not from glow

/** Design tokens, mirrored from globals.css so canvas can use them. */
export const UI = {
  canvasDeep: '#06070a',
  surface: 'rgba(16, 18, 25, 0.82)',
  surfaceSolid: '#101219',
  surface2: '#161923',
  surface3: '#1d2130',
  line: 'rgba(255, 255, 255, 0.10)',
  lineStrong: 'rgba(255, 255, 255, 0.18)',
  ink: '#edeff5',
  inkMuted: '#a2a9b8',
  inkFaint: '#6d7484',
  brand: '#7c6bff',
  brandBright: '#9182ff',
  brandDim: '#5a4dcc',
  coin: '#f0b429',
  coinDim: '#b8861c',
  good: '#34d399',
  goodDim: '#1f8f68',
  warn: '#fbbf24',
  bad: '#f87171',
  badDim: '#b34a4a',
} as const;

/**
 * next/font exposes the real family name through a CSS variable. Canvas can
 * not read a CSS var inside a font string, so resolve it once and keep a
 * plain system fallback for jsdom and for the frames before the font loads.
 */
function resolveFamily(variable: string, fallback: string): string {
  try {
    if (typeof document === 'undefined') return fallback;
    // layout.tsx puts the next/font variables on <body>, not on <html>.
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
let sansFamily: string | null = null;
let monoFamily: string | null = null;

/** Orbitron: titles and big numerals only. */
export function displayFont(size: number, weight = 700): string {
  if (displayFamily === null) {
    displayFamily = resolveFamily('--font-orbitron', 'system-ui, sans-serif');
  }
  return `${weight} ${size}px ${displayFamily}`;
}

/** Inter: everything the player reads as prose. */
export function sansFont(size: number, weight = 600): string {
  if (sansFamily === null) {
    sansFamily = resolveFamily('--font-inter', 'system-ui, sans-serif');
  }
  return `${weight} ${size}px ${sansFamily}`;
}

/** JetBrains Mono: anything the player reads as a value. */
export function monoFont(size: number, weight = 600): string {
  if (monoFamily === null) {
    monoFamily = resolveFamily(
      '--font-jetbrains-mono',
      'ui-monospace, monospace'
    );
  }
  return `${weight} ${size}px ${monoFamily}`;
}

/** Forget the resolved families (tests that swap the document). */
export function resetFontCache(): void {
  displayFamily = null;
  sansFamily = null;
  monoFamily = null;
}

// ------------------------------------------------------------ colour ----

/** Linear blend between two '#rrggbb' colours; t is clamped to 0..1. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 255;
  const ga = (pa >> 8) & 255;
  const ba = pa & 255;
  const rb = (pb >> 16) & 255;
  const gb = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ra + (rb - ra) * k);
  const g = Math.round(ga + (gb - ga) * k);
  const bl = Math.round(ba + (bb - ba) * k);
  return `rgb(${r}, ${g}, ${bl})`;
}

/** '#rrggbb' → 'rgba(r, g, b, alpha)'. */
export function withAlpha(hex: string, alpha: number): string {
  const p = parseInt(hex.slice(1), 16);
  const r = (p >> 16) & 255;
  const g = (p >> 8) & 255;
  const b = p & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

// ------------------------------------------------------------- shapes ----

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
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

/** A translucent surface with a hairline border: the basic HUD container. */
export function panel(
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
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = UI.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Canvas has no letter-spacing, so tracked text is drawn glyph by glyph. */
export function tracked(
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

export function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number
): number {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  return Math.max(0, total - spacing);
}

/**
 * The small tracked caps label above a value ("SCORE", "BEST", "LEVEL").
 * Left-aligned at (x, y); pass `align: 'right'` to end at x instead.
 */
export function eyebrow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'right' | 'center' = 'left',
  color: string = UI.inkFaint
): void {
  ctx.save();
  ctx.font = sansFont(9, 700);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const w = trackedWidth(ctx, text, 1.4);
  const startX = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  tracked(ctx, text, startX, y, 1.4);
  ctx.restore();
}

/** A headline value in the display face, zero-padded so it never jitters. */
export function bigNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  size = 24,
  pad = 0,
  color: string = UI.ink
): void {
  ctx.save();
  ctx.font = displayFont(size);
  ctx.fillStyle = color;
  ctx.fillText(String(Math.floor(value)).padStart(pad, '0'), x, y);
  ctx.restore();
}

/** A thin progress rail; `t` is 0..1. */
export function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  fill: string,
  track = 'rgba(255, 255, 255, 0.10)'
): void {
  const k = Math.max(0, Math.min(1, t));
  ctx.save();
  ctx.fillStyle = track;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (k > 0) {
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, Math.max(h, w * k), h, h / 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The currency glyph: a flat amber disc with a darker centre. */
export function coinGlyph(
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

/**
 * A row of life pips as chevrons: full ones in `color`, spent ones hollow.
 * The last remaining life pulses with `time` so the player feels it.
 */
export function lifePips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lives: number,
  maxLives: number,
  color: string,
  time = 0,
  gap = 17
): void {
  for (let i = 0; i < maxLives; i++) {
    const cx = x + i * gap;
    const alive = i < lives;
    const last = alive && lives === 1 && i === 0;
    const pulse = last ? 0.55 + Math.abs(Math.sin(time * 6)) * 0.45 : 1;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(cx, y - 8);
    ctx.lineTo(cx + 6, y - 1);
    ctx.lineTo(cx, y + 3);
    ctx.lineTo(cx - 6, y - 1);
    ctx.closePath();
    if (alive) {
      ctx.fillStyle = lives === 1 ? UI.bad : color;
      ctx.fill();
    } else {
      ctx.strokeStyle = UI.lineStrong;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** A drawn heart, for games whose lives read better as hearts than pips. */
export function heart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  filled: boolean,
  color: string = UI.bad
): void {
  const w = size;
  const h = size;
  const top = h * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + top);
  ctx.bezierCurveTo(x, y, x - w / 2, y, x - w / 2, y + top);
  ctx.bezierCurveTo(
    x - w / 2,
    y + (h + top) / 2,
    x,
    y + (h + top) / 2,
    x,
    y + h
  );
  ctx.bezierCurveTo(
    x,
    y + (h + top) / 2,
    x + w / 2,
    y + (h + top) / 2,
    x + w / 2,
    y + top
  );
  ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + top);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = UI.lineStrong;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A status chip: colour dot, label, right-aligned value, and an optional
 * drain rail along its bottom edge (`t` 0..1). Used for active power-ups,
 * modes and timers. At 26px tall an icon is mush, so it is a dot.
 */
export function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  color: string,
  t: number | null = null,
  h = 26
): void {
  panel(ctx, x, y, w, h, 6);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 15, y + h / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = UI.ink;
  ctx.font = sansFont(11, 600);
  ctx.fillText(label, x + 27, y + h / 2 + 4);

  if (value) {
    ctx.textAlign = 'right';
    ctx.fillStyle = UI.inkMuted;
    ctx.font = monoFont(11, 700);
    ctx.fillText(value, x + w - 10, y + h / 2 + 4);
  }

  if (t !== null) {
    const k = Math.max(0, Math.min(1, t));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 1, y + h - 4, w - 2, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + h - 4, (w - 2) * k, 3);
  }
  ctx.restore();
}

/**
 * A centred banner card ("LEVEL 2", "READY", "STAGE CLEAR") with an optional
 * subtitle. `alpha` fades it; the caller owns the timer.
 */
export function banner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  title: string,
  subtitle = '',
  accent: string = UI.brandBright,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(26);
  const tw = ctx.measureText(title).width;
  ctx.font = sansFont(12, 600);
  const sw = subtitle ? ctx.measureText(subtitle).width : 0;
  const w = Math.max(tw, sw) + 64;
  const h = subtitle ? 78 : 56;
  const x = cx - w / 2;
  const y = cy - h / 2;

  panel(ctx, x, y, w, h, 12, 0.86);
  // Accent rail on the left edge, the one place the accent is allowed.
  ctx.fillStyle = accent;
  roundRectPath(ctx, x + 1, y + 10, 3, h - 20, 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = UI.ink;
  ctx.font = displayFont(26);
  ctx.fillText(title, cx + 2, y + (subtitle ? 38 : 38));
  if (subtitle) {
    ctx.fillStyle = UI.inkMuted;
    ctx.font = sansFont(12, 600);
    ctx.fillText(subtitle, cx + 2, y + 62);
  }
  ctx.restore();
}

/**
 * A soft full-frame edge vignette in `color`, for hits (red) and slow-mo
 * (accent). `strength` is 0..1.
 */
export function edgeVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  strength: number
): void {
  if (strength <= 0) return;
  const k = Math.min(1, strength);
  ctx.save();
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(1, withAlpha(color, 0.55 * k));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Ease helpers shared by juice code. */
export const ease = {
  outBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const k = Math.max(0, Math.min(1, t));
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
  outCubic(t: number): number {
    const k = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - k, 3);
  },
  inOutSine(t: number): number {
    const k = Math.max(0, Math.min(1, t));
    return -(Math.cos(Math.PI * k) - 1) / 2;
  },
  outElastic(t: number): number {
    const k = Math.max(0, Math.min(1, t));
    if (k === 0 || k === 1) return k;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * c4) + 1;
  },
};
