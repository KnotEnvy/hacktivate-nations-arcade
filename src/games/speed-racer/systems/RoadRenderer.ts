import { SCENERY } from '../data/constants';
import type { SectionPalette, TunnelZone } from '../data/sections';
import type { RoadProfile } from './RoadProfile';

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

  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SectionPalette,
    profile: RoadProfile,
  ): void {
    this.renderBackground(ctx, w, h, palette);
    this.renderHorizonGlow(ctx, w, h, palette);
    this.renderScenery(ctx, w, h, palette);
    this.renderRoadBody(ctx, w, h, palette, profile);
    // Divider draws between body and edges so the inner edge strokes
    // overlap onto the divider concrete cleanly.
    if (!profile.isUniform()) this.renderDivider(ctx, h, profile);
    this.renderRoadEdges(ctx, h, palette, profile);
    this.renderLaneMarkings(ctx, h, palette, profile);
    this.renderRoadsidePosts(ctx, h, palette, profile);
  }

  // Top-layer tunnel overlay. Called by SpeedRacerGame AFTER entities + the
  // particle layer so the darkness covers everything inside the tunnel
  // (you can't see traffic clearly in the dark either). Per-row darkness
  // ramps in/out across each zone's edges so the entry/exit reads as
  // gradual rather than a hard cut.
  renderTunnelOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    profile: RoadProfile,
    zones: ReadonlyArray<TunnelZone> | undefined,
  ): void {
    if (!zones || zones.length === 0) return;
    const FADE_LENGTH = 100;
    const MAX_DARKNESS = 0.85;

    // Run-accumulate identical-darkness rows so the sustained interior
    // collapses to one fillRect.
    type Run = { startY: number; alpha: number };
    let run: Run | null = null;

    const flush = (endY: number): void => {
      if (!run || run.alpha <= 0) {
        run = null;
        return;
      }
      ctx.fillStyle = `rgba(8, 6, 24, ${run.alpha.toFixed(3)})`;
      ctx.fillRect(0, run.startY, w, endY - run.startY);
      run = null;
    };

    for (let y = 0; y < h; y++) {
      const worldY = profile.worldYAtScreen(y);
      let darkness = 0;
      for (const z of zones) {
        if (worldY < z.startWorldY || worldY > z.endWorldY) continue;
        const distFromEdge = Math.min(worldY - z.startWorldY, z.endWorldY - worldY);
        const zoneDarkness = Math.min(1, distFromEdge / FADE_LENGTH);
        if (zoneDarkness > darkness) darkness = zoneDarkness;
      }
      const alpha = darkness * MAX_DARKNESS;
      if (!run || Math.abs(run.alpha - alpha) > 0.005) {
        flush(y);
        if (alpha > 0) run = { startY: y, alpha };
      }
    }
    flush(h);

    // Tunnel light strips — bright bands at fixed worldY intervals inside
    // each zone. Each light only renders if its worldY is currently visible
    // on screen and is past the entry fade so it doesn't bloom outside the
    // tunnel mouth.
    const LIGHT_SPACING = 220;
    const LIGHT_HALF_HEIGHT = 4;
    for (const z of zones) {
      const firstLight = Math.ceil((z.startWorldY + FADE_LENGTH) / LIGHT_SPACING) * LIGHT_SPACING;
      for (let lightY = firstLight; lightY <= z.endWorldY - FADE_LENGTH; lightY += LIGHT_SPACING) {
        // Convert worldY to screen Y: screenY = PLAYER.Y - (worldY - playerWorldY)
        // Use profile to back out the right screen Y.
        const screenY = this.tunnelLightScreenY(lightY, profile);
        if (screenY < -LIGHT_HALF_HEIGHT || screenY > h + LIGHT_HALF_HEIGHT) continue;
        // Bright band — slight gradient for depth
        const grad = ctx.createLinearGradient(0, screenY - LIGHT_HALF_HEIGHT, 0, screenY + LIGHT_HALF_HEIGHT);
        grad.addColorStop(0, 'rgba(255,250,180,0)');
        grad.addColorStop(0.5, 'rgba(255,250,180,0.7)');
        grad.addColorStop(1, 'rgba(255,250,180,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, screenY - LIGHT_HALF_HEIGHT, w, LIGHT_HALF_HEIGHT * 2);
      }
    }
  }

  // Invert the profile's worldYAtScreen(s) = worldYAtScreen(0) - s formula:
  // screenY = worldYAtScreen(0) - worldY. Lets us place a feature at a
  // specific section-relative worldY without depending on PLAYER.Y directly.
  private tunnelLightScreenY(worldY: number, profile: RoadProfile): number {
    return profile.worldYAtScreen(0) - worldY;
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
    profile: RoadProfile,
  ): void {
    // Fast path: uniform geometry collapses to a single fillRect — pixel
    // identical to v5. The slow path walks per-row strips so dynamic-width
    // sections can shape the road body to the live profile.
    if (profile.isUniform()) {
      const shape = profile.shapeAtPlayer();
      // Shoulders draw first, beneath/beside the pavement, in a darker
      // asphalt-like tone with rumble-strip dashes. Pavement gradient
      // overlays them at the pavement edges so the boundary reads sharp.
      if (shape.shoulder) {
        this.fillShoulder(
          ctx,
          shape.shoulder.xMin,
          shape.xMin,
          h,
          palette,
        );
        this.fillShoulder(
          ctx,
          shape.xMax,
          shape.shoulder.xMax,
          h,
          palette,
        );
      }
      const grad = ctx.createLinearGradient(shape.xMin, 0, shape.xMax, 0);
      grad.addColorStop(0, palette.roadShadeColor);
      grad.addColorStop(0.15, palette.roadColor);
      grad.addColorStop(0.85, palette.roadColor);
      grad.addColorStop(1, palette.roadShadeColor);
      ctx.fillStyle = grad;
      ctx.fillRect(shape.xMin, 0, shape.xMax - shape.xMin, h);
      return;
    }
    this.renderRoadBodyStripped(ctx, h, palette, profile);
  }

  // Shoulder fill — darker than pavement, with periodic rumble-strip dashes
  // along the inner edge so it reads as "drivable but rough." Dashes scroll
  // with worldScroll so the surface looks alive at speed.
  private fillShoulder(
    ctx: CanvasRenderingContext2D,
    xMin: number,
    xMax: number,
    h: number,
    palette: SectionPalette,
  ): void {
    if (xMax <= xMin) return;
    // Base fill — a darker shade than the road body
    ctx.fillStyle = palette.roadShadeColor;
    ctx.fillRect(xMin, 0, xMax - xMin, h);
    // Rumble-strip dashes along the inner edge (the side that touches the
    // pavement). Left shoulder's inner edge is xMax; right shoulder's inner
    // edge is xMin. We detect by comparing widths to canvas geometry —
    // simpler to just always draw dashes at both edges (the outer edge gets
    // a faint dash too, which reads fine).
    const dashLen = 10;
    const gapLen = 10;
    const cycle = dashLen + gapLen;
    const offset = ((this.worldScroll % cycle) + cycle) % cycle;
    ctx.fillStyle = palette.edgeColor;
    for (let y = offset - cycle; y < h; y += cycle) {
      // Inner-edge rumble strip (2px wide, just inside the shoulder edge)
      const innerX = xMax - 4;
      const outerX = xMin + 2;
      ctx.fillRect(innerX, Math.max(0, y), 2, Math.min(dashLen, h - y));
      ctx.fillRect(outerX, Math.max(0, y), 2, Math.min(dashLen, h - y));
    }
  }

  // Slow path. Walks screen rows, queries the profile per row, and accumulates
  // contiguous runs of identical shape PER SEGMENT INDEX into single fills.
  // Stable stretches (wide / narrow / fork-sustain) collapse to one or two
  // fills; tapers and fork open/close cost one fill per affected row.
  private renderRoadBodyStripped(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
    profile: RoadProfile,
  ): void {
    type Run = { startY: number; xMin: number; xMax: number };
    const runs: Array<Run | null> = [];

    const flush = (idx: number, endY: number): void => {
      const run = runs[idx];
      if (!run) return;
      this.fillRoadStripBlock(ctx, run.xMin, run.xMax, run.startY, endY - run.startY, palette);
      runs[idx] = null;
    };

    for (let y = 0; y < h; y++) {
      const shape = profile.shapeAtScreen(y);
      const segments = shape.segments ?? null;
      const count = segments ? segments.length : 1;

      // Flush any runs whose segment index no longer exists (e.g., a fork
      // closing: 2 segments → 1).
      for (let i = count; i < runs.length; i++) {
        flush(i, y);
      }

      for (let i = 0; i < count; i++) {
        const seg = segments ? segments[i] : null;
        const xMin = seg ? seg.xMin : shape.xMin;
        const xMax = seg ? seg.xMax : shape.xMax;
        const run = runs[i];
        if (!run || run.xMin !== xMin || run.xMax !== xMax) {
          flush(i, y);
          runs[i] = { startY: y, xMin, xMax };
        }
      }
    }

    for (let i = 0; i < runs.length; i++) {
      flush(i, h);
    }
  }

  private fillRoadStripBlock(
    ctx: CanvasRenderingContext2D,
    xMin: number,
    xMax: number,
    y: number,
    height: number,
    palette: SectionPalette,
  ): void {
    if (xMax <= xMin || height <= 0) return;
    const grad = ctx.createLinearGradient(xMin, 0, xMax, 0);
    grad.addColorStop(0, palette.roadShadeColor);
    grad.addColorStop(0.15, palette.roadColor);
    grad.addColorStop(0.85, palette.roadColor);
    grad.addColorStop(1, palette.roadShadeColor);
    ctx.fillStyle = grad;
    ctx.fillRect(xMin, y, xMax - xMin, height);
  }

  private renderRoadEdges(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
    profile: RoadProfile,
  ): void {
    ctx.save();
    ctx.strokeStyle = palette.edgeColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = palette.edgeGlowColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    if (profile.isUniform()) {
      const shape = profile.shapeAtPlayer();
      ctx.moveTo(shape.xMin, 0);
      ctx.lineTo(shape.xMin, h);
      ctx.moveTo(shape.xMax, 0);
      ctx.lineTo(shape.xMax, h);
    } else {
      // Outer hull edges (left of leftmost, right of rightmost) trace the
      // road's outline and are continuous through the whole screen.
      let leftStarted = false;
      let rightStarted = false;
      for (let y = 0; y <= h; y++) {
        const shape = profile.shapeAtScreen(y);
        if (!leftStarted) {
          ctx.moveTo(shape.xMin, y);
          leftStarted = true;
        } else {
          ctx.lineTo(shape.xMin, y);
        }
        if (!rightStarted) {
          ctx.moveTo(shape.xMax, y);
          rightStarted = true;
        } else {
          ctx.lineTo(shape.xMax, y);
        }
      }

      // Inner divider edges — only drawn on rows where two segments have a
      // real gap between them. Path breaks when the gap closes (fork start /
      // end touching keyframes), so each open-divider stretch is its own
      // continuous stroke.
      let dividerLeftActive = false;
      let dividerRightActive = false;
      for (let y = 0; y <= h; y++) {
        const shape = profile.shapeAtScreen(y);
        const segments = shape.segments;
        let hasDivider = false;
        let dividerLeftX = 0;
        let dividerRightX = 0;
        if (segments && segments.length >= 2) {
          // Step 3 supports a single divider between two segments. Generalize
          // to multiple dividers if Step 4+ adds 3-way splits.
          dividerLeftX = segments[0].xMax;
          dividerRightX = segments[1].xMin;
          hasDivider = dividerRightX - dividerLeftX > 0;
        }
        if (hasDivider) {
          if (!dividerLeftActive) {
            ctx.moveTo(dividerLeftX, y);
            dividerLeftActive = true;
          } else {
            ctx.lineTo(dividerLeftX, y);
          }
          if (!dividerRightActive) {
            ctx.moveTo(dividerRightX, y);
            dividerRightActive = true;
          } else {
            ctx.lineTo(dividerRightX, y);
          }
        } else {
          dividerLeftActive = false;
          dividerRightActive = false;
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Render the central divider as a Jersey-barrier-style wall: bright concrete
  // base with strong dark outlines on each side and bold yellow/black hazard
  // chevrons that scroll with the road. Drawn between the road body and the
  // edge strokes so the inner edges overlap onto the wall cleanly. The visual
  // intent is "this is a SOLID OBJECT that will kill you," not a painted line.
  private renderDivider(
    ctx: CanvasRenderingContext2D,
    h: number,
    profile: RoadProfile,
  ): void {
    type Run = { startY: number; leftX: number; rightX: number };
    let run: Run | null = null;

    const flush = (endY: number): void => {
      if (!run) return;
      const { startY, leftX, rightX } = run;
      const w = rightX - leftX;
      const height = endY - startY;
      if (w > 2 && height > 0) {
        // Bright concrete base — high contrast against any road palette.
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(leftX, startY, w, height);
        // Top-left highlight strip suggesting the wall's lit edge.
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(leftX + 1, startY, 2, height);
        // Strong dark outlines on both sides — reads as a raised barrier.
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(leftX, startY, 2, height);
        ctx.fillRect(rightX - 2, startY, 2, height);
      }
      run = null;
    };

    for (let y = 0; y < h; y++) {
      const shape = profile.shapeAtScreen(y);
      const segments = shape.segments;
      let hasDivider = false;
      let leftX = 0;
      let rightX = 0;
      if (segments && segments.length >= 2) {
        leftX = segments[0].xMax;
        rightX = segments[1].xMin;
        hasDivider = rightX - leftX > 2;
      }
      if (hasDivider) {
        if (!run || run.leftX !== leftX || run.rightX !== rightX) {
          flush(y);
          run = { startY: y, leftX, rightX };
        }
      } else if (run) {
        flush(y);
      }
    }
    flush(h);

    // Bold yellow/black hazard bands. Each band is BAND_HEIGHT pixels tall and
    // they alternate yellow/black, scrolling with the road (slightly faster
    // than worldScroll so they read as wall motion). Drawn on top of the
    // concrete base, inset 4px from each side so the dark outlines stay
    // visible. Run-accumulated so each band collapses to one fillRect.
    const BAND_HEIGHT = 18;
    const BAND_CYCLE = BAND_HEIGHT * 2;
    const bandOffset =
      ((this.worldScroll * 1.4) % BAND_CYCLE + BAND_CYCLE) % BAND_CYCLE;

    type BandRun = {
      startY: number;
      leftX: number;
      rightX: number;
      yellow: boolean;
    };
    let bandRun: BandRun | null = null;

    const flushBand = (endY: number): void => {
      if (!bandRun) return;
      const { startY, leftX, rightX, yellow } = bandRun;
      const inset = 4;
      const x = leftX + inset;
      const w = rightX - leftX - inset * 2;
      const height = endY - startY;
      if (w > 0 && height > 0) {
        ctx.fillStyle = yellow ? '#FFD700' : '#0a0a0a';
        ctx.fillRect(x, startY, w, height);
      }
      bandRun = null;
    };

    for (let y = 0; y < h; y++) {
      const shape = profile.shapeAtScreen(y);
      const segments = shape.segments;
      if (!segments || segments.length < 2) {
        if (bandRun) flushBand(y);
        continue;
      }
      const leftX = segments[0].xMax;
      const rightX = segments[1].xMin;
      if (rightX - leftX <= 8) {
        if (bandRun) flushBand(y);
        continue;
      }
      const phase = ((y - bandOffset) % BAND_CYCLE + BAND_CYCLE) % BAND_CYCLE;
      const yellow = phase < BAND_HEIGHT;
      if (
        !bandRun ||
        bandRun.yellow !== yellow ||
        bandRun.leftX !== leftX ||
        bandRun.rightX !== rightX
      ) {
        flushBand(y);
        bandRun = { startY: y, leftX, rightX, yellow };
      }
    }
    flushBand(h);
  }

  private renderLaneMarkings(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
    profile: RoadProfile,
  ): void {
    if (profile.isUniform()) {
      const shape = profile.shapeAtPlayer();
      const laneCount = profile.laneCountAtScreen(0);
      const width = shape.xMax - shape.xMin;
      const laneStep = width / laneCount;
      for (let i = 1; i < laneCount; i++) {
        const x = shape.xMin + laneStep * i;
        const isCenter = i === laneCount / 2;
        if (isCenter) {
          this.drawDashedLine(ctx, x, h, 30, 22, palette.centerLineColor, 3);
        } else {
          this.drawDashedLine(ctx, x, h, 24, 28, palette.laneLineColor, 2);
        }
      }
      return;
    }
    // Slow path defers to Step 2; for dynamic width the per-row lane trace
    // walks each lane index and threads the dashed pattern along its center.
    this.drawLaneMarkingsStripped(ctx, h, palette, profile);
  }

  // Per-row rasterization. Each screen row queries its own segments and lane
  // counts; lane lines naturally appear/disappear when geometry changes lane
  // count across a taper or when a fork splits the road. Two dash cycles are
  // tracked because center lines use a longer dash than standard lane lines.
  private drawLaneMarkingsStripped(
    ctx: CanvasRenderingContext2D,
    h: number,
    palette: SectionPalette,
    profile: RoadProfile,
  ): void {
    const standardDash = 24;
    const standardCycle = standardDash + 28;
    const centerDash = 30;
    const centerCycle = centerDash + 22;
    const standardOffset =
      ((this.worldScroll % standardCycle) + standardCycle) % standardCycle;
    const centerOffset =
      ((this.worldScroll % centerCycle) + centerCycle) % centerCycle;

    for (let y = 0; y < h; y++) {
      const standardPhase =
        ((y - standardOffset) % standardCycle + standardCycle) % standardCycle;
      const centerPhase =
        ((y - centerOffset) % centerCycle + centerCycle) % centerCycle;
      const inStandardDash = standardPhase < standardDash;
      const inCenterDash = centerPhase < centerDash;
      if (!inStandardDash && !inCenterDash) continue;

      const shape = profile.shapeAtScreen(y);
      const segments = shape.segments;
      if (segments) {
        for (const seg of segments) {
          this.drawLaneRowForSegment(
            ctx,
            seg.xMin,
            seg.xMax,
            seg.laneCount,
            y,
            inStandardDash,
            inCenterDash,
            palette,
          );
        }
      } else {
        const laneCount = profile.laneCountAtScreen(y);
        this.drawLaneRowForSegment(
          ctx,
          shape.xMin,
          shape.xMax,
          laneCount,
          y,
          inStandardDash,
          inCenterDash,
          palette,
        );
      }
    }
  }

  private drawLaneRowForSegment(
    ctx: CanvasRenderingContext2D,
    xMin: number,
    xMax: number,
    laneCount: number,
    y: number,
    inStandardDash: boolean,
    inCenterDash: boolean,
    palette: SectionPalette,
  ): void {
    if (laneCount < 2) return;
    const laneStep = (xMax - xMin) / laneCount;
    for (let i = 1; i < laneCount; i++) {
      // Center marker only exists when there's an even number of lanes; odd
      // counts (e.g. 3 lanes) have no true center, just two equal dividers.
      const isCenter = laneCount % 2 === 0 && i === laneCount / 2;
      if (isCenter && !inCenterDash) continue;
      if (!isCenter && !inStandardDash) continue;
      const x = xMin + laneStep * i;
      const w = isCenter ? 3 : 2;
      ctx.fillStyle = isCenter ? palette.centerLineColor : palette.laneLineColor;
      ctx.fillRect(Math.round(x - w / 2), y, w, 1);
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
    profile: RoadProfile,
  ): void {
    const offset =
      ((this.worldScroll % SCENERY.POST_SPACING) + SCENERY.POST_SPACING) %
      SCENERY.POST_SPACING;
    let y = offset - SCENERY.POST_SPACING;
    while (y < h) {
      const shape = profile.shapeAtScreen(y);
      if (palette.sceneryStyle === 'buildings') {
        this.drawStreetLamp(ctx, shape.xMin - 14, y, palette);
        this.drawStreetLamp(ctx, shape.xMax + 6, y, palette);
      } else {
        this.drawHighwayPost(ctx, shape.xMin - 12, y, palette);
        this.drawHighwayPost(ctx, shape.xMax + 8, y, palette);
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
