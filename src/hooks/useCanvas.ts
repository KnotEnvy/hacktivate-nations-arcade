// ===== src/hooks/useCanvas.ts =====
import { useEffect, useRef, useState } from 'react';

export function useCanvas(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Configure context for crisp pixel art
        context.imageSmoothingEnabled = false;
        setCtx(context);
      }
    }
  }, [width, height]);

  return { canvasRef, ctx };
}
