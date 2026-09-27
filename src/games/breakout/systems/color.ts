// Colour helpers for '#rrggbb' strings.

function parse(hex: string): [number, number, number] {
  const p = parseInt(hex.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
}

/** '#rrggbb' at `alpha` as an rgba() string. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Blend `a` toward `b` by t (0..1), returned as '#rrggbb'. */
export function blend(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pa = parse(a);
  const pb = parse(b);
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
