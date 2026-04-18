import { ROAD, ROAD_RENDER, SCENERY } from '../data/constants';

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

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Grass background
    const grassGrad = ctx.createLinearGradient(0, 0, 0, h);
    grassGrad.addColorStop(0, ROAD_RENDER.GRASS_COLOR_TOP);
    grassGrad.addColorStop(1, ROAD_RENDER.GRASS_COLOR_BOTTOM);
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, w, h);

    this.renderDistantScenery(ctx, w, h);

    // Road body
    ctx.fillStyle = ROAD_RENDER.ROAD_COLOR;
    ctx.fillRect(ROAD.X_MIN, 0, ROAD.WIDTH, h);

    // Pink edge glow lines
    ctx.save();
    ctx.strokeStyle = ROAD_RENDER.EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.shadowColor = ROAD_RENDER.EDGE_COLOR;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(ROAD.X_MIN, 0);
    ctx.lineTo(ROAD.X_MIN, h);
    ctx.moveTo(ROAD.X_MAX, 0);
    ctx.lineTo(ROAD.X_MAX, h);
    ctx.stroke();
    ctx.restore();

    // Lane dividers (cyan dashed) and center line (yellow dashed)
    const laneStep = ROAD.WIDTH / ROAD.LANE_COUNT;
    for (let i = 1; i < ROAD.LANE_COUNT; i++) {
      const x = ROAD.X_MIN + laneStep * i;
      const isCenter = i === ROAD.LANE_COUNT / 2;
      if (isCenter) {
        this.drawDashedLine(
          ctx,
          x,
          h,
          ROAD_RENDER.CENTER_LINE_LENGTH,
          ROAD_RENDER.CENTER_LINE_GAP,
          ROAD_RENDER.CENTER_LINE_COLOR,
          3,
        );
      } else {
        this.drawDashedLine(
          ctx,
          x,
          h,
          ROAD_RENDER.LANE_LINE_LENGTH,
          ROAD_RENDER.LANE_LINE_GAP,
          ROAD_RENDER.LANE_LINE_COLOR,
          2,
        );
      }
    }

    this.renderRoadsidePosts(ctx, h);
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
    const offset = this.worldScroll % cycle;
    let y = -offset;
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

  private renderRoadsidePosts(ctx: CanvasRenderingContext2D, h: number): void {
    const offset = this.worldScroll % SCENERY.POST_SPACING;
    let y = -offset;
    while (y < h) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(ROAD.X_MIN - 12, y, 4, 14);
      ctx.fillRect(ROAD.X_MAX + 8, y, 4, 14);
      ctx.fillStyle = ROAD_RENDER.EDGE_COLOR;
      ctx.fillRect(ROAD.X_MIN - 12, y + 4, 4, 6);
      ctx.fillRect(ROAD.X_MAX + 8, y + 4, 4, 6);
      y += SCENERY.POST_SPACING;
    }
  }

  private renderDistantScenery(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const offset = (this.worldScroll * SCENERY.TREE_PARALLAX) % SCENERY.TREE_SPACING;
    ctx.fillStyle = '#2a0044';
    let y = -offset;
    while (y < h) {
      this.drawTree(ctx, 60, y, 14);
      this.drawTree(ctx, 110, y + 90, 11);
      this.drawTree(ctx, w - 60, y, 14);
      this.drawTree(ctx, w - 110, y + 90, 11);
      y += SCENERY.TREE_SPACING;
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 2, y, 4, r);
  }
}
