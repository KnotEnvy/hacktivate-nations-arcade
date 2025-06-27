import { BaseGame } from './BaseGame';
import { GameManifest } from '@/lib/types';

export class PlaceholderGame extends BaseGame {
  manifest: GameManifest;

  constructor(manifest: GameManifest) {
    super();
    this.manifest = manifest;
  }

  protected onInit(): void {}
  protected onUpdate(): void {}
  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '32px sans-serif';
    ctx.fillText(this.manifest.title, this.canvas.width / 2, this.canvas.height / 2 - 20);
    ctx.font = '24px sans-serif';
    ctx.fillText('Coming Soon', this.canvas.width / 2, this.canvas.height / 2 + 20);
  }
}
