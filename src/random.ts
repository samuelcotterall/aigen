// Minimal seeded PRNG (mulberry32). Returns a function that yields floats [0,1).
export function createSeededRng(seed?: string | number) {
  // derive numeric seed from provided value; default to current time
  let h = 2166136261 >>> 0;
  const s = seed === undefined ? String(Date.now()) : String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // mulberry32
  let t = (h + 0x6d2b79f5) >>> 0;
  return function rng() {
    t |= 0;
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
