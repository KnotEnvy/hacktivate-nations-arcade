// ===== src/hooks/useInput.ts =====
import { useEffect, useRef } from 'react';
import { InputManager } from '@/services/InputManager';

/**
 * React hook to manage an InputManager instance.
 *
 * Basic usage:
 * ```ts
 * const { input, isActionPressed } = useInput(canvasRef.current);
 * ```
 */
export function useInput(target: HTMLCanvasElement | Document | null) {
  const managerRef = useRef<InputManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new InputManager();
  }

  useEffect(() => {
    const manager = managerRef.current!;
    if (target) {
      const canvas =
        target instanceof HTMLCanvasElement
          ? target
          : document.createElement('canvas');
      manager.init(canvas);
    }
    return () => {
      manager.destroy();
    };
  }, [target]);

  return {
    input: managerRef.current,
    isActionPressed: () => managerRef.current!.isActionPressed(),
    getMousePosition: () => managerRef.current!.getMousePosition(),
  };
}
