import fs from "node:fs/promises";
import path from "node:path";

/**
 * Recursively list files under `dir`, returning paths relative to `baseDir`.
 * If `baseDir` is not provided, it's set to the initial `dir` value.
 */
export async function listFiles(
  dir: string,
  baseDir?: string
): Promise<string[]> {
  const base = baseDir || dir;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await listFiles(p, base);
      out.push(...sub);
    } else {
      out.push(path.relative(base, p));
    }
  }
  return out;
}
