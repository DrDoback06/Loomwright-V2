/** Seeded RNG (mulberry32) — every random generation stores its seed on
 * the bundle, so a reroll is "same request, fresh seed" and unit tests
 * are exact. Hand-rolled: no dependency, 4 lines of real math. */
export interface Rng {
  /** [0, 1) */
  float(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  weightedPick<T extends { weight: number }>(rows: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const float = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(float() * (max - min + 1));
  return {
    float,
    int,
    pick: (arr) => arr[Math.floor(float() * arr.length)],
    weightedPick: (rows) => {
      const total = rows.reduce((n, r) => n + Math.max(r.weight, 0), 0);
      let roll = float() * total;
      for (const row of rows) {
        roll -= Math.max(row.weight, 0);
        if (roll <= 0) return row;
      }
      return rows[rows.length - 1];
    },
    shuffle: (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(float() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => float() < p,
  };
}

/** A fresh seed for user-initiated generations and rerolls. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
