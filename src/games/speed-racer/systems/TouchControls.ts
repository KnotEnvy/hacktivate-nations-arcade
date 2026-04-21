// On-canvas virtual controls for touch play. Exposes a per-frame snapshot of
// which virtual buttons are held, plus edge-triggered events for fire/secondary
// so they don't auto-repeat. Renders as a translucent overlay; auto-hides until
// the first touch is observed (so desktop play is not visually cluttered).
//
// Layout (canvas-space, fixed):
//   Left side  → D-pad: up / down / left / right around (110, 460)
//   Right side → FIRE big circle around (700, 470), SECONDARY pill around (700, 380)
//
// Game uses:
//   tc.update(touches)
//   tc.leftHeld() / rightHeld() / upHeld() / downHeld() / fireHeld() / secondaryHeld()
//   tc.consumeSecondaryPress() — edge-triggered so Q-style "press once" works
//   tc.render(ctx)

import { CANVAS } from '../data/constants';

interface Touch { id: number; x: number; y: number }

interface RectButton { kind: 'rect'; x: number; y: number; w: number; h: number; label: string }
interface CircleButton { kind: 'circle'; x: number; y: number; r: number; label: string }
type Button = RectButton | CircleButton;

// Sizes picked for comfortable thumb play. 44px is the absolute minimum
// touch-target spec; we go larger here because CSS scaling on phones can
// make the effective tappable area smaller than the rendered one.
const PAD_CX = 120;
const PAD_CY = 450;
const PAD_BTN = 56;
const PAD_GAP = 10;

const FIRE_CX = CANVAS.WIDTH - 100;
const FIRE_CY = 465;
const FIRE_R = 58;

const SEC_CX = CANVAS.WIDTH - 100;
const SEC_CY = 350;
const SEC_W = 108;
const SEC_H = 52;

export class TouchControls {
  private revealed = false;
  private leftPressed = false;
  private rightPressed = false;
  private upPressed = false;
  private downPressed = false;
  private firePressed = false;
  private secondaryPressed = false;
  private secondaryWasPressed = false;
  private secondaryEdge = false;

  // Cached button shapes — kept here so render() and hit-test stay in sync
  private readonly btnLeft: RectButton = {
    kind: 'rect',
    x: PAD_CX - PAD_BTN - PAD_GAP - PAD_BTN / 2,
    y: PAD_CY - PAD_BTN / 2,
    w: PAD_BTN,
    h: PAD_BTN,
    label: '◀',
  };
  private readonly btnRight: RectButton = {
    kind: 'rect',
    x: PAD_CX + PAD_GAP + PAD_BTN / 2,
    y: PAD_CY - PAD_BTN / 2,
    w: PAD_BTN,
    h: PAD_BTN,
    label: '▶',
  };
  private readonly btnUp: RectButton = {
    kind: 'rect',
    x: PAD_CX - PAD_BTN / 2,
    y: PAD_CY - PAD_BTN - PAD_GAP - PAD_BTN / 2,
    w: PAD_BTN,
    h: PAD_BTN,
    label: '▲',
  };
  private readonly btnDown: RectButton = {
    kind: 'rect',
    x: PAD_CX - PAD_BTN / 2,
    y: PAD_CY + PAD_GAP + PAD_BTN / 2,
    w: PAD_BTN,
    h: PAD_BTN,
    label: '▼',
  };
  private readonly btnFire: CircleButton = {
    kind: 'circle',
    x: FIRE_CX,
    y: FIRE_CY,
    r: FIRE_R,
    label: 'FIRE',
  };
  private readonly btnSecondary: RectButton = {
    kind: 'rect',
    x: SEC_CX - SEC_W / 2,
    y: SEC_CY - SEC_H / 2,
    w: SEC_W,
    h: SEC_H,
    label: 'WEAPON',
  };

  reset(): void {
    this.revealed = false;
    this.leftPressed = false;
    this.rightPressed = false;
    this.upPressed = false;
    this.downPressed = false;
    this.firePressed = false;
    this.secondaryPressed = false;
    this.secondaryWasPressed = false;
    this.secondaryEdge = false;
  }

  update(touches: Touch[]): void {
    if (touches.length > 0) this.revealed = true;

    this.leftPressed = false;
    this.rightPressed = false;
    this.upPressed = false;
    this.downPressed = false;
    this.firePressed = false;
    this.secondaryPressed = false;

    for (const t of touches) {
      if (this.hitTest(this.btnLeft, t.x, t.y)) this.leftPressed = true;
      if (this.hitTest(this.btnRight, t.x, t.y)) this.rightPressed = true;
      if (this.hitTest(this.btnUp, t.x, t.y)) this.upPressed = true;
      if (this.hitTest(this.btnDown, t.x, t.y)) this.downPressed = true;
      if (this.hitTest(this.btnFire, t.x, t.y)) this.firePressed = true;
      if (this.hitTest(this.btnSecondary, t.x, t.y)) this.secondaryPressed = true;
    }

    // Edge detection for secondary (so a held finger doesn't burn ammo on every tick)
    this.secondaryEdge = this.secondaryPressed && !this.secondaryWasPressed;
    this.secondaryWasPressed = this.secondaryPressed;
  }

  private hitTest(btn: Button, x: number, y: number): boolean {
    if (btn.kind === 'rect') {
      return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
    }
    const dx = x - btn.x;
    const dy = y - btn.y;
    return dx * dx + dy * dy <= btn.r * btn.r;
  }

  leftHeld(): boolean { return this.leftPressed; }
  rightHeld(): boolean { return this.rightPressed; }
  upHeld(): boolean { return this.upPressed; }
  downHeld(): boolean { return this.downPressed; }
  fireHeld(): boolean { return this.firePressed; }
  consumeSecondaryPress(): boolean {
    const v = this.secondaryEdge;
    this.secondaryEdge = false;
    return v;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.revealed) return;

    ctx.save();
    // D-pad buttons
    this.drawRect(ctx, this.btnLeft, this.leftPressed);
    this.drawRect(ctx, this.btnRight, this.rightPressed);
    this.drawRect(ctx, this.btnUp, this.upPressed);
    this.drawRect(ctx, this.btnDown, this.downPressed);

    // Action buttons
    this.drawCircle(ctx, this.btnFire, this.firePressed, '#FF1493');
    this.drawRect(ctx, this.btnSecondary, this.secondaryPressed, '#FFD700');
    ctx.restore();
  }

  private drawRect(
    ctx: CanvasRenderingContext2D,
    btn: RectButton,
    pressed: boolean,
    color = '#00FFFF',
  ): void {
    ctx.globalAlpha = pressed ? 0.85 : 0.55;
    ctx.fillStyle = pressed ? color : 'rgba(20,10,40,0.55)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(btn.x, btn.y, btn.w, btn.h);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pressed ? '#0a0a14' : color;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  }

  private drawCircle(
    ctx: CanvasRenderingContext2D,
    btn: CircleButton,
    pressed: boolean,
    color: string,
  ): void {
    ctx.globalAlpha = pressed ? 0.9 : 0.6;
    ctx.fillStyle = pressed ? color : 'rgba(20,10,40,0.55)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pressed ? '#0a0a14' : color;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x, btn.y + 1);
  }
}
