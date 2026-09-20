// ===== src/games/runner/systems/ParallaxSystem.ts =====
//
// Six depth bands, drawn back to front:
//
//   sky features (celestial body, stars)  static
//   clouds                                0.08
//   far silhouettes                       0.14
//   mid hills / structures                0.30
//   near props                            0.55
//   ground detail                         1.00
//
// Every band except the sky is a SEAMLESS STRIP: its content is generated once
// into an offscreen canvas whose left and right edges line up, then blitted
// twice per frame. That buys three things at once —
//
//   * no shimmer. The old system seeded element size and type from the element's
//     SCREEN position, so a tree changed shape as it scrolled. Strip-local
//     seeding is fixed for the life of the strip.
//   * detail is free. A strip is drawn on theme change, not 60 times a second,
//     so the bands can carry far more geometry than a per-frame renderer could.
//   * ridges tile because their height functions are built from integer
//     harmonics of the strip width, so h(0) === h(width).
//
// If an offscreen canvas is unavailable (jsdom, exotic embeds) every band falls
// back to drawing straight to the passed context.

import {
  EnvironmentSystem,
  EnvironmentTheme,
  ThemePalette,
} from './EnvironmentSystem';

interface Band {
  name: string;
  speed: number;
  /** Where the strip sits vertically, relative to the canvas top. */
  top: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, p: ThemePalette, width: number) => void;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  phase: number;
}

/** Stable hash → [0, 1). Used for per-element variation inside a strip. */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class ParallaxSystem {
  private canvasWidth: number;
  private canvasHeight: number;
  private groundY: number;
  private distance = 0;
  private time = 0;
  /** Margin drawn past every edge, for the camera's pull-back. */
  private overscan = 110;

  private bands: Band[] = [];
  private foreground!: Band;
  /** One cached strip per band, rebuilt whenever the theme changes. */
  private strips = new Map<string, HTMLCanvasElement>();
  private stripTheme: EnvironmentTheme | null = null;

  private motes: Mote[] = [];
  private moteBudget = 0;

  /** Strips are twice the canvas so repeats stay off-screen for a long while. */
  private get stripWidth(): number {
    return this.canvasWidth * 2;
  }

  setOverscan(margin: number): void {
    this.overscan = margin;
  }

  constructor(canvasWidth: number, canvasHeight: number, groundY: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundY = groundY;
    this.buildBands();
  }

  private buildBands(): void {
    const sky = this.groundY;
    this.bands = [
      {
        name: 'clouds',
        speed: 0.08,
        top: 0,
        height: Math.max(80, sky * 0.55),
        draw: (ctx, p, w) => this.drawClouds(ctx, p, w, Math.max(80, sky * 0.55)),
      },
      {
        name: 'far',
        speed: 0.14,
        top: sky - 330,
        height: 330,
        draw: (ctx, p, w) => this.drawFar(ctx, p, w, 330),
      },
      {
        name: 'mid',
        speed: 0.3,
        top: sky - 190,
        height: 190,
        draw: (ctx, p, w) => this.drawMid(ctx, p, w, 190),
      },
      {
        name: 'near',
        speed: 0.55,
        top: sky - 90,
        height: 92,
        draw: (ctx, p, w) => this.drawNear(ctx, p, w, 90),
      },
    ];

    // Drawn separately, AFTER the entities, so it occludes them. One band of
    // near-black silhouettes streaking past the camera is the cheapest depth
    // cue there is: it puts the playfield inside the world rather than in
    // front of a backdrop.
    // Kept LOW on purpose. The first pass ran 96px tall and its grass swallowed
    // the runner, who has to be readable at all times. At this height the
    // silhouettes streak past the player's feet instead of across their body.
    const fgHeight = 62;
    this.foreground = {
      name: 'foreground',
      speed: 1.75,
      top: this.canvasHeight - fgHeight,
      height: fgHeight,
      draw: (ctx, p, w) => this.drawForeground(ctx, p, w, fgHeight),
    };
  }

  /**
   * @param delta distance the world scrolled this frame, in world units
   * @param dt    seconds elapsed, for animation that is not scroll-driven
   */
  update(delta: number, dt = delta / 6000): void {
    this.distance += delta;
    this.time += dt;
    this.updateMotes(dt, delta);
  }

  reset(): void {
    this.distance = 0;
    this.time = 0;
    this.motes = [];
    this.strips.clear();
    this.stripTheme = null;
  }

  render(ctx: CanvasRenderingContext2D, theme: EnvironmentTheme): void {
    const palette = EnvironmentSystem.paletteFor(theme);

    if (this.stripTheme !== theme) {
      this.strips.clear();
      this.stripTheme = theme;
      this.motes = [];
    }

    this.renderSky(ctx, palette);

    for (const band of this.bands) {
      this.renderBand(ctx, band, palette);
    }

    this.renderMotes(ctx, palette);
  }

  /**
   * The occluding band. Called by the game AFTER the entities are drawn, so
   * it passes in front of the runner.
   */
  renderForeground(ctx: CanvasRenderingContext2D, theme: EnvironmentTheme): void {
    const palette = EnvironmentSystem.paletteFor(theme);
    if (this.stripTheme !== theme) {
      this.strips.clear();
      this.stripTheme = theme;
    }
    this.renderBand(ctx, this.foreground, palette);
  }

  // ---------------------------------------------------------------- sky ----

  /** Sky gradient plus whatever hangs in it. Drawn every frame; it is cheap. */
  private renderSky(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    // Reach past the frame: the camera pulls back at speed and would
    // otherwise expose bare canvas above and to the sides of the sky.
    const over = this.overscan;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.groundY);
    for (const stop of p.sky) gradient.addColorStop(stop.at, stop.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(-over, -over, this.canvasWidth + over * 2, this.groundY + over);

    if (p.celestial === 'moon') this.drawStars(ctx, p);
    this.drawCelestial(ctx, p);

    // Horizon haze: the single strongest depth cue. Everything drawn after this
    // sits in front of it, everything painted into it recedes.
    const haze = ctx.createLinearGradient(0, this.groundY - 220, 0, this.groundY);
    haze.addColorStop(0, this.withAlpha(p.haze, 0));
    haze.addColorStop(1, this.withAlpha(p.haze, 0.55));
    ctx.fillStyle = haze;
    ctx.fillRect(-over, this.groundY - 220, this.canvasWidth + over * 2, 220);
  }

  private drawStars(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    // Stars drift a hair slower than the clouds, so the sky has depth too.
    const drift = (this.distance * 0.02) % this.canvasWidth;
    const horizon = this.groundY - 120;
    for (let i = 0; i < 90; i++) {
      const x = (hash(i) * this.canvasWidth * 2 - drift) % (this.canvasWidth * 2);
      const sx = x < 0 ? x + this.canvasWidth * 2 : x;
      if (sx > this.canvasWidth) continue;
      const y = hash(i + 500) * horizon;
      // Twinkle: a slow per-star phase, never all at once.
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 1.4 + i));
      const size = hash(i + 900) > 0.88 ? 2 : 1;
      // Fade stars out toward the bright horizon.
      const depth = 1 - y / horizon;
      ctx.globalAlpha = twinkle * (0.25 + depth * 0.65);
      ctx.fillStyle = hash(i + 1300) > 0.85 ? '#BFD7FF' : '#FFFFFF';
      ctx.fillRect(sx, y, size, size);
    }
    ctx.globalAlpha = 1;

    void p;
  }

  private drawCelestial(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    // Parked high and right, drifting only a little — it reads as very distant.
    const drift = (this.distance * 0.01) % (this.canvasWidth * 4);
    const x = this.canvasWidth * 0.76 - drift * 0.06;
    const wrapped = ((x % (this.canvasWidth * 1.6)) + this.canvasWidth * 1.6) %
      (this.canvasWidth * 1.6);

    switch (p.celestial) {
      case 'sun':
        this.drawGlowOrb(ctx, wrapped, 92, 34, '#FFF6C9', '#FFD35B', 130);
        break;
      case 'setting-sun': {
        // Low, huge, and sitting right on the haze line.
        const sx = this.canvasWidth * 0.68;
        const sy = this.groundY - 252;
        this.drawGlowOrb(ctx, sx, sy, 66, '#FFF1C0', '#FF8A3D', 260);
        // A light path spilling down toward the horizon. Drawn as a radial
        // wash rather than a rectangle with a vertical gradient — that
        // version had hard left and right edges and read as a pale box
        // hanging in the sky.
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1, (this.groundY - sy) / 150);
        const path = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
        path.addColorStop(0, 'rgba(255, 170, 90, 0.26)');
        path.addColorStop(0.6, 'rgba(255, 170, 90, 0.08)');
        path.addColorStop(1, 'rgba(255, 170, 90, 0)');
        ctx.fillStyle = path;
        ctx.beginPath();
        ctx.arc(0, 0, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'moon': {
        const mx = this.canvasWidth * 0.78;
        const my = 96;
        this.drawGlowOrb(ctx, mx, my, 30, '#FFFFFF', '#CFE0FF', 120);
        // Craters, bitten out of the disc rather than painted on top.
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx, my, 30, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(150, 170, 210, 0.45)';
        const craters: [number, number, number][] = [
          [-9, -7, 7],
          [8, 4, 9],
          [-4, 12, 5],
          [13, -11, 4],
        ];
        for (const [cx, cy, r] of craters) {
          ctx.beginPath();
          ctx.arc(mx + cx, my + cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'white-sun': {
        const sx = this.canvasWidth * 0.72;
        this.drawGlowOrb(ctx, sx, 74, 26, '#FFFFFF', '#FFF0B8', 190);
        // Heat shimmer: faint horizontal bands wobbling above the dunes.
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 6; i++) {
          const y = this.groundY - 40 - i * 9;
          const wob = Math.sin(this.time * 1.6 + i * 1.3) * 12;
          ctx.fillRect(wob, y, this.canvasWidth, 2);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'shafts': {
        // God rays cutting down through the canopy.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const baseX = (i / 5) * this.canvasWidth + 60;
          const sway = Math.sin(this.time * 0.35 + i) * 18;
          const grad = ctx.createLinearGradient(0, 0, 0, this.groundY);
          grad.addColorStop(0, 'rgba(198, 236, 150, 0.16)');
          grad.addColorStop(0.7, 'rgba(198, 236, 150, 0.05)');
          grad.addColorStop(1, 'rgba(198, 236, 150, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(baseX - 22 + sway, 0);
          ctx.lineTo(baseX + 22 + sway, 0);
          ctx.lineTo(baseX + 96 + sway, this.groundY);
          ctx.lineTo(baseX + 20 + sway, this.groundY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }
    }
  }

  private drawGlowOrb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    core: string,
    edge: string,
    glowRadius: number
  ): void {
    const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, glowRadius);
    glow.addColorStop(0, this.withAlpha(edge, 0.45));
    glow.addColorStop(0.5, this.withAlpha(edge, 0.14));
    glow.addColorStop(1, this.withAlpha(edge, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    const disc = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    disc.addColorStop(0, core);
    disc.addColorStop(1, edge);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------- bands ----

  private renderBand(
    ctx: CanvasRenderingContext2D,
    band: Band,
    p: ThemePalette
  ): void {
    const width = this.stripWidth;
    const offset = ((this.distance * band.speed) % width + width) % width;
    const strip = this.getStrip(band, p);

    if (strip) {
      ctx.drawImage(strip, -offset, band.top);
      ctx.drawImage(strip, -offset + width, band.top);
      return;
    }

    // No offscreen canvas: draw the band straight into the frame instead.
    for (let tile = 0; tile < 2; tile++) {
      ctx.save();
      ctx.translate(-offset + tile * width, band.top);
      band.draw(ctx, p, width);
      ctx.restore();
    }
  }

  private getStrip(band: Band, p: ThemePalette): HTMLCanvasElement | null {
    const cached = this.strips.get(band.name);
    if (cached) return cached;

    const canvas = this.makeCanvas(this.stripWidth, band.height);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    band.draw(ctx, p, this.stripWidth);
    this.strips.set(band.name, canvas);
    return canvas;
  }

  private makeCanvas(width: number, height: number): HTMLCanvasElement | null {
    try {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
      // jsdom hands back the shared stub for every canvas, so a strip drawn
      // there would be blitted over the real frame. Only trust a context that
      // actually belongs to this element.
      if (canvas.getContext('2d') === null) return null;
      return canvas;
    } catch {
      return null;
    }
  }

  /**
   * A seamless ridge height at strip fraction `t`, built from integer
   * harmonics so height(0) === height(1).
   */
  private ridge(t: number, harmonics: [number, number, number][]): number {
    let total = 0;
    for (const [freq, amp, phase] of harmonics) {
      total += Math.sin(t * Math.PI * 2 * freq + phase) * amp;
    }
    return total;
  }

  private fillRidge(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandHeight: number,
    baseHeight: number,
    harmonics: [number, number, number][],
    color: string,
    step = 8
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, bandHeight);
    for (let x = 0; x <= width; x += step) {
      const h = baseHeight + this.ridge(x / width, harmonics);
      ctx.lineTo(x, bandHeight - h);
    }
    ctx.lineTo(width, bandHeight);
    ctx.closePath();
    ctx.fill();
  }

  /** Jagged variant: straight segments between sampled peaks, for rock. */
  private fillCrags(
    ctx: CanvasRenderingContext2D,
    width: number,
    bandHeight: number,
    baseHeight: number,
    harmonics: [number, number, number][],
    color: string,
    seed: number,
    step = 26
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, bandHeight);
    const count = Math.round(width / step);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      // hash on i, wrapped, so the last sample matches the first.
      const jitter = (hash((i % count) + seed) - 0.5) * baseHeight * 0.38;
      const h = baseHeight + this.ridge(t, harmonics) + jitter;
      ctx.lineTo(t * width, bandHeight - h);
    }
    ctx.lineTo(width, bandHeight);
    ctx.closePath();
    ctx.fill();
  }

  // ------------------------------------------------------------ far band ---

  private drawFar(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    switch (p.skyline) {
      case 'peaks':
        this.drawPeaks(ctx, p, width, h);
        break;
      case 'crags':
        this.drawCrags(ctx, p, width, h);
        break;
      case 'city':
        this.drawCity(ctx, p, width, h);
        break;
      case 'dunes':
        this.drawDunes(ctx, p, width, h);
        break;
      case 'canopy':
        this.drawCanopy(ctx, p, width, h);
        break;
    }
  }

  private drawPeaks(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    // Three ranges, each nearer one darker and lower — aerial perspective.
    const ranges: [string, number, [number, number, number][]][] = [
      [p.ridgeFar, 250, [[2, 46, 0.4], [5, 20, 1.9], [9, 9, 3.1]]],
      [p.ridgeMid, 190, [[3, 40, 2.2], [6, 16, 0.6], [11, 7, 4.4]]],
      [p.ridgeNear, 130, [[2, 34, 4.1], [7, 14, 2.8], [13, 6, 1.2]]],
    ];

    ranges.forEach(([color, base, harmonics], i) => {
      this.fillRidge(ctx, width, h, base, harmonics, color, 6);

      // Snowcaps on the two farthest ranges only.
      if (i > 1) return;
      ctx.save();
      ctx.globalAlpha = 0.55 - i * 0.2;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      let drawing = false;
      for (let x = 0; x <= width; x += 6) {
        const peak = base + this.ridge(x / width, harmonics);
        const snowLine = base + 28;
        if (peak > snowLine) {
          if (!drawing) {
            ctx.moveTo(x, h - peak);
            drawing = true;
          }
          ctx.lineTo(x, h - peak);
        } else if (drawing) {
          ctx.lineTo(x, h - snowLine);
          drawing = false;
        }
      }
      ctx.lineTo(width, h - base);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  private drawCrags(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    const ranges: [string, number, number][] = [
      [p.ridgeFar, 220, 11],
      [p.ridgeMid, 165, 57],
      [p.ridgeNear, 105, 131],
    ];
    ranges.forEach(([color, base, seed], i) => {
      this.fillCrags(
        ctx,
        width,
        h,
        base,
        [[2, 34, 1.1 + i], [5, 15, 3.3]],
        color,
        seed,
        30 - i * 6
      );
    });
  }

  private drawCity(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    // Two building ranks. The back rank is hazier and taller, the front is
    // darker and carries the lit windows.
    const ranks: [string, number, number, number, string][] = [
      [p.ridgeFar, 190, 34, 0, '#6C86D8'],
      [p.ridgeNear, 140, 46, 700, '#FFD98A'],
    ];

    ranks.forEach(([color, maxHeight, slot, seed, windowColor], rank) => {
      const count = Math.round(width / slot);
      for (let i = 0; i < count; i++) {
        const r = hash(i + seed);
        const bw = slot * (0.62 + hash(i + seed + 77) * 0.3);
        const bh = 55 + r * maxHeight;
        const x = (i / count) * width;
        const y = h - bh;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, bw, bh);

        // Roof furniture: an aerial, a water tank, or a stepped crown.
        const crown = hash(i + seed + 200);
        if (crown > 0.78) {
          ctx.fillRect(x + bw * 0.45, y - 16, 2, 16);
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(x + bw * 0.45 - 1, y - 18, 4, 3);
          ctx.fillStyle = color;
        } else if (crown > 0.6) {
          ctx.fillRect(x + bw * 0.2, y - 8, bw * 0.6, 8);
        }

        // Windows, only on the front rank — the back rank stays a silhouette.
        if (rank === 0) continue;
        ctx.fillStyle = windowColor;
        for (let fy = y + 8; fy < h - 8; fy += 11) {
          for (let fx = x + 4; fx < x + bw - 5; fx += 9) {
            const lit = hash(Math.round(fx) * 31 + Math.round(fy) * 7 + seed);
            if (lit < 0.42) continue;
            ctx.globalAlpha = 0.35 + lit * 0.5;
            // A few windows run cold blue instead of warm.
            ctx.fillStyle = lit > 0.93 ? '#7DD3FC' : windowColor;
            ctx.fillRect(fx, fy, 4, 5);
          }
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  private drawDunes(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    const ranges: [string, number, [number, number, number][]][] = [
      [p.ridgeFar, 150, [[1, 44, 0.2], [3, 22, 2.4]]],
      [p.ridgeMid, 108, [[2, 38, 3.1], [5, 14, 0.9]]],
      [p.ridgeNear, 66, [[3, 26, 1.7], [6, 11, 4.2]]],
    ];

    ranges.forEach(([color, base, harmonics], i) => {
      this.fillRidge(ctx, width, h, base, harmonics, color, 4);

      // A lit crest along each dune's spine, sun side only.
      ctx.save();
      ctx.globalAlpha = 0.3 - i * 0.07;
      ctx.strokeStyle = '#FFF6DC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const y = h - base - this.ridge(x / width, harmonics);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  private drawCanopy(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    // Receding walls of forest: a soft ridge, then a lumpy treeline on top of
    // it so the horizon reads as foliage rather than a painted band.
    const ranges: [string, number, number, number][] = [
      [p.ridgeFar, 195, 16, 3],
      [p.ridgeMid, 140, 22, 511],
      [p.ridgeNear, 88, 30, 907],
    ];

    ranges.forEach(([color, base, lump, seed]) => {
      const harmonics: [number, number, number][] = [
        [2, 26, seed * 0.01],
        [5, 12, 1.4],
      ];
      this.fillRidge(ctx, width, h, base, harmonics, color, 6);

      // Crown lumps riding the ridge line.
      ctx.fillStyle = color;
      const count = Math.round(width / lump);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const x = t * width;
        const r = lump * (0.45 + hash(i + seed) * 0.5);
        const y = h - base - this.ridge(t, harmonics);
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // ------------------------------------------------------------ mid band ---

  private drawMid(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    // A rolling hill the props stand on, so the band has a ground of its own.
    const harmonics: [number, number, number][] = [
      [2, 16, 1.3],
      [5, 7, 3.8],
    ];
    this.fillRidge(ctx, width, h, 52, harmonics, this.shade(p.ridgeNear, -0.1), 6);

    const slot = 74;
    const count = Math.round(width / slot);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = t * width + hash(i + 41) * 26;
      const groundLine = h - 46 - this.ridge(t, harmonics);
      const kind = hash(i + 13);

      if (p.skyline === 'city') {
        this.drawMidCityProp(ctx, p, x, groundLine, kind, i);
      } else if (p.skyline === 'dunes') {
        this.drawMidDesertProp(ctx, p, x, groundLine, kind, i);
      } else {
        this.drawMidTree(ctx, p, x, groundLine, kind, i);
      }
    }
  }

  private drawMidTree(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    x: number,
    groundLine: number,
    kind: number,
    i: number
  ): void {
    const size = 34 + hash(i + 301) * 30;

    if (kind < 0.18) {
      // A boulder cluster instead of a tree, to break the rhythm.
      for (let r = 0; r < 3; r++) {
        const rs = 9 + hash(i * 7 + r) * 13;
        ctx.fillStyle = r === 1 ? this.shade(p.trunk, 0.14) : p.trunk;
        ctx.beginPath();
        ctx.ellipse(x + r * 13, groundLine - rs * 0.45, rs, rs * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Trunk, tapering and leaning a touch.
    const lean = (hash(i + 55) - 0.5) * 8;
    ctx.fillStyle = p.trunk;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.07, groundLine);
    ctx.lineTo(x + size * 0.07, groundLine);
    ctx.lineTo(x + lean + size * 0.04, groundLine - size * 0.72);
    ctx.lineTo(x + lean - size * 0.04, groundLine - size * 0.72);
    ctx.closePath();
    ctx.fill();

    const cx = x + lean;
    const cy = groundLine - size * 0.85;

    if (p.skyline === 'canopy' && kind > 0.62) {
      // Conifer: stacked triangles.
      for (let s = 0; s < 3; s++) {
        const w = size * (0.56 - s * 0.13);
        const yTop = cy - size * (0.28 + s * 0.26);
        ctx.fillStyle = s === 2 ? p.foliageLight : s === 1 ? p.foliageMid : p.foliageDark;
        ctx.beginPath();
        ctx.moveTo(cx, yTop);
        ctx.lineTo(cx + w, yTop + size * 0.42);
        ctx.lineTo(cx - w, yTop + size * 0.42);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    // Broadleaf: three overlapping blobs, lit from the upper left.
    const blobs: [number, number, number, string][] = [
      [-size * 0.22, size * 0.1, size * 0.4, p.foliageDark],
      [size * 0.2, size * 0.04, size * 0.36, p.foliageMid],
      [-size * 0.04, -size * 0.18, size * 0.34, p.foliageLight],
    ];
    for (const [dx, dy, r, color] of blobs) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMidCityProp(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    x: number,
    groundLine: number,
    kind: number,
    i: number
  ): void {
    if (kind < 0.42) {
      // Street lamp with a pooled glow.
      const height = 46 + hash(i + 12) * 18;
      ctx.fillStyle = p.trunk;
      ctx.fillRect(x, groundLine - height, 3, height);
      ctx.fillRect(x, groundLine - height, 14, 3);
      const glow = ctx.createRadialGradient(
        x + 13, groundLine - height + 3, 0,
        x + 13, groundLine - height + 3, 34
      );
      glow.addColorStop(0, 'rgba(255, 216, 138, 0.55)');
      glow.addColorStop(1, 'rgba(255, 216, 138, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x + 13, groundLine - height + 3, 34, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind < 0.7) {
      // A neon sign box — the theme's one piece of colour at this depth.
      const w = 26 + hash(i + 31) * 22;
      const hgt = 16 + hash(i + 71) * 12;
      const post = 30;
      const hue = hash(i + 91);
      const neon = hue > 0.66 ? '#F472B6' : hue > 0.33 ? '#22D3EE' : '#A78BFA';
      ctx.fillStyle = p.trunk;
      ctx.fillRect(x + w / 2 - 1, groundLine - post, 2, post);
      ctx.fillStyle = this.shade(p.foliageMid, -0.2);
      ctx.fillRect(x, groundLine - post - hgt, w, hgt);
      ctx.strokeStyle = neon;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, groundLine - post - hgt + 2, w - 4, hgt - 4);
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 2, groundLine - post - hgt + 2, w - 4, hgt - 4);
      ctx.globalAlpha = 1;
      return;
    }

    // Bare city tree.
    this.drawMidTree(ctx, p, x, groundLine, 0.3, i);
  }

  private drawMidDesertProp(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    x: number,
    groundLine: number,
    kind: number,
    i: number
  ): void {
    if (kind < 0.45) {
      // Saguaro.
      const height = 46 + hash(i + 17) * 36;
      const w = 9;
      ctx.fillStyle = p.foliageDark;
      this.roundedBar(ctx, x, groundLine - height, w, height, w / 2);
      // Arms, at least one, sometimes two.
      const armY = groundLine - height * 0.62;
      this.roundedBar(ctx, x - 14, armY, 7, height * 0.34, 3.5);
      ctx.fillRect(x - 14, armY + height * 0.28, 16, 7);
      if (hash(i + 63) > 0.45) {
        const armY2 = groundLine - height * 0.46;
        this.roundedBar(ctx, x + w + 7, armY2, 7, height * 0.26, 3.5);
        ctx.fillRect(x + w - 2, armY2 + height * 0.2, 16, 7);
      }
      // Ribs.
      ctx.strokeStyle = this.shade(p.foliageDark, -0.18);
      ctx.lineWidth = 1;
      for (let r = 1; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(x + (w / 3) * r, groundLine - height + 4);
        ctx.lineTo(x + (w / 3) * r, groundLine - 2);
        ctx.stroke();
      }
      return;
    }

    if (kind < 0.7) {
      // Mesa: a flat-topped rock, stratified.
      const w = 48 + hash(i + 27) * 46;
      const hgt = 30 + hash(i + 37) * 34;
      const y = groundLine - hgt;
      ctx.fillStyle = this.shade(p.ridgeNear, -0.12);
      ctx.beginPath();
      ctx.moveTo(x, groundLine);
      ctx.lineTo(x + w * 0.1, y);
      ctx.lineTo(x + w * 0.9, y);
      ctx.lineTo(x + w, groundLine);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#FFFFFF';
      for (let s = 1; s < 4; s++) {
        ctx.fillRect(x + w * 0.08, y + (hgt / 4) * s, w * 0.84, 2);
      }
      ctx.globalAlpha = 1;
      return;
    }

    // Sun-bleached skull-white scrub.
    ctx.fillStyle = p.foliageMid;
    for (let b = 0; b < 4; b++) {
      const r = 5 + hash(i * 3 + b) * 7;
      ctx.beginPath();
      ctx.arc(x + b * 9, groundLine - r * 0.6, r, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----------------------------------------------------------- near band ---

  private drawNear(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    const slot = 46;
    const count = Math.round(width / slot);
    for (let i = 0; i < count; i++) {
      const x = (i / count) * width + hash(i + 7) * 18;
      const kind = hash(i + 211);
      const dark = this.shade(p.foliageDark, -0.22);

      if (kind < 0.42) {
        // Bush: a cluster of arcs sitting on the band floor.
        const size = 11 + hash(i + 331) * 10;
        ctx.fillStyle = dark;
        for (let b = 0; b < 3; b++) {
          const bx = x + b * size * 0.62;
          const br = size * (0.62 + hash(i * 5 + b) * 0.42);
          ctx.beginPath();
          ctx.arc(bx, h - br * 0.25, br, Math.PI, Math.PI * 2);
          ctx.fill();
        }
        // A lit rim along the top of the bush.
        ctx.fillStyle = this.shade(p.foliageMid, -0.1);
        ctx.beginPath();
        ctx.arc(x + size * 0.62, h - size * 0.32, size * 0.5, Math.PI, Math.PI * 2);
        ctx.fill();
      } else if (kind < 0.62) {
        // Fence post, occasionally with a rail running off it.
        const height = 20 + hash(i + 401) * 14;
        ctx.fillStyle = dark;
        ctx.fillRect(x, h - height, 5, height);
        ctx.fillRect(x - 1, h - height - 3, 7, 3);
        if (hash(i + 421) > 0.5) ctx.fillRect(x + 5, h - height * 0.7, slot, 3);
      } else if (kind < 0.78) {
        // Tall grass tuft.
        ctx.strokeStyle = dark;
        ctx.lineWidth = 2;
        for (let b = 0; b < 5; b++) {
          const bx = x + b * 3;
          const bh = 10 + hash(i * 9 + b) * 16;
          ctx.beginPath();
          ctx.moveTo(bx, h);
          ctx.quadraticCurveTo(bx + 3, h - bh * 0.6, bx + (b - 2) * 2, h - bh);
          ctx.stroke();
        }
      } else if (kind < 0.9) {
        // Stones.
        ctx.fillStyle = dark;
        for (let r = 0; r < 3; r++) {
          const rs = 3 + hash(i * 11 + r) * 6;
          ctx.beginPath();
          ctx.ellipse(x + r * 9, h - rs * 0.4, rs, rs * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The remaining tenth is left empty, so the band breathes.
    }
  }

  /**
   * Foreground silhouettes: grass blades, branches and rocks along the very
   * bottom of the frame, almost black so they never compete with the runner.
   */
  private drawForeground(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    const ink = this.shade(p.groundDeep, -0.55);
    // Sparse: a dense band reads as a fence rather than as foreground.
    const slot = 78;
    const count = Math.round(width / slot);

    for (let i = 0; i < count; i++) {
      const x = (i / count) * width + hash(i + 17) * 24;
      const kind = hash(i + 601);
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;

      if (kind < 0.46) {
        // A fan of tall blades reaching up from the bottom edge.
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const blades = 4 + Math.floor(hash(i + 71) * 4);
        for (let b = 0; b < blades; b++) {
          const bx = x + b * 7;
          const bh = 20 + hash(i * 13 + b) * 30;
          ctx.beginPath();
          ctx.moveTo(bx, h);
          ctx.quadraticCurveTo(bx + 7, h - bh * 0.6, bx + (b - 2) * 5, h - bh);
          ctx.stroke();
        }
      } else if (kind < 0.62) {
        // A boulder breaking the bottom edge.
        const r = 20 + hash(i + 133) * 18;
        ctx.beginPath();
        ctx.ellipse(x, h - r * 0.2, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind < 0.74) {
        // A branch leaning in, with a few leaf clumps.
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 24, h);
        ctx.quadraticCurveTo(x + 4, h - 20, x + 44, h - 34);
        ctx.stroke();
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          ctx.ellipse(x + 10 + l * 15, h - 18 - l * 7, 10, 6, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The rest is empty: the band has to breathe or it becomes a fence.
    }
  }

  // ------------------------------------------------------------- clouds ---

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    width: number,
    h: number
  ): void {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * width + hash(i + 3) * 90;
      const y = 26 + hash(i + 61) * (h - 90);
      const scale = 0.7 + hash(i + 97) * 0.8;
      // Under a canopy the sky is mist, not weather — no cumulus there.
      const wispy = p.skyline === 'canopy' || hash(i + 131) > 0.62;
      ctx.globalAlpha = p.cloudAlpha * (0.55 + hash(i + 151) * 0.45);

      if (wispy) {
        ctx.fillStyle = p.cloudLight;
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.ellipse(
            x + s * 34 * scale,
            y + Math.sin(s + i) * 6,
            48 * scale,
            5 * scale,
            0.06,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      } else {
        // Cumulus: shadowed base, lit crown.
        const puffs: [number, number, number][] = [
          [0, 6, 22],
          [24, 2, 28],
          [52, 7, 20],
          [20, -12, 20],
          [40, -8, 16],
        ];
        ctx.fillStyle = p.cloudShadow;
        for (const [dx, dy, r] of puffs) {
          ctx.beginPath();
          ctx.arc(x + dx * scale, y + (dy + 6) * scale, r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = p.cloudLight;
        for (const [dx, dy, r] of puffs) {
          ctx.beginPath();
          ctx.arc(x + dx * scale, y + dy * scale, r * 0.92 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- motes ---

  private updateMotes(dt: number, scrollDelta: number): void {
    if (this.moteBudget === 0) return;

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.life -= dt;
      m.phase += dt;
      m.x += (m.vx - scrollDelta * 0.25) * dt;
      m.y += m.vy * dt;
      if (m.life <= 0 || m.x < -40 || m.y > this.groundY + 20 || m.y < -40) {
        this.motes.splice(i, 1);
      }
    }
  }

  private spawnMote(p: ThemePalette): void {
    const edgeX = this.canvasWidth + 20 + Math.random() * 80;
    switch (p.ambient) {
      case 'pollen':
        this.motes.push({
          x: edgeX,
          y: Math.random() * (this.groundY - 40),
          vx: -20 - Math.random() * 30,
          vy: -6 + Math.random() * 12,
          size: 1.5 + Math.random() * 2,
          life: 6,
          maxLife: 6,
          phase: Math.random() * 6,
        });
        break;
      case 'embers':
        this.motes.push({
          x: Math.random() * this.canvasWidth,
          y: this.groundY - Math.random() * 30,
          vx: -30 - Math.random() * 40,
          vy: -18 - Math.random() * 34,
          size: 1.5 + Math.random() * 2.5,
          life: 2.6,
          maxLife: 2.6,
          phase: Math.random() * 6,
        });
        break;
      case 'fireflies':
        this.motes.push({
          x: Math.random() * (this.canvasWidth + 60),
          y: this.groundY - 40 - Math.random() * 180,
          vx: -24 - Math.random() * 26,
          vy: -8 + Math.random() * 16,
          size: 2 + Math.random() * 1.6,
          life: 5,
          maxLife: 5,
          phase: Math.random() * 6,
        });
        break;
      case 'sand':
        this.motes.push({
          x: edgeX,
          y: this.groundY - Math.random() * 110,
          vx: -150 - Math.random() * 140,
          vy: -4 + Math.random() * 10,
          size: 1 + Math.random() * 1.6,
          life: 2.2,
          maxLife: 2.2,
          phase: Math.random() * 6,
        });
        break;
      case 'leaves':
        this.motes.push({
          x: edgeX,
          y: -20 - Math.random() * 60,
          vx: -40 - Math.random() * 40,
          vy: 24 + Math.random() * 28,
          size: 3 + Math.random() * 3,
          life: 9,
          maxLife: 9,
          phase: Math.random() * 6,
        });
        break;
    }
  }

  private renderMotes(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    this.moteBudget =
      p.ambient === 'sand' ? 70 : p.ambient === 'fireflies' ? 22 : 36;
    // Top up gradually so a theme change does not pop a full field into view.
    if (this.motes.length < this.moteBudget && Math.random() < 0.55) {
      this.spawnMote(p);
    }

    ctx.save();
    for (const m of this.motes) {
      const fade = Math.min(1, m.life / (m.maxLife * 0.3));
      switch (p.ambient) {
        case 'pollen':
          ctx.globalAlpha = 0.5 * fade;
          ctx.fillStyle = '#FFF6C9';
          ctx.beginPath();
          ctx.arc(m.x, m.y + Math.sin(m.phase * 2) * 6, m.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'embers':
          ctx.globalAlpha = 0.85 * fade;
          ctx.fillStyle = m.phase % 1 > 0.5 ? '#FFD37A' : '#FF7A3C';
          ctx.fillRect(m.x, m.y + Math.sin(m.phase * 5) * 3, m.size, m.size);
          break;
        case 'fireflies': {
          // Firefly light is a slow on/off, not a steady dot.
          const blink = Math.max(0, Math.sin(m.phase * 2.2));
          ctx.globalAlpha = blink * fade;
          const y = m.y + Math.sin(m.phase * 1.6) * 10;
          const glow = ctx.createRadialGradient(m.x, y, 0, m.x, y, m.size * 2.6);
          glow.addColorStop(0, 'rgba(214, 255, 160, 0.85)');
          glow.addColorStop(0.35, 'rgba(180, 255, 110, 0.35)');
          glow.addColorStop(1, 'rgba(160, 255, 90, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(m.x, y, m.size * 2.6, 0, Math.PI * 2);
          ctx.fill();
          // A hard point at the centre, so it reads as a light not a smudge.
          ctx.fillStyle = 'rgba(240, 255, 210, 0.95)';
          ctx.fillRect(m.x - 0.75, y - 0.75, 1.5, 1.5);
          break;
        }
        case 'sand':
          ctx.globalAlpha = 0.35 * fade;
          ctx.fillStyle = '#F6E3B4';
          ctx.fillRect(m.x, m.y, m.size * 5, m.size * 0.7);
          break;
        case 'leaves': {
          ctx.globalAlpha = 0.8 * fade;
          const tint = m.size > 4.5 ? '#C97A2E' : m.size > 3.8 ? '#8FA83C' : '#D9A441';
          ctx.fillStyle = tint;
          ctx.save();
          ctx.translate(m.x + Math.sin(m.phase * 1.8) * 18, m.y);
          ctx.rotate(m.phase * 2);
          ctx.beginPath();
          ctx.ellipse(0, 0, m.size, m.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- colour ---

  /** Mix a hex colour toward white (amount > 0) or black (amount < 0). */
  private shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const to = amount > 0 ? 255 : 0;
    const t = Math.abs(amount);
    const r = Math.round((n >> 16) + (to - (n >> 16)) * t);
    const g = Math.round(((n >> 8) & 255) + (to - ((n >> 8) & 255)) * t);
    const b = Math.round((n & 255) + (to - (n & 255)) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private withAlpha(color: string, alpha: number): string {
    if (color.startsWith('rgba')) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }
    if (color.startsWith('#')) {
      const n = parseInt(color.slice(1), 16);
      return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }
    return color;
  }

  private roundedBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 2);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
}
