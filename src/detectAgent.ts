import fs from "node:fs/promises";
import path from "node:path";

type DetectResult = {
  config?: Record<string, any>;
  name?: string;
  displayName?: string;
  slug?: string;
  tools?: any[];
  examples?: string[];
  policies?: string | null;
};

// Best-effort detection and parsing of existing agent instruction files.
// This is intentionally permissive: any failure returns an empty object.
export async function detectAgent(root: string): Promise<DetectResult> {
  const out: DetectResult = {};
  try {
    const cfgPath = path.join(root, "config", "agent.json");
    const rawCfg = await fs.readFile(cfgPath, "utf8").catch(() => "");
    if (rawCfg) {
      try {
        out.config = JSON.parse(rawCfg);
        const cfg = out.config || {};
        out.name = out.name || (cfg.name as any) || (cfg.displayName as any);
        out.displayName =
          out.displayName || (cfg.displayName as any) || (cfg.name as any);
        out.slug = out.slug || (cfg.slug as any);
        if (Array.isArray(cfg.tools)) out.tools = (cfg.tools as any[]).slice();
      } catch {}
    }
  } catch {}

  try {
    const agentMd = path.join(root, "agent.md");
    const raw = await fs.readFile(agentMd, "utf8").catch(() => "");
    if (raw) {
      if (!out.name) {
        const m = raw.match(/^#\s+(.+)$/m);
        if (m) out.name = (m[1] || "").trim();
      }
      // if displayName not set, try to find a front-matter-like title
      if (!out.displayName && out.name) out.displayName = out.name;
    }
  } catch {}

  try {
    const toolsMd = path.join(root, "tools.md");
    const raw = await fs.readFile(toolsMd, "utf8").catch(() => "");
    if (raw) {
      const toolMatches = Array.from(raw.matchAll(/^##\s+(.+)$/gm)).map(
        (r: any) => r[1].trim()
      );
      if (toolMatches.length) {
        out.tools = out.tools || [];
        for (const t of toolMatches) {
          if (!out.tools.find((x: any) => (x.name || x) === t)) {
            out.tools.push({
              name: t,
              description: `${t} (imported)`,
              input: {},
              output: {},
            });
          }
        }
      }
    }
  } catch {}

  try {
    const examplesDir = path.join(root, "examples");
    const list = await fs.readdir(examplesDir).catch(() => []);
    if (Array.isArray(list) && list.length) {
      out.examples = (out.examples || []).concat(
        list.filter((f) => typeof f === "string")
      );
    }
  } catch {}

  try {
    const policies = path.join(root, "policies.md");
    const raw = await fs.readFile(policies, "utf8").catch(() => "");
    if (raw) out.policies = raw;
  } catch {}

  return out;
}

export default detectAgent;
