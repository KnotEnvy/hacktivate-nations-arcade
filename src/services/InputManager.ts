// ===== src/services/InputManager.ts =====
export interface InputState {
  keyboard: Set<string>;
  mouse: { x: number; y: number; buttons: Set<number> };
  touch: Array<{ id: number; x: number; y: number }>;
  gamepad: GamepadState[];
}

export interface GamepadState {
  connected: boolean;
  buttons: boolean[];
  axes: number[];
}

export class InputManager {
  private state: InputState = {
    keyboard: new Set(),
    mouse: { x: 0, y: 0, buttons: new Set() },
    touch: [],
    gamepad: [],
  };

  private canvas: HTMLCanvasElement | null = null;
  private listeners: Array<() => void> = [];

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    // Keyboard events
    const onKeyDown = (e: KeyboardEvent) => {
      this.state.keyboard.add(e.code);
      e.preventDefault();
    };
    
    const onKeyUp = (e: KeyboardEvent) => {
      this.state.keyboard.delete(e.code);
    };

    // Mouse events
    const onMouseMove = (e: MouseEvent) => {
      const rect = this.canvas!.getBoundingClientRect();
      const scaleX = this.canvas!.width / rect.width;
      const scaleY = this.canvas!.height / rect.height;
      this.state.mouse.x = (e.clientX - rect.left) * scaleX;
      this.state.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    const onMouseDown = (e: MouseEvent) => {
      this.state.mouse.buttons.add(e.button);
    };

    const onMouseUp = (e: MouseEvent) => {
      this.state.mouse.buttons.delete(e.button);
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      this.updateTouchState(e);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      this.updateTouchState(e);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      this.updateTouchState(e);
    };

    // Add all listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    this.canvas.addEventListener('mousemove', onMouseMove);
    this.canvas.addEventListener('mousedown', onMouseDown);
    this.canvas.addEventListener('mouseup', onMouseUp);
    this.canvas.addEventListener('touchstart', onTouchStart);
    this.canvas.addEventListener('touchmove', onTouchMove);
    this.canvas.addEventListener('touchend', onTouchEnd);

    // Store cleanup functions
    this.listeners = [
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
      () => this.canvas?.removeEventListener('mousemove', onMouseMove),
      () => this.canvas?.removeEventListener('mousedown', onMouseDown),
      () => this.canvas?.removeEventListener('mouseup', onMouseUp),
      () => this.canvas?.removeEventListener('touchstart', onTouchStart),
      () => this.canvas?.removeEventListener('touchmove', onTouchMove),
      () => this.canvas?.removeEventListener('touchend', onTouchEnd),
    ];
  }

  private updateTouchState(e: TouchEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    // Canvas is frequently CSS-scaled (maxWidth: 100%), so map CSS-pixel
    // touch coordinates back into the canvas's internal resolution. Without
    // this, taps on virtual controls miss their buttons on small viewports.
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;

    this.state.touch = Array.from(e.touches).map(touch => ({
      id: touch.identifier,
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }));
  }

  // Public API for games
  isKeyPressed(code: string): boolean {
    return this.state.keyboard.has(code);
  }

  isMousePressed(button: number = 0): boolean {
    return this.state.mouse.buttons.has(button);
  }

  isMouseDown(button: number = 0): boolean {
    return this.isMousePressed(button);
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.state.mouse };
  }

  getTouches(): Array<{ id: number; x: number; y: number }> {
    return [...this.state.touch];
  }

  isTouchActive(): boolean {
    return this.state.touch.length > 0;
  }

  // Convenience methods
  isActionPressed(): boolean {
    return this.isKeyPressed('Space') || 
           this.isKeyPressed('Enter') || 
           this.isMousePressed() || 
           this.state.touch.length > 0;
  }

  isLeftPressed(): boolean {
    return this.isKeyPressed('ArrowLeft') || this.isKeyPressed('KeyA');
  }

  isRightPressed(): boolean {
    return this.isKeyPressed('ArrowRight') || this.isKeyPressed('KeyD');
  }

  isUpPressed(): boolean {
    return this.isKeyPressed('ArrowUp') || this.isKeyPressed('KeyW');
  }

  isDownPressed(): boolean {
    return this.isKeyPressed('ArrowDown') || this.isKeyPressed('KeyS');
  }

  destroy(): void {
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }
}
