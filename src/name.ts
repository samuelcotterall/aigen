import fs from "node:fs/promises";
import path from "node:path";

export function makeSlug(s: string) {
  const out = (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "");
  return out || `agent-${Date.now()}`;
}

export async function resolveName(
  opts: any,
  defaults: any,
  cwd: string
): Promise<{ name: string; displayName: string; slug: string }> {
  let name: string | undefined;
  if (opts && opts.name) name = opts.name;
  if (!name && defaults && defaults.name) name = defaults.name;

  if (!name) {
    try {
      const pj = await fs
        .readFile(path.join(cwd, "package.json"), "utf8")
        .catch(() => "");
      if (pj) {
        try {
          const pjObj = JSON.parse(pj);
          if (pjObj && pjObj.name) name = pjObj.name;
        } catch {}
      }
    } catch {}
  }

  if (!name) {
    try {
      const readme = await fs
        .readFile(path.join(cwd, "README.md"), "utf8")
        .catch(() => "");
      if (readme) {
        const m = readme.match(/^#\s+(.+)$/m);
        if (m) name = m[1].trim();
      }
    } catch {}
  }

  if (!name) name = path.basename(cwd) || `agent-${Date.now()}`;
  const displayName = name;
  const slug = makeSlug(displayName);
  return { name, displayName, slug };
}

export default resolveName;
