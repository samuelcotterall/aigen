import { Eta } from "eta";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentConfig } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "../templates");

type FrontMatter = {
  when?: Partial<{ preset: string; libraries: string[] }>;
  outPath?: string;
};

const FRONT_RE = /^---json\s*\n([\s\S]*?)\n---\s*\n?/;

function parseFrontMatter(src: string): { fm: FrontMatter; body: string } {
  const m = src.match(FRONT_RE);
  if (!m) return { fm: {}, body: src };
  const fm = JSON.parse(m[1] || "{}") as FrontMatter;
  return { fm, body: src.slice(m[0].length) };
}

function matchesWhen(cfg: AgentConfig, when?: FrontMatter["when"]) {
  if (!when) return true;
  if (when.preset && when.preset !== (cfg.preset ?? "")) return false;
  if (when.libraries && when.libraries.length) {
    const set = new Set(cfg.libraries ?? []);
    if (!when.libraries.some((x) => set.has(x))) return false;
  }
  return true;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

export async function renderTemplates(cfg: AgentConfig) {
  const eta = new Eta({ views: TEMPLATES_DIR });
  const all = await walk(TEMPLATES_DIR);
  const outputs: Record<string, string> = {};

  for (const abs of all) {
    const rel = path.relative(TEMPLATES_DIR, abs);
    const raw = await fs.readFile(abs, "utf8");
    const { fm, body } = parseFrontMatter(raw);
    if (!matchesWhen(cfg, fm.when)) continue;

    // Place files from `templates/common/**` at the root of the generated pack
    const defaultOut = rel.replace(/^common\//, "").replace(/\.eta$/, "");
    const outPath = fm.outPath ?? defaultOut;
    const rendered = eta.renderString(body, { cfg });
    if (typeof rendered !== "string") continue;
    outputs[outPath] = rendered;
  }
  return outputs;
}
