import crypto from "node:crypto";

// Small helpers for templates that rely on a provided RNG function.
// `rng` must be a zero-arg function returning a float in [0,1).
export function makeTemplateHelpers(rng: () => number) {
  let counter = 0;
  return {
    // deterministic short id: prefix + base36(counter + random)
    idFromRng(prefix = "id") {
      const n = Math.floor(rng() * 0xffffffff) + counter++;
      return `${prefix}-${n.toString(36)}`;
    },
    // deterministic pseudo-uuid from rng by hashing random bytes
    uuidFromRng() {
      const parts: string[] = [];
      for (let i = 0; i < 4; i++) {
        const n = Math.floor(rng() * 0xffffffff);
        parts.push(n.toString(16).padStart(8, "0"));
      }
      const seed = parts.join("");
      // create a short, stable hex digest
      return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 32);
    },
    // convenience: produce a hex string from rng
    hex(nBytes = 8) {
      const parts: string[] = [];
      for (let i = 0; i < nBytes; i++) {
        parts.push(Math.floor(rng() * 256).toString(16).padStart(2, "0"));
      }
      return parts.join("");
    },
  } as const;
}
