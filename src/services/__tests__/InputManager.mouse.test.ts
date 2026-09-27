// A mouse button released outside the canvas still releases.

import { InputManager } from '../InputManager';

describe('InputManager mouse release', () => {
  it('clears the button when mouseup happens off the canvas', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const input = new InputManager();
    input.init(canvas);

    canvas.dispatchEvent(
      new MouseEvent('mousedown', { button: 0, bubbles: true })
    );
    expect(input.isMousePressed(0)).toBe(true);

    // Released over the page, not the canvas.
    document.body.dispatchEvent(
      new MouseEvent('mouseup', { button: 0, bubbles: true })
    );
    expect(input.isMousePressed(0)).toBe(false);

    input.destroy();
    canvas.remove();
  });

  it('stops listening after destroy', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const input = new InputManager();
    input.init(canvas);
    input.destroy();
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { button: 0, bubbles: true })
    );
    expect(input.isMousePressed(0)).toBe(false);
    canvas.remove();
  });
});
