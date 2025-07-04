import { useEffect, useRef } from 'react';
import { Canvas } from 'glsl-canvas-js/dist/esm/glsl';

const fragShader = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution;
  vec3 color = 0.5 + 0.5*cos(u_time + st.xyx + vec3(0.0,2.0,4.0));
  gl_FragColor = vec4(color, 0.15);
}
`;

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const glsl = new Canvas(canvas);
    glsl.load(fragShader);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      glsl.setUniform('u_resolution', [canvas.width, canvas.height]);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let frameId: number;
    const animate = (t: number) => {
      glsl.setUniform('u_time', t * 0.001);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      glsl.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />;
}

