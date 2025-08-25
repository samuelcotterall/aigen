#!/usr/bin/env node
import { program } from "commander";
import {
  intro,
  outro,
  select,
  multiselect,
  text,
  isCancel,
} from "@clack/prompts";
import { AgentConfigSchema } from "./schema.js";
import { writeOutputs, deepMerge } from "./write.js";
import { renderTemplates } from "./templates.js";
import { loadDefaults, saveDefaults } from "./prefs.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadToolList, ToolItem } from "./tool-list.js";
import Enquirer from "enquirer";

/**
 * CLI entry point: interactively build and write an agent instruction pack.
 *
 * This function drives the interactive prompts, gathers defaults, composes
 * an AgentConfig, and delegates to `writeOutputs` to materialize files.
 *
 * @param opts - Runtime options (e.g., { dev, outDir, astMerge, runId, seed, name, toolsSource })
 */
export async function run(opts: any) {
  intro("Create Agent Instructions");
  const defaults = await loadDefaults();

  // Try to import existing instruction files (pre-fill defaults).
  async function importExisting(dir: string) {
    const imported: any = {};
    try {
      const cfgPath = path.join(dir, "config", "agent.json");
      const raw = await fs.readFile(cfgPath, "utf8").catch(() => "");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          Object.assign(imported, parsed);
        } catch {}
      }
    } catch {}
    try {
      const agentMd = path.join(dir, "agent.md");
      const raw = await fs.readFile(agentMd, "utf8").catch(() => "");
      if (raw) {
        const m = raw.match(/^#\s+(.+)$/m);
        if (m) imported.name = imported.name || m[1].trim();
      }
    } catch {}
    try {
      const toolsMd = path.join(dir, "tools.md");
      const raw = await fs.readFile(toolsMd, "utf8").catch(() => "");
      if (raw) {
        const toolMatches = Array.from(raw.matchAll(/^##\s+(.+)$/gm)).map(
          (r: any) => r[1].trim()
        );
        if (toolMatches.length)
          imported.tools = (imported.tools || []).concat(
            toolMatches.map((n) => ({
              name: n,
              description: `${n} (imported)`,
              input: {},
            }))
          );
      }
    } catch {}
    return imported;
  }

  // Respect non-interactive scripts: use opts.preset or defaults when provided
  let preset: string;
  if (opts.nonInteractive) {
    preset = opts.preset ?? defaults.preset ?? "openai";
  } else {
    preset = await select({
      message: "Choose a preset/runtime",
      options: [
        { value: "openai", label: "OpenAI (system prompt + tools)" },
        { value: "langchain", label: "LangChain (TS)" },
        { value: "llamaindex", label: "LlamaIndex" },
        { value: "autogen", label: "AutoGen" },
        { value: "mcp", label: "Model Context Protocol (server)" },
        { value: "vscode", label: "VS Code (Copilot)" },
        { value: "custom", label: "Custom" },
      ],
      initialValue: defaults.preset ?? "openai",
    });
    if (isCancel(preset)) return;
  }

  // Map common presets to sensible library selections. Only ask for libraries
  // when the user explicitly chooses `custom`.
  const PRESET_LIBS: Record<string, string[]> = {
    openai: ["openai"],
    langchain: ["langchain"],
    llamaindex: ["llamaindex"],
    autogen: ["autogen"],
    mcp: ["mcp"],
    vscode: ["openai"],
  };

  let libs: string[] = [];
  if (preset === "custom") {
    if (opts.nonInteractive) {
      libs = opts.libraries ?? defaults.libraries ?? ["openai"];
    } else {
      const libsRes = await multiselect({
        message: "Pick libraries to target",
        options: [
          { value: "openai", label: "OpenAI SDK" },
          { value: "langchain", label: "LangChain" },
          { value: "llamaindex", label: "LlamaIndex" },
          { value: "autogen", label: "AutoGen" },
          { value: "mcp", label: "Model Context Protocol (server)" },
        ],
        initialValues: defaults.libraries ?? ["openai"],
      });
      if (isCancel(libsRes)) return;
      libs = libsRes as string[];
    }
  } else {
    libs = PRESET_LIBS[preset] ?? defaults.libraries ?? ["openai"];
  }

  let tsStrict: string;
  if (opts.nonInteractive)
    tsStrict = opts.tsconfig ?? defaults.tsconfig ?? "strict";
  else {
    tsStrict = await select({
      message: "TypeScript strictness",
      options: [
        { value: "strict", label: "strict" },
        { value: "balanced", label: "balanced" },
        { value: "loose", label: "loose" },
      ],
      initialValue: defaults.tsconfig ?? "strict",
    });
    if (isCancel(tsStrict)) return;
  }

  let name: string;
  if (opts.name) name = opts.name;
  else if (opts.nonInteractive) name = defaults.name ?? "MyAgent";
  else {
    const nameRes = await text({
      message: "Agent name",
      initialValue: defaults.name ?? "MyAgent",
    });
    if (isCancel(nameRes)) return;
    name = nameRes as string;
  }

  // sanitize to a filesystem-safe slug
  function makeSlug(s: string) {
    const out = (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_.]/g, "");
    return out || `agent-${Date.now()}`;
  }
  const displayName = name;
  const slug = makeSlug(name);
  if (
    slug !==
    name
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_.]/gi, "")
      .toLowerCase()
  ) {
    console.log(
      `Note: output folder will be created as '${slug}' (sanitized from '${name}').`
    );
  }

  const toolList = (await loadToolList(
    (opts && opts.toolsSource) || undefined
  )) as ToolItem[];
  const toolOptions = toolList.map((t) => ({
    value: t.name,
    label: t.hint ? `${t.name} — ${t.hint}` : t.name,
  }));
  toolOptions.push({ value: "other", label: "Other / custom" });
  // (Previously used Fuse.js for a two-step filter flow; replaced by a
  // live Enquirer multiselect so Fuse is no longer needed.)

  const initialTools = (defaults.tools ?? []) as any[];
  const initialToolNames = Array.isArray(initialTools)
    ? initialTools
        .map((t) => (typeof t === "string" ? t : t.name))
        .filter(Boolean)
    : [];
  const selectedSet = new Set<string>(initialToolNames as string[]);
  let extraToolsRaw = "";
  // Live multi-select using Enquirer: type to filter choices, space to toggle
  // an item, and Enter to submit the selection. This provides a native
  // filter-as-you-type experience without a separate query step.
  // Normalize choices: ensure valid shape, dedupe by name, and provide safe defaults
  const choiceMap = new Map<string, any>();
  for (const t of toolList || []) {
    if (!t || !t.name) continue;
    if (choiceMap.has(t.name)) continue;
    choiceMap.set(t.name, {
      name: t.name,
      message: t.hint ? `${t.name} — ${t.hint}` : t.name,
      value: t.name,
      disabled: false,
      checked: selectedSet.has(t.name),
    });
  }
  choiceMap.set("other", {
    name: "other",
    message: "Other / custom",
    value: "other",
    disabled: false,
    checked: false,
  });
  const enquirerChoices = Array.from(choiceMap.values());

  // Decide whether to use Enquirer (rich, filter-as-you-type) or fallback to
  // `@clack/prompts` (works in non-TTY/test environments). Prefer Enquirer
  // only when we're not running tests and we have a real TTY.
  const inTest =
    process.env.VITEST === "true" || process.env.NODE_ENV === "test";
  const hasTTY = !!(
    process.stdin &&
    process.stdin.isTTY &&
    process.stdout &&
    process.stdout.isTTY
  );
  const useEnquirer = !inTest && hasTTY;

  if (!useEnquirer) {
    // Use the clack multiselect (tests mock this) with a simple options list.
    const picked = (await multiselect({
      message: "Pick tools",
      options: toolOptions,
      initialValues: Array.from(selectedSet),
    })) as string[];
    if (!picked) return;
    if (picked.includes("other")) {
      const resp = await text({
        message: "Comma-separated custom tool names (leave empty to skip)",
        placeholder: "web.run, fileSearch, http.get",
      });
      if (isCancel(resp)) return;
      extraToolsRaw = extraToolsRaw ? `${extraToolsRaw},${resp}` : resp || "";
    }
    for (const p of picked) if (p && p !== "other") selectedSet.add(p);
  } else {
    try {
      // Enquirer can be brittle in some environments; omit `initial` to avoid
      // mismatches between provided values and choice objects. We also limit
      // items shown to keep the prompt responsive.
      const answer = await Enquirer.prompt({
        type: "multiselect",
        name: "tools",
        message:
          "Search tools/frameworks (type to filter, space to toggle, Enter to finish)",
        choices: enquirerChoices as any,
        limit: 12,
      } as unknown as any);
      const picked = (answer as any).tools as string[];
      if (!picked) return;

      if (picked.includes("other")) {
        const resp = await text({
          message: "Comma-separated custom tool names (leave empty to skip)",
          placeholder: "web.run, fileSearch, http.get",
        });
        if (isCancel(resp)) return;
        extraToolsRaw = extraToolsRaw ? `${extraToolsRaw},${resp}` : resp || "";
      }
      for (const p of picked) if (p && p !== "other") selectedSet.add(p);
    } catch (err) {
      // If Enquirer fails (some terminals or edge cases), fallback to the
      // mocked/clack multiselect flow so the CLI remains usable.
      const picked = (await multiselect({
        message: "Pick tools",
        options: toolOptions,
        initialValues: Array.from(selectedSet),
      })) as string[];
      if (!picked) return;
      if (picked.includes("other")) {
        const resp = await text({
          message: "Comma-separated custom tool names (leave empty to skip)",
          placeholder: "web.run, fileSearch, http.get",
        });
        if (isCancel(resp)) return;
        extraToolsRaw = extraToolsRaw ? `${extraToolsRaw},${resp}` : resp || "";
      }
      for (const p of picked) if (p && p !== "other") selectedSet.add(p);
    }
  }

  const selectedTools = Array.from(selectedSet);
  const allToolNames = [
    ...selectedTools,
    ...(extraToolsRaw
      ? extraToolsRaw
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : []),
  ];

  // Offer recommended tools based on selections
  const selectedItems = toolList.filter((t) => selectedTools.includes(t.name));
  const recs = new Set<string>();
  for (const it of selectedItems) {
    if (it.recommends) for (const r of it.recommends) recs.add(r);
  }
  // remove already selected
  for (const s of allToolNames) recs.delete(s);
  const recList = Array.from(recs);
  if (recList.length) {
    const recChoices = await multiselect({
      message: "Recommended tools based on your selections — add any you want",
      options: recList.map((r) => ({ value: r, label: r })),
    });
    if (!isCancel(recChoices)) {
      const chosen = (recChoices as string[]).filter(Boolean);
      allToolNames.push(...chosen);
    }
  }

  // build structured tools for config (prefer full ToolItem when available)
  // If there are imported tools from existing files, merge them by name so
  // imported descriptions/inputs are preserved and used when available.
  const importedFromFs = (await importExisting(process.cwd()).catch(
    () => ({})
  )) as any;
  const importedTools: any[] = Array.isArray(importedFromFs.tools)
    ? importedFromFs.tools
    : [];

  const structuredTools = allToolNames.map((n: string) => {
    const found = toolList.find((t) => t.name === n);
    const imported = importedTools.find((t) => t.name === n);
    if (found || imported) {
      return {
        name: (found && found.name) || imported.name || n,
        description:
          (imported && imported.description) ||
          (found && (found as any).description) ||
          (found && (found as any).hint) ||
          `${n} tool`,
        input:
          (imported && imported.input) || (found && (found as any).input) || {},
        output:
          (imported && imported.output) ||
          (found && (found as any).output) ||
          {},
        examples:
          (imported && imported.examples) ||
          (found && (found as any).examples) ||
          [],
      } as any;
    }
    return {
      name: n,
      description: `${n} tool`,
      input: {},
      output: {},
      examples: [],
    } as any;
  });

  const cfg = AgentConfigSchema.parse({
    name,
    displayName,
    slug,
    preset,
    libraries: libs,
    style: {
      tsconfig: tsStrict,
      naming: "camelCase",
      docs: "tsdoc",
      tests: "vitest",
      linter: "biome",
    },
    tools: structuredTools,
  });
  // Persist final tool choices (including accepted recommendations and custom tools)
  await saveDefaults({
    name,
    displayName,
    slug,
    preset,
    libraries: libs,
    tsconfig: tsStrict,
    tools: structuredTools,
  });
  // decide output parent directory
  let parentOut = process.cwd();
  if (opts.outDir) {
    parentOut = path.resolve(opts.outDir);
  } else if (opts.dev) {
    // create a temp parent directory for dev runs
    parentOut = await fs.mkdtemp(path.join(os.tmpdir(), "create-agent-"));
  }

  // compute candidate outDir (same logic as writeOutputs)
  let writeOpts: any = undefined;
  const candidateDir = path.join(
    parentOut,
    (cfg.slug || cfg.name)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-_.]/g, "")
      .toLowerCase() || `agent-${Date.now()}`
  );
  // pre-render templates so we can show a preview of files that would be
  // created/overwritten during confirmation.
  let previewFiles: string[] = [];
  let previewMap: Record<string, string> = {};
  try {
    previewMap = await renderTemplates(cfg);
    previewFiles = Object.keys(previewMap).map((p) => p.replace(/\\/g, "/"));
  } catch {}
  try {
    const stat = await fs.stat(candidateDir);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(candidateDir);
      if (entries.length > 0) {
        // detect common instruction files we might import as context
        const commonFiles = [
          "agent.md",
          "tools.md",
          "policies.md",
          "config/agent.json",
        ];
        const present = new Set<string>();
        for (const f of commonFiles) {
          try {
            await fs.stat(path.join(candidateDir, f));
            present.add(f);
          } catch {}
        }

        const options = [
          { value: "yes", label: "Yes, overwrite" },
          { value: "merge", label: "Merge (preserve existing files)" },
          { value: "no", label: "No, choose another output dir" },
          { value: "abort", label: "Abort" },
        ];

        let confirmMsg = `Target ${candidateDir} exists and is not empty.`;
        if (present.size > 0) {
          confirmMsg += ` Detected existing instruction files: ${Array.from(
            present
          ).join(", ")}.`;
        }

        // Show which files from the preview would be overwritten (if any)
        const wouldOverwrite: string[] = [];
        for (const f of previewFiles) {
          try {
            await fs.stat(path.join(candidateDir, f));
            wouldOverwrite.push(f);
          } catch {
            // doesn't exist, ignore
          }
        }
        if (wouldOverwrite.length) {
          confirmMsg += `\nThe following files would be overwritten:\n  ${wouldOverwrite
            .slice(0, 20)
            .join("\n  ")}`;
          if (wouldOverwrite.length > 20)
            confirmMsg += `\n  ...and ${wouldOverwrite.length - 20} more`;
        }

        // For JSON files under config/, show a small summarized diff of the
        // merged result vs existing to help users decide.
        try {
          const jsonCandidates = wouldOverwrite.filter(
            (p) => p.startsWith("config/") && p.endsWith(".json")
          );
          if (jsonCandidates.length) {
            const diffs: string[] = [];
            for (const jf of jsonCandidates.slice(0, 10)) {
              try {
                const existingRaw = await fs.readFile(
                  path.join(candidateDir, jf),
                  "utf8"
                );
                const incomingRaw =
                  previewMap[jf] ?? previewMap[jf.replace(/\\/g, "/")];
                const existing = JSON.parse(existingRaw || "{}");
                const incoming = JSON.parse(incomingRaw || "{}");
                const merged = deepMerge(existing, incoming);
                // generate lightweight summary of changes
                const changes = [] as string[];
                function walk(o: any, n: any, prefix = "") {
                  const keys = new Set<string>([
                    ...Object.keys(o || {}),
                    ...Object.keys(n || {}),
                  ]);
                  for (const k of keys) {
                    const p = prefix ? `${prefix}.${k}` : k;
                    const ov = o ? o[k] : undefined;
                    const nv = n ? n[k] : undefined;
                    if (ov === undefined && nv !== undefined)
                      changes.push(`+ ${p}`);
                    else if (ov !== undefined && nv === undefined)
                      changes.push(`- ${p}`);
                    else if (isObject(ov) && isObject(nv)) walk(ov, nv, p);
                    else if (JSON.stringify(ov) !== JSON.stringify(nv))
                      changes.push(
                        `~ ${p}: ${JSON.stringify(ov)} -> ${JSON.stringify(nv)}`
                      );
                  }
                }
                function isObject(v: any) {
                  return v && typeof v === "object" && !Array.isArray(v);
                }
                walk(existing, merged);
                if (changes.length) {
                  diffs.push(`Changes in ${jf}:`);
                  diffs.push(...changes.slice(0, 20));
                  if (changes.length > 20)
                    diffs.push(`...and ${changes.length - 20} more`);
                }
              } catch {}
            }
            if (diffs.length)
              confirmMsg += `\n\nJSON diffs:\n  ${diffs.join("\n  ")}`;
          }
        } catch {}

        // handle non-interactive scripts via flags: --merge or --force
        if (opts.nonInteractive) {
          if (opts.force) {
            // overwrite: explicitly allow overwrite
            writeOpts = { allowOverwrite: true };
          } else if (opts.yes || opts.confirmOverwrite) {
            // convenience: treat --yes or --confirm-overwrite like force
            writeOpts = { allowOverwrite: true };
          } else if (opts.merge) {
            writeOpts = { skipIfExists: true };
          } else {
            throw new Error(
              `Target ${candidateDir} exists and non-interactive mode requires --merge or --force`
            );
          }
        } else {
          const confirm = await select({
            message: confirmMsg,
            options,
            initialValue: "no",
          });
          if (isCancel(confirm) || confirm === "abort") return;
          if (confirm === "no") {
            const alt = await text({
              message: "Provide an explicit output parent directory path",
              placeholder: "./my-agent-output",
              initialValue: parentOut,
            });
            if (isCancel(alt)) return;
            parentOut = path.resolve(alt as string);
          }
          writeOpts = undefined;
          if (confirm === "merge") {
            // when merging, skip writing files that already exist so we preserve user content
            writeOpts = { skipIfExists: true };
          }
          if (confirm === "yes") {
            // user explicitly chose to overwrite
            writeOpts = { ...(writeOpts || {}), allowOverwrite: true };
          }
        }
      }
    }
  } catch (e) {
    // doesn't exist or other error: proceed and let writeOutputs handle it
  }

  // Handle dry-run: render templates and print a preview, but do not write files.
  if (opts.dryRun) {
    try {
      const preview = await renderTemplates(cfg);
      const keys = Object.keys(preview);
      console.log(
        `Dry run: ${keys.length} files would be generated under '${path.join(
          parentOut,
          cfg.slug || cfg.name
        )}'`
      );
      for (const k of keys.slice(0, 20)) console.log(` - ${k}`);
      if (keys.length > 20) console.log(` ...and ${keys.length - 20} more`);
    } catch (e) {}
    outro(`Dry run complete. No files were written.`);
    return;
  }

  let outDir: string | undefined;
  try {
    outDir = await writeOutputs(
      parentOut,
      cfg,
      typeof writeOpts !== "undefined"
        ? {
            ...writeOpts,
            astMerge: !!opts.astMerge,
            runId: opts.runId,
            seed: opts.seed,
            backupOnOverwrite: !!opts.backupOnOverwrite,
          }
        : { astMerge: !!opts.astMerge, runId: opts.runId, seed: opts.seed }
    );
  } catch (err) {
    console.error("Error writing outputs:", (err as any).message || err);
    return;
  }

  // list files written for final summary
  try {
    async function listFiles(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          const sub = await listFiles(p);
          out.push(
            ...sub.map((s) => path.relative(outDir || dir, path.join(p, s)))
          );
        } else out.push(path.relative(outDir || dir, p));
      }
      return out;
    }
    try {
      const files = await listFiles(outDir as string);
      console.log(`Wrote ${files.length} files to: ${outDir}`);
      for (const f of files.slice(0, 20)) console.log(` - ${f}`);
      if (files.length > 20) console.log(` ...and ${files.length - 20} more`);
    } catch {}
  } catch {}
  outro(`Done. Generated instruction pack for ${name}.`);
  if (opts.dev) {
    // report where the dev output landed
    console.log(`Dev output written to: ${outDir}`);
  }
}

program
  .option("--dev", "write outputs to a temporary development directory")
  .option(
    "--out-dir <path>",
    "explicit output parent directory (overrides cwd)"
  );
program.option("--non-interactive", "run without prompts (use flags/defaults)");
program.option("--dry-run", "preview generated files without writing them");
program.option("--yes", "assume yes for overwrite prompts (non-interactive)");
program.option("--confirm-overwrite", "skip prompt and confirm overwrite");
program.option(
  "--merge",
  "merge with existing files (preserve existing files)"
);
program.option(
  "--ast-merge",
  "use AST-based markdown merging (remark). Example: --ast-merge to merge sections by heading and dedupe list items; requires optional remark packages (auto-detected)."
);
program.option(
  "--run-id <id>",
  "provide a deterministic run id used in merge markers (useful for CI)"
);
program.option(
  "--seed <seed>",
  "provide a seed to derive a deterministic run id (hex-encoded sha1)"
);
program.option("--force", "force overwrite without prompting");
program.option(
  "--backup-on-overwrite",
  "create .bak backups before overwriting files"
);
program.option(
  "--tools-source <url|file>",
  "URL or local JSON file path to load tool choices from"
);
program.option(
  "--name <displayName>",
  "skip prompt and use this agent display name"
);
program.action(run);
program.parseAsync(process.argv);
