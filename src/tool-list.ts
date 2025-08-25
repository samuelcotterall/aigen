import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TOOL_CATALOG, ToolCatalogItem } from "./tools/catalog.js";

export type ToolItem = {
  name: string;
  hint?: string;
  description?: string;
  recommends?: string[];
  language?: string;
  packageManager?: string;
  ecosystem?: string;
};

/**
 * Load a list of tools. If `source` is not provided, return a built-in list.
 *
 * The `source` can be a local JSON file path or an HTTP(S) URL returning
 * an array of tool descriptors. Remote responses are cached to a temp file
 * for up to 24 hours.
 *
 * @param source - optional local path or URL to a tool list
 */
export async function loadToolList(source?: string) {
  // Map the richer catalog into the legacy ToolItem shape used by the CLI
  const defaultRecommends: Record<string, string[]> = {
    vitest: ["playwright"],
    playwright: ["puppeteer"],
  };
  const builtIn: ToolItem[] = TOOL_CATALOG.map((c: ToolCatalogItem) => ({
    name: c.name,
    hint: c.hint || c.description,
    description: c.description,
    recommends: c.recommends ?? defaultRecommends[c.name],
    language: c.language,
    packageManager: c.packageManager,
    ecosystem: c.ecosystem,
  }));

  if (!source) return builtIn;

  const TTL = 1000 * 60 * 60 * 24; // 24h
  const cacheFile = path.join(os.tmpdir(), "create-agent-tools-cache.json");

  try {
    if (/^https?:\/\//i.test(source)) {
      // try cache
      try {
        const rawCache = await fs.readFile(cacheFile, "utf8").catch(() => "");
        if (rawCache) {
          const cache = JSON.parse(rawCache || "{}");
          const entry = cache[source];
          if (entry && Date.now() - entry.ts < TTL) {
            return entry.items as any;
          }
        }
      } catch {}

      // fetch remote
      // eslint-disable-next-line no-undef
      const res = await fetch(source);
      if (!res.ok) throw new Error(`Failed to fetch ${source}: ${res.status}`);
      const data = await res.json();
      const items = normalize(data, builtIn);
      // update cache
      try {
        const rawCache = await fs.readFile(cacheFile, "utf8").catch(() => "{}");
        const cache = rawCache ? JSON.parse(rawCache) : {};
        cache[source] = { ts: Date.now(), items };
        await fs.writeFile(cacheFile, JSON.stringify(cache), "utf8");
      } catch {}
      return items;
    }

    const raw = await fs.readFile(source, "utf8");
    const data = JSON.parse(raw);
    return normalize(data, builtIn);
  } catch (err) {
    return builtIn;
  }
}

function normalize(data: any, fallback: ToolItem[]) {
  if (!data) return fallback;
  if (Array.isArray(data)) {
    return data
      .map((x) => {
        if (typeof x === "string") return { name: x } as ToolItem;
        if (x && typeof x === "object") {
          return {
            name: x.name ? String(x.name) : undefined,
            hint: x.hint ? String(x.hint) : undefined,
            recommends: Array.isArray(x.recommends)
              ? x.recommends.map(String)
              : undefined,
          } as ToolItem;
        }
        return null;
      })
      .filter((t): t is ToolItem => !!t && !!t.name);
  }
  return fallback;
}
