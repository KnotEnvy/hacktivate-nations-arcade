// Power-ups: what drops, how often, and what each one is called and
// coloured on the court. A drop is rolled on ~15% of breaks and is never the
// same type as the drop before it.

import { COURT } from '../constants';
import type { PowerType } from '../entities/types';

export interface PowerDef {
  /** Band colour on the capsule and the HUD tag. */
  color: string;
  /** Short HUD / popup label. */
  label: string;
  /** Relative drop weight. */
  weight: number;
}

export const POWER_DEFS: Record<PowerType, PowerDef> = {
  widen: { color: '#5cf2a0', label: 'WIDE', weight: 22 },
  multi: { color: '#63d2ff', label: 'MULTI', weight: 20 },
  slow: { color: '#a996ff', label: 'SLOW', weight: 14 },
  catch: { color: COURT.lime, label: 'CATCH', weight: 18 },
  blast: { color: COURT.pink, label: 'BLAST', weight: 16 },
  life: { color: '#f4f6ff', label: 'SERVE', weight: 10 },
};

export const POWER_TYPES = Object.keys(POWER_DEFS) as PowerType[];

/** Weighted pick that never repeats `last`. */
export function pickPower(
  last: PowerType | null,
  rand: () => number
): PowerType {
  const pool = POWER_TYPES.filter(t => t !== last);
  const total = pool.reduce((s, t) => s + POWER_DEFS[t].weight, 0);
  let roll = rand() * total;
  for (const t of pool) {
    roll -= POWER_DEFS[t].weight;
    if (roll < 0) return t;
  }
  return pool[pool.length - 1];
}

/** Timed effects currently running, in seconds left (0 = off). */
export interface ActivePowers {
  widen: number;
  slow: number;
  catch: number;
  /** BLAST is armed until the next brick contact. */
  blast: boolean;
}

export function noPowers(): ActivePowers {
  return { widen: 0, slow: 0, catch: 0, blast: false };
}
