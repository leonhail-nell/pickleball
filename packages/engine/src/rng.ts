import { createHash, randomInt } from 'node:crypto';

/** Returns a uniform integer in [0, n). Injectable for deterministic tests. */
export type Rng = (n: number) => number;

/** Production RNG — cryptographically secure, no positional bias. */
export const cryptoRng: Rng = (n) => (n <= 1 ? 0 : randomInt(n));

/** Deterministic RNG for tests / audit replay (mulberry32). NOT for production draws. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return (n: number) => {
    if (n <= 1) return 0;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const f = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(f * n);
  };
}

/**
 * Commit–reveal RNG: a deterministic hash chain over a secret session seed.
 * Publish sha256(seed) at session start; reveal the seed at close — anyone can
 * then replay every draw and verify no shuffle was rigged. Uses rejection
 * sampling on SHA-256 output for unbiased uniform integers.
 */
export interface ChainRng {
  rng: Rng;
  /** current chain position — persist and pass back as `start` after restarts */
  counter: () => number;
}

export function hashChainRng(seedHex: string, start = 0): ChainRng {
  let i = start;
  const next32 = (): number => {
    const h = createHash('sha256').update(`${seedHex}:${i++}`).digest();
    return h.readUInt32BE(0);
  };
  return {
    rng: (n: number) => {
      if (n <= 1) return 0;
      const limit = Math.floor(0x100000000 / n) * n;
      let v = next32();
      while (v >= limit) v = next32(); // rejection sampling → no modulo bias
      return v % n;
    },
    counter: () => i,
  };
}

export function commitmentOf(seedHex: string): string {
  return createHash('sha256').update(seedHex).digest('hex');
}

/** Unbiased in-place Fisher–Yates shuffle. */
export function fisherYates<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
