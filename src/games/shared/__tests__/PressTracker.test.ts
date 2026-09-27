// PressTracker: level state in, edges out.

import { PressTracker, type InputSource } from '../input/PressTracker';

function makeInput() {
  const keys = new Set<string>();
  const buttons = new Set<number>();
  let mouse = { x: 0, y: 0 };
  let touches: Array<{ id: number; x: number; y: number }> = [];
  const input: InputSource = {
    isKeyPressed: code => keys.has(code),
    isMousePressed: (button = 0) => buttons.has(button),
    getMousePosition: () => ({ ...mouse }),
    getTouches: () => touches.map(t => ({ ...t })),
  };
  return {
    input,
    keys,
    buttons,
    setMouse: (x: number, y: number) => {
      mouse = { x, y };
    },
    setTouch: (t: Array<{ id: number; x: number; y: number }>) => {
      touches = t;
    },
  };
}

const CODES = ['Space', 'KeyF'];
const DT = 1 / 60;

describe('PressTracker', () => {
  it('reports a key edge on exactly one frame', () => {
    const f = makeInput();
    const t = new PressTracker();
    t.update(f.input, CODES, DT);
    f.keys.add('Space');
    t.update(f.input, CODES, DT);
    expect(t.justPressed('Space')).toBe(true);
    t.update(f.input, CODES, DT);
    expect(t.justPressed('Space')).toBe(false);
    expect(t.isDown('Space')).toBe(true);
    f.keys.delete('Space');
    t.update(f.input, CODES, DT);
    expect(t.justReleased('Space')).toBe(true);
  });

  it('folds mouse and touch into one pointer with press/release edges', () => {
    const f = makeInput();
    const t = new PressTracker();
    t.update(f.input, CODES, DT);
    f.setTouch([{ id: 1, x: 40, y: 50 }]);
    t.update(f.input, CODES, DT);
    expect(t.pointerJustPressed()).toBe(true);
    expect(t.pointerPosition()).toEqual({ x: 40, y: 50 });
    f.setTouch([]);
    t.update(f.input, CODES, DT);
    expect(t.pointerJustReleased()).toBe(true);
    // The finger is gone but the release still knows where it happened.
    expect(t.pointerPosition()).toEqual({ x: 40, y: 50 });
    expect(t.tapped()).toBe(true);
  });

  it('a mouse press right after a touch session starts at the mouse, not the finger', () => {
    const f = makeInput();
    const t = new PressTracker();
    f.setTouch([{ id: 1, x: 40, y: 50 }]);
    t.update(f.input, CODES, DT);
    f.setTouch([]);
    t.update(f.input, CODES, DT);

    f.setMouse(300, 200);
    f.buttons.add(0);
    t.update(f.input, CODES, DT);
    expect(t.pointerJustPressed()).toBe(true);
    expect(t.pointerPosition()).toEqual({ x: 300, y: 200 });
    expect(t.pointerDownPosition()).toEqual({ x: 300, y: 200 });
    expect(t.isTouch()).toBe(false);
  });

  it('a long press fires once and never also taps', () => {
    const f = makeInput();
    const t = new PressTracker();
    f.setTouch([{ id: 1, x: 10, y: 10 }]);
    let fired = 0;
    for (let i = 0; i < 40; i++) {
      t.update(f.input, CODES, DT);
      if (t.longPressed(0.45)) fired++;
    }
    expect(fired).toBe(1);
    f.setTouch([]);
    t.update(f.input, CODES, DT);
    expect(t.pointerJustReleased()).toBe(true);
    expect(t.tapped()).toBe(false);
  });

  it('a swipe reports its direction once it has travelled and can be re-armed', () => {
    const f = makeInput();
    const t = new PressTracker();
    f.setTouch([{ id: 1, x: 100, y: 100 }]);
    t.update(f.input, CODES, DT);
    expect(t.swipe()).toBeNull();
    f.setTouch([{ id: 1, x: 140, y: 104 }]);
    t.update(f.input, CODES, DT);
    expect(t.swipe()).toBe('right');
    t.rearmSwipe();
    expect(t.swipe()).toBeNull();
    f.setTouch([{ id: 1, x: 140, y: 60 }]);
    t.update(f.input, CODES, DT);
    expect(t.swipe()).toBe('up');
  });
});
