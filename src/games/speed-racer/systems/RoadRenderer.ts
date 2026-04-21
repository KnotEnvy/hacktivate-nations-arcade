import { ROAD, SCENERY } from '../data/constants';
import type { SectionPalette } from '../data/sections';

const BUILDING_BLOCK_HEIGHT = 200; // vertical spacing between building rows

export class RoadRenderer {
  private worldScroll = 0;

  reset(): void {
    this.worldScroll = 0;
  }

  update(speed: number, dt: number): void {
    this.worldScroll += speed * dt;
  }

  getScroll(): number {
    return this.worldScroll;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, palette: SectionPalette): void {
    this.renderBackground(ctx, w, h, palette);
    this.renderHorizonGlow(ctx, w, h, palette);
    this.renderScenery(ctx, w, h, palette);
    this.renderRoadBody(ctx, w, h, palette);
    this.renderRoadEdges(ctx, h, palette);
    this.renderLaneMarkings(ctx, h, palette);
    this.renderRoadsidePosts(ctx, h, palette);
  }

  // -- Layers ------------------------------------------------------------

  private renderBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.grassTop);
    grad.addColorStop(1, palette.grassBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private renderHorizonGlow(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    if (palette.horizonAlpha <= 0) return;
    const glowH = h * 0.32;
    const grad = ctx.createLinearGradient(0, 0, 0, glowH);
    grad.addColorStop(0, this.withAlpha(palette.horizonColor, palette.horizonAlpha));
    grad.addColorStop(1, this.withAlpha(palette.horizonColor, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, glowH);
  }

  private renderRoadBody(
    ctx: CanvasRenderingContext2D,
    _w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Subtle horizontal gradient for depth — darker near edges, lighter in the middle
    const grad = ctx.createLinearGradient(ROAD.X_MIN, 0, ROAD.X_MAX, 0);
    grad.addColorStop(0, palette.roadShadeColor);
    grad.addColorStop(0.15, palette.roadColor);
    grad.addColorStop(0.85, palette.roadColor);
    grad.addColorStop(1, palette.roadShadeColor);
    ctx.fillStyle = grad;
    ctx.fillRect(ROAD.X_MIN, 0, ROAD.WIDTH, h);
  }

  private renderRoadEdges(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
  ): void {
    ctx.save();
    ctx.strokeStyle = palette.edgeColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = palette.edgeGlowColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(ROAD.X_MIN, 0);
    ctx.lineTo(ROAD.X_MIN, h);
    ctx.moveTo(ROAD.X_MAX, 0);
    ctx.lineTo(ROAD.X_MAX, h);
    ctx.stroke();
    ctx.restore();
  }

  private renderLaneMarkings(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
  ): void {
    const laneStep = ROAD.WIDTH / ROAD.LANE_COUNT;
    for (let i = 1; i < ROAD.LANE_COUNT; i++) {
      const x = ROAD.X_MIN + laneStep * i;
      const isCenter = i === ROAD.LANE_COUNT / 2;
      if (isCenter) {
        this.drawDashedLine(ctx, x, h, 30, 22, palette.centerLineColor, 3);
      } else {
        this.drawDashedLine(ctx, x, h, 24, 28, palette.laneLineColor, 2);
      }
    }
  }

  private drawDashedLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    h: number,
    dashLen: number,
    gapLen: number,
    color: string,
    width: number,
  ): void {
    const cycle = dashLen + gapLen;
    // worldScroll grows as the car moves forward. The pattern must drift
    // DOWN the screen (toward the player) so objects appear to come out of
    // the horizon. Starting y at (offset - cycle) achieves that.
    const offset = ((this.worldScroll % cycle) + cycle) % cycle;
    let y = offset - cycle;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    while (y < h) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + dashLen);
      y += cycle;
    }
    ctx.stroke();
  }

  private renderRoadsidePosts(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
  ): void {
    const offset =
      ((this.worldScroll % SCENERY.POST_SPACING) + SCENERY.POST_SPACING) %
      SCENERY.POST_SPACING;
    let y = offset - SCENERY.POST_SPACING;
    while (y < h) {
      if (palette.sceneryStyle === 'buildings') {
        this.drawStreetLamp(ctx, ROAD.X_MIN - 14, y, palette);
        this.drawStreetLamp(ctx, ROAD.X_MAX + 6, y, palette);
      } else {
        this.drawHighwayPost(ctx, ROAD.X_MIN - 12, y, palette);
        this.drawHighwayPost(ctx, ROAD.X_MAX + 8, y, palette);
      }
      y += SCENERY.POST_SPACING;
    }
  }

  private drawHighwayPost(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    palette: SectionPalette,
  ): void {
    ctx.fillStyle = palette.postColor;
    ctx.fillRect(x, y, 4, 14);
    ctx.fillStyle = palette.postAccent;
    ctx.fillRect(x, y + 4, 4, 6);
  }

  private drawStreetLamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    palette: SectionPalette,
  ): void {
    // Tall thin pole with a glowing head
    ctx.fillStyle = palette.postAccent;
    ctx.fillRect(x + 1, y + 4, 2, 18);
    // Lamp head
    ctx.save();
    ctx.shadowColor = palette.postColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = palette.postColor;
    ctx.fillRect(x - 1, y, 6, 4);
    ctx.restore();
  }

  // -- Scenery dispatch --------------------------------------------------

  private renderScenery(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    switch (palette.sceneryStyle) {
      case 'buildings':
        this.renderBuildings(ctx, w, h, palette);
        return;
      case 'bridge':
        this.renderBridge(ctx, w, h, palette);
        return;
      case 'mountain':
        this.renderMountains(ctx, w, h, palette);
        return;
      case 'coast':
        this.renderCoast(ctx, w, h, palette);
        return;
      case 'water':
        this.renderWater(ctx, w, h, palette);
        return;
      case 'ice':
        this.renderIce(ctx, w, h, palette);
        return;
      case 'trees':
      default:
        this.renderTrees(ctx, w, h, palette);
    }
  }

  // -- Water -------------------------------------------------------------
  // Open harbor: rolling wave bands across the off-road areas, plus the
  // occasional buoy or moored boat on each side.

  private renderWater(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Rolling wave lines on both sides of the road
    const cycle = 36;
    const offset = ((this.worldScroll * 0.55) % cycle + cycle) % cycle;
    ctx.save();
    ctx.strokeStyle = palette.sceneryAccent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    for (let y = offset - cycle; y < h; y += cycle) {
      this.drawWaveCurve(ctx, 14, y, 140);
      this.drawWaveCurve(ctx, 30, y + cycle * 0.5, 110);
      this.drawWaveCurve(ctx, w - 154, y + cycle * 0.25, 140);
      this.drawWaveCurve(ctx, w - 130, y + cycle * 0.75, 110);
    }
    ctx.restore();

    // Buoys: small dots that scroll with parallax — deterministic seeded blocks
    const blockH = 180;
    const parallax = 0.7;
    const scrolled = this.worldScroll * parallax;
    const blockOffset = ((scrolled % blockH) + blockH) % blockH;
    let block = Math.floor(scrolled / blockH);
    let y = blockOffset - blockH;
    while (y < h + blockH) {
      this.drawBuoy(ctx, 80, y + 30, hash(block, 31), palette);
      this.drawBuoy(ctx, w - 80, y + 110, hash(block, 32), palette);
      y += blockH;
      block -= 1;
    }
  }

  private drawBuoy(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    seed: number,
    palette: SectionPalette,
  ): void {
    const rnd = seededRandom(seed);
    const bobble = Math.sin(this.worldScroll * 0.05 + (seed % 9)) * 2;
    const yy = y + bobble;
    // Float
    ctx.fillStyle = palette.sceneryAccent;
    ctx.beginPath();
    ctx.ellipse(x, yy, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pole
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(x - 1, yy - 12, 2, 9);
    // Light at top — pulses
    if (rnd() > 0.4) {
      ctx.save();
      ctx.shadowColor = palette.sceneryAccent;
      ctx.shadowBlur = 6;
      ctx.fillStyle = palette.sceneryAccent;
      ctx.beginPath();
      ctx.arc(x, yy - 14, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // -- Ice ---------------------------------------------------------------
  // Snowy embankments, faint surface cracks across the road, and a falling
  // snow overlay. Snowflakes drift down regardless of player speed.

  private renderIce(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Snow drift mounds along the road edges
    const cycle = 110;
    const offset = ((this.worldScroll * 0.5) % cycle + cycle) % cycle;
    ctx.save();
    ctx.fillStyle = palette.sceneryAccent;
    ctx.globalAlpha = 0.85;
    for (let y = offset - cycle; y < h + cycle; y += cycle) {
      // Left bank
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(80, y + cycle * 0.3, 0, y + cycle);
      ctx.lineTo(0, y);
      ctx.fill();
      // Right bank
      ctx.beginPath();
      ctx.moveTo(w, y + cycle * 0.4);
      ctx.quadraticCurveTo(w - 80, y + cycle * 0.7, w, y + cycle * 1.4);
      ctx.lineTo(w, y + cycle * 0.4);
      ctx.fill();
    }
    ctx.restore();

    // Pine trees on the embankments — sparse, snow-tipped
    const blockH = 200;
    const parallax = 0.55;
    const scrolled = this.worldScroll * parallax;
    const blockOffset = ((scrolled % blockH) + blockH) % blockH;
    let block = Math.floor(scrolled / blockH);
    let y = blockOffset - blockH;
    while (y < h + blockH) {
      this.drawSnowyPine(ctx, 60, y + 30, hash(block, 41), palette);
      this.drawSnowyPine(ctx, 110, y + 110, hash(block, 42), palette);
      this.drawSnowyPine(ctx, w - 60, y + 30, hash(block, 43), palette);
      this.drawSnowyPine(ctx, w - 110, y + 110, hash(block, 44), palette);
      y += blockH;
      block -= 1;
    }

    // Falling snow overlay — drifts from top, wraps at bottom. Independent of
    // worldScroll so the storm looks consistent even when the player brakes.
    this.renderSnowfall(ctx, w, h);
  }

  private drawSnowyPine(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    seed: number,
    palette: SectionPalette,
  ): void {
    const rnd = seededRandom(seed);
    const treeH = 40 + rnd() * 22;
    const treeW = 18 + rnd() * 10;
    // Triangular silhouette
    ctx.fillStyle = palette.sceneryColor;
    ctx.beginPath();
    ctx.moveTo(cx, y - treeH);
    ctx.lineTo(cx - treeW / 2, y);
    ctx.lineTo(cx + treeW / 2, y);
    ctx.closePath();
    ctx.fill();
    // Snow cap on the upper half
    ctx.fillStyle = palette.sceneryAccent;
    ctx.beginPath();
    ctx.moveTo(cx, y - treeH);
    ctx.lineTo(cx - treeW * 0.32, y - treeH * 0.45);
    ctx.lineTo(cx + treeW * 0.32, y - treeH * 0.45);
    ctx.closePath();
    ctx.fill();
    // Trunk
    ctx.fillStyle = palette.sceneryRimColor;
    ctx.fillRect(cx - 1.5, y, 3, 4);
  }

  private renderSnowfall(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 60 flakes — positions seeded once per frame using worldScroll as time
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    const flakes = 60;
    const t = this.worldScroll * 0.3;
    for (let i = 0; i < flakes; i++) {
      const seed = i * 9301 + 49297;
      const baseX = (seed % w);
      const baseY = ((seed * 7) % h);
      const fall = (t * (0.6 + ((seed >>> 3) % 5) * 0.2)) % h;
      const drift = Math.sin((t * 0.02) + i) * 6;
      const x = (baseX + drift + w) % w;
      const y = (baseY + fall) % h;
      const size = 1 + (i % 3) * 0.6;
      ctx.globalAlpha = 0.45 + (i % 3) * 0.15;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  private renderTrees(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    const rawOffset = (this.worldScroll * SCENERY.TREE_PARALLAX) % SCENERY.TREE_SPACING;
    const offset = (rawOffset + SCENERY.TREE_SPACING) % SCENERY.TREE_SPACING;
    let y = offset - SCENERY.TREE_SPACING;
    while (y < h) {
      this.drawTree(ctx, 60, y, 14, palette);
      this.drawTree(ctx, 110, y + 90, 11, palette);
      this.drawTree(ctx, w - 60, y, 14, palette);
      this.drawTree(ctx, w - 110, y + 90, 11, palette);
      y += SCENERY.TREE_SPACING;
    }
  }

  private drawTree(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    palette: SectionPalette,
  ): void {
    // Soft canopy with a rim accent
    ctx.fillStyle = palette.sceneryColor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.sceneryRimColor;
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Trunk
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(x - 2, y, 4, r);
  }

  // -- Buildings ---------------------------------------------------------

  private renderBuildings(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    const parallax = SCENERY.TREE_PARALLAX;
    const scrolled = this.worldScroll * parallax;
    const offset =
      ((scrolled % BUILDING_BLOCK_HEIGHT) + BUILDING_BLOCK_HEIGHT) %
      BUILDING_BLOCK_HEIGHT;
    const baseBlock = Math.floor(scrolled / BUILDING_BLOCK_HEIGHT);

    // Render top-to-bottom; buildings further from the road are taller.
    let screenY = offset - BUILDING_BLOCK_HEIGHT;
    let block = baseBlock;
    while (screenY < h + BUILDING_BLOCK_HEIGHT) {
      // Two buildings per side per block — back row + front row, offset vertically.
      this.drawBuilding(ctx, 18, screenY, 70, hash(block, 1), 'left', palette);
      this.drawBuilding(ctx, 92, screenY + 92, 50, hash(block, 2), 'left', palette);
      this.drawBuilding(ctx, w - 18, screenY, 70, hash(block, 3), 'right', palette);
      this.drawBuilding(ctx, w - 92, screenY + 92, 50, hash(block, 4), 'right', palette);
      screenY += BUILDING_BLOCK_HEIGHT;
      block -= 1;
    }
  }

  private drawBuilding(
    ctx: CanvasRenderingContext2D,
    anchorX: number,
    y: number,
    maxWidth: number,
    seed: number,
    side: 'left' | 'right',
    palette: SectionPalette,
  ): void {
    const rnd = seededRandom(seed);
    const width = Math.floor(28 + rnd() * (maxWidth - 28));
    const height = Math.floor(70 + rnd() * 110);
    const x = side === 'left' ? anchorX : anchorX - width;

    // Silhouette
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(x, y, width, height);

    // Rim highlight on the road-facing edge
    ctx.fillStyle = palette.sceneryRimColor;
    if (side === 'left') {
      ctx.fillRect(x + width - 1, y, 1, height);
    } else {
      ctx.fillRect(x, y, 1, height);
    }

    // Optional rooftop detail (antenna or water tower) on taller buildings
    if (height > 140 && rnd() > 0.5) {
      const antennaX = x + Math.floor(width * (0.3 + rnd() * 0.4));
      ctx.fillStyle = palette.sceneryColor;
      ctx.fillRect(antennaX, y - 8, 2, 8);
    }

    // Window grid — small lit/unlit cells. Stable because RNG is seeded per block.
    const cellW = 5;
    const cellH = 7;
    const padX = 3;
    const padY = 6;
    const cols = Math.floor((width - padX * 2) / cellW);
    const rows = Math.floor((height - padY * 2) / cellH);
    if (cols <= 0 || rows <= 0) return;

    ctx.save();
    ctx.shadowColor = palette.sceneryAccent;
    ctx.shadowBlur = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rnd() > 0.55;
        if (!lit) continue;
        const wx = x + padX + c * cellW;
        const wy = y + padY + r * cellH;
        ctx.fillStyle = palette.sceneryAccent;
        ctx.fillRect(wx, wy, 2, 3);
      }
    }
    ctx.restore();
  }

  // -- Bridge ------------------------------------------------------------

  private renderBridge(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Faint shimmer lines suggesting water far below
    this.renderWaterShimmer(ctx, w, h, palette);

    const parallax = SCENERY.TREE_PARALLAX;
    const blockH = 280;
    const scrolled = this.worldScroll * parallax;
    const offset = ((scrolled % blockH) + blockH) % blockH;
    let block = Math.floor(scrolled / blockH);
    let y = offset - blockH;
    while (y < h + blockH) {
      this.drawBridgeTower(ctx, 50, y, block, palette);
      this.drawBridgeTower(ctx, w - 50, y, block + 1000, palette);
      y += blockH;
      block -= 1;
    }
  }

  private renderWaterShimmer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    const cycle = 90;
    const offset = ((this.worldScroll * 0.25) % cycle + cycle) % cycle;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = palette.sceneryRimColor;
    for (let y = offset - cycle; y < h; y += cycle) {
      // Two thin shimmer lines on each off-road strip
      ctx.fillRect(10, y, 140, 1);
      ctx.fillRect(20, y + 30, 100, 1);
      ctx.fillRect(w - 150, y, 140, 1);
      ctx.fillRect(w - 120, y + 30, 100, 1);
    }
    ctx.restore();
  }

  private drawBridgeTower(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    seed: number,
    palette: SectionPalette,
  ): void {
    const towerW = 38;
    const towerH = 240;
    const x = cx - towerW / 2;

    // Outer steel column
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(x, y, towerW, towerH);

    // Inner cutout to expose cross-bracing
    ctx.fillStyle = palette.grassBottom;
    ctx.fillRect(x + 5, y + 14, towerW - 10, towerH - 28);

    // Cross braces (X pattern in each segment)
    ctx.save();
    ctx.strokeStyle = palette.sceneryRimColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const segments = 6;
    const segH = (towerH - 28) / segments;
    for (let i = 0; i < segments; i++) {
      const sy = y + 14 + i * segH;
      ctx.moveTo(x + 5, sy);
      ctx.lineTo(x + towerW - 5, sy + segH);
      ctx.moveTo(x + towerW - 5, sy);
      ctx.lineTo(x + 5, sy + segH);
    }
    ctx.stroke();
    ctx.restore();

    // Top crossbeam cap
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(x - 4, y - 2, towerW + 8, 6);

    // Warning light — pulses based on tower position so each blinks independently
    const pulse = 0.55 + 0.45 * Math.sin(this.worldScroll * 0.04 + (seed % 7));
    ctx.save();
    ctx.shadowColor = palette.sceneryAccent;
    ctx.shadowBlur = 10 * pulse;
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.fillStyle = palette.sceneryAccent;
    ctx.fillRect(cx - 3, y - 8, 6, 5);
    ctx.restore();
  }

  // -- Mountains ---------------------------------------------------------

  private renderMountains(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Distant ridge — slower parallax, smaller peaks
    this.renderMountainLayer(ctx, w, h, 0.32, 320, 60, 90, palette, 0.55);
    // Mid ridge
    this.renderMountainLayer(ctx, w, h, 0.5, 240, 90, 130, palette, 0.85);
    // Near ridge — closer, taller, fully opaque
    this.renderMountainLayer(ctx, w, h, 0.7, 200, 110, 170, palette, 1);
  }

  private renderMountainLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    parallax: number,
    blockH: number,
    minH: number,
    maxH: number,
    palette: SectionPalette,
    opacity: number,
  ): void {
    const scrolled = this.worldScroll * parallax;
    const offset = ((scrolled % blockH) + blockH) % blockH;
    let block = Math.floor(scrolled / blockH);
    let y = offset - blockH;

    ctx.save();
    ctx.globalAlpha = opacity;
    while (y < h + blockH) {
      this.drawMountainPeak(ctx, 70, y, hash(block, 11), minH, maxH, palette);
      this.drawMountainPeak(ctx, 130, y + blockH * 0.4, hash(block, 12), minH * 0.8, maxH * 0.85, palette);
      this.drawMountainPeak(ctx, w - 70, y, hash(block, 13), minH, maxH, palette);
      this.drawMountainPeak(ctx, w - 130, y + blockH * 0.4, hash(block, 14), minH * 0.8, maxH * 0.85, palette);
      y += blockH;
      block -= 1;
    }
    ctx.restore();
  }

  private drawMountainPeak(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    seed: number,
    minH: number,
    maxH: number,
    palette: SectionPalette,
  ): void {
    const rnd = seededRandom(seed);
    const peakW = 80 + rnd() * 50;
    const peakH = minH + rnd() * (maxH - minH);
    const apexOffset = (rnd() - 0.5) * peakW * 0.3;
    const ax = cx - peakW / 2;
    const apex = cx + apexOffset;
    const apexY = y;
    const baseY = y + peakH;

    // Mountain triangle silhouette
    ctx.fillStyle = palette.sceneryColor;
    ctx.beginPath();
    ctx.moveTo(ax, baseY);
    ctx.lineTo(apex, apexY);
    ctx.lineTo(ax + peakW, baseY);
    ctx.closePath();
    ctx.fill();

    // Shadow side (right of apex)
    ctx.fillStyle = palette.sceneryRimColor;
    ctx.beginPath();
    ctx.moveTo(apex, apexY);
    ctx.lineTo(ax + peakW, baseY);
    ctx.lineTo(apex + (ax + peakW - apex) * 0.45, baseY);
    ctx.closePath();
    ctx.fill();

    // Snow cap — small triangle anchored at apex
    if (peakH > 80) {
      const capDepth = Math.min(28, peakH * 0.22);
      const capSpread = peakW * 0.22;
      ctx.fillStyle = palette.sceneryAccent;
      ctx.beginPath();
      ctx.moveTo(apex, apexY);
      ctx.lineTo(apex - capSpread * 0.8, apexY + capDepth);
      ctx.lineTo(apex - capSpread * 0.2, apexY + capDepth * 0.6);
      ctx.lineTo(apex + capSpread * 0.2, apexY + capDepth * 0.9);
      ctx.lineTo(apex + capSpread * 0.8, apexY + capDepth * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -- Coast -------------------------------------------------------------

  private renderCoast(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Horizontal sun streaks across the upper grass — synthwave sunset feel
    this.renderSunStreaks(ctx, w, h, palette);
    // Wave lines along the outer edges
    this.renderWaveLines(ctx, w, h, palette);

    const parallax = SCENERY.TREE_PARALLAX;
    const blockH = 220;
    const scrolled = this.worldScroll * parallax;
    const offset = ((scrolled % blockH) + blockH) % blockH;
    let block = Math.floor(scrolled / blockH);
    let y = offset - blockH;
    while (y < h + blockH) {
      this.drawPalmTree(ctx, 60, y + 20, hash(block, 21), palette);
      this.drawPalmTree(ctx, 120, y + 110, hash(block, 22), palette);
      this.drawPalmTree(ctx, w - 60, y + 20, hash(block, 23), palette);
      this.drawPalmTree(ctx, w - 120, y + 110, hash(block, 24), palette);
      y += blockH;
      block -= 1;
    }
  }

  private renderSunStreaks(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    // Static horizontal bars near the top — feel of a setting sun on water
    const startY = h * 0.06;
    const bars = 6;
    const gap = 5;
    const barH = 3;
    ctx.save();
    for (let i = 0; i < bars; i++) {
      const alpha = 0.5 - i * 0.06;
      ctx.fillStyle = this.withAlpha(palette.sceneryAccent, Math.max(0.05, alpha));
      const y = startY + i * (barH + gap);
      ctx.fillRect(0, y, w, barH);
    }
    ctx.restore();
  }

  private renderWaveLines(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
  ): void {
    const cycle = 64;
    const offset = ((this.worldScroll * 0.45) % cycle + cycle) % cycle;
    ctx.save();
    ctx.strokeStyle = palette.sceneryAccent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let y = offset - cycle; y < h; y += cycle) {
      this.drawWaveCurve(ctx, 18, y, 130);
      this.drawWaveCurve(ctx, w - 148, y + cycle / 2, 130);
    }
    ctx.restore();
  }

  private drawWaveCurve(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + width * 0.3, y - 4, x + width * 0.7, y + 4, x + width, y);
    ctx.stroke();
  }

  private drawPalmTree(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    seed: number,
    palette: SectionPalette,
  ): void {
    const rnd = seededRandom(seed);
    const trunkH = 44 + rnd() * 26;
    const trunkW = 3;
    const tilt = (rnd() - 0.5) * 0.18; // radians

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Trunk
    ctx.fillStyle = palette.sceneryColor;
    ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);

    // Coconut cluster (small dark blob at trunk top)
    ctx.beginPath();
    ctx.arc(0, -trunkH, 3, 0, Math.PI * 2);
    ctx.fill();

    // Fronds — 7 leaves fanning outward from the top
    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / (frondCount - 1)) * Math.PI - Math.PI; // -PI..0 (above)
      const len = 14 + rnd() * 8;
      ctx.save();
      ctx.translate(0, -trunkH);
      ctx.rotate(angle);
      ctx.fillStyle = palette.sceneryColor;
      ctx.beginPath();
      ctx.ellipse(len / 2, 0, len / 2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rim highlight on the leading edge
      ctx.fillStyle = palette.sceneryRimColor;
      ctx.beginPath();
      ctx.ellipse(len / 2, -1, len / 2, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // -- Helpers -----------------------------------------------------------

  private withAlpha(hex: string, alpha: number): string {
    // Accepts #RGB or #RRGGBB
    const a = Math.max(0, Math.min(1, alpha));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${a})`;
  }
}

// Deterministic LCG for stable per-block scenery.
function seededRandom(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    // Convert to 0..1
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function hash(blockIndex: number, salt: number): number {
  // Combine block + salt into a single seed; XOR + multiply for spread
  let h = (blockIndex * 374761393 + salt * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return h ^ (h >>> 16);
}
