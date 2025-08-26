import { Eta } from "eta";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentConfig } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "../templates");

type FrontMatter = {
  when?: Partial<{ preset: string; libraries: string[] }>;
  emit?: boolean;
  outPath?: string;
};

const FRONT_RE = /^---json\s*\n([\s\S]*?)\n---\s*\n?/;

/**
 * Parse a JSON-front-matter block from a template file.
 *
 * Templates may start with a block like:
 * ---json
 * { "when": { "preset": "openai" }, "outPath": "agent.md" }
 * ---
 *
 * @param src - raw template source
 * @returns parsed front matter and the remaining body
 */
function parseFrontMatter(src: string): { fm: FrontMatter; body: string } {
  const m = src.match(FRONT_RE);
  if (!m) return { fm: {}, body: src };
  const fm = JSON.parse(m[1] || "{}") as FrontMatter;
  return { fm, body: src.slice(m[0].length) };
}

/**
 * Test whether a template's `when` conditions match the provided config.
 *
 * @param cfg - the current AgentConfig
 * @param when - optional front-matter `when` constraints
 */
function matchesWhen(cfg: AgentConfig, when?: FrontMatter["when"]) {
  if (!when) return true;
  if (when.preset && when.preset !== (cfg.preset ?? "")) return false;
  if (when.libraries && when.libraries.length) {
    const set = new Set(cfg.libraries ?? []);
    if (!when.libraries.some((x) => set.has(x as any))) return false;
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

/**
 * Render all templates to a map of output path -> content.
 *
 * This will evaluate Eta templates under `templates/common` and return a
 * flat object containing the final content for each output path.
 *
 * @param cfg - parsed AgentConfig used as the template context
 */
export async function renderTemplates(
  cfg: AgentConfig,
  opts?: { emitAgents?: boolean }
) {
  // Enable `useWith: true` so provider templates that reference `cfg` at the
  // top-level continue to work. When rendering we also pass an `it` object
  // containing `cfg` so templates that use `it.cfg` (the common templates)
  // still function correctly.
  const eta = new Eta({ views: TEMPLATES_DIR, useWith: true });
  // Provide sane defaults so calling code (tests, scripts) can pass a small
  // cfg object without needing to populate every nested field that templates
  // might reference.
  const defaultStyle = { tsconfig: "strict", naming: "kebab", docs: "typedoc" };
  const c: any = cfg as any;
  const renderCfg: AgentConfig = {
    name: c.name,
    displayName: c.displayName,
    preset: c.preset,
    libraries: c.libraries ?? [],
    tools: c.tools ?? [],
    policies: c.policies ?? {},
    style: { ...(c.style ?? {}), ...defaultStyle },
    styleRules: c.styleRules ?? [],
  } as any;
  const all = await walk(TEMPLATES_DIR);
  const outputs: Record<string, string> = {};

  for (const abs of all) {
    const rel = path.relative(TEMPLATES_DIR, abs);
    const raw = await fs.readFile(abs, "utf8");
    const { fm, body } = parseFrontMatter(raw);
    // Handle provider-specific templates under templates/agents/<provider>/...
    const parts = rel.split(path.sep);
    if (rel.startsWith("agents/")) {
      const provider = parts[1] || undefined;
      const hasWhen = !!fm.when;
      const candidate = fm.emit === true || (opts && opts.emitAgents === true);
      // By default skip provider-specific templates unless explicitly requested
      // via opts.emitAgents or per-template front-matter `emit: true`.
      if (!candidate) continue;

      // Determine whether there are `when` constraints to enforce. If the
      // template provided explicit `when`, enforce it. If we are emitting due
      // to the `emitAgents` option, infer the preset from the provider folder
      // and enforce that. If the template had `emit: true` but no `when`, do
      // not enforce a preset match.
      let effectiveWhen = fm.when;
      if (!effectiveWhen && opts && opts.emitAgents && provider) {
        effectiveWhen = { preset: provider };
      }
      if (effectiveWhen && !matchesWhen(renderCfg, effectiveWhen)) continue;
    } else {
      if (!matchesWhen(renderCfg, fm.when)) continue;
    }

    // Place files from `templates/common/**` at the root of the generated pack
    const defaultOut = rel.replace(/^common\//, "").replace(/\.eta$/, "");
    const outPath = fm.outPath ?? defaultOut;
    // Provide both `cfg` (for provider templates) and `it: { cfg }` so both
    // styles of templates work: those that directly reference `cfg` and those
    // that expect `it.cfg`.
    const rendered = eta.renderString(body, {
      cfg: renderCfg,
      it: { cfg: renderCfg } as any,
    });
    if (typeof rendered !== "string") continue;
    outputs[outPath] = rendered;
  }
  return outputs;
}
