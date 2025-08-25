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
import { writeOutputs } from "./write.js";
import { loadDefaults, saveDefaults } from "./prefs.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadToolList, ToolItem } from "./tool-list.js";
import Fuse from "fuse.js";

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

  const preset = await select({
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
  } else {
    libs = PRESET_LIBS[preset] ?? defaults.libraries ?? ["openai"];
  }

  const tsStrict = await select({
    message: "TypeScript strictness",
    options: [
      { value: "strict", label: "strict" },
      { value: "balanced", label: "balanced" },
      { value: "loose", label: "loose" },
    ],
    initialValue: defaults.tsconfig ?? "strict",
  });
  if (isCancel(tsStrict)) return;

  let name: string;
  if (opts.name) {
    name = opts.name;
  } else {
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
  // Use Fuse.js for fuzzy matching over tool name and hint.
  const fuse = new Fuse(toolList, { keys: ["name", "hint"], threshold: 0.4 });

  const initialTools = (defaults.tools ?? []) as any[];
  const initialToolNames = Array.isArray(initialTools)
    ? initialTools
        .map((t) => (typeof t === "string" ? t : t.name))
        .filter(Boolean)
    : [];
  const selectedSet = new Set<string>(initialToolNames as string[]);
  let extraToolsRaw = "";
  while (true) {
    const query = await text({
      message:
        'Search tools/frameworks (leave blank to show all, type "done" to finish)',
      placeholder: "vitest, playwright, typescript",
    });
    if (isCancel(query)) return;
    const q = (query || "").trim();
    if (q.toLowerCase() === "done") break;

    const matches = q ? fuse.search(q).map((r) => r.item) : toolList.slice();
    const optsForPrompt = matches.map((t) => ({
      value: t.name,
      label: t.hint ? `${t.name} — ${t.hint}` : t.name,
    }));
    optsForPrompt.push({ value: "other", label: "Other / custom" });

    const picked = await multiselect({
      message: `Matches for: "${
        q || "all"
      }" — pick any to add (Esc to cancel)",`,
      options: optsForPrompt,
      initialValues: Array.from(selectedSet),
    });
    if (isCancel(picked)) return;
    const pickedList = picked as string[];
    if (pickedList.includes("other")) {
      const resp = await text({
        message: "Comma-separated custom tool names (leave empty to skip)",
        placeholder: "web.run, fileSearch, http.get",
      });
      if (isCancel(resp)) return;
      extraToolsRaw = extraToolsRaw ? `${extraToolsRaw},${resp}` : resp || "";
    }
    for (const p of pickedList) if (p && p !== "other") selectedSet.add(p);
    const again = await select({
      message: "Search for more tools?",
      options: [
        { value: "yes", label: "Yes, search again" },
        { value: "no", label: "No, I'm done" },
      ],
      initialValue: "no",
    });
    if (isCancel(again)) return;
    if (again === "no") break;
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
      }
    }
  } catch (e) {
    // doesn't exist or other error: proceed and let writeOutputs handle it
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
          }
        : { astMerge: !!opts.astMerge, runId: opts.runId, seed: opts.seed }
    );
  } catch (err) {
    console.error("Error writing outputs:", (err as any).message || err);
    return;
  }
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
  "--tools-source <url|file>",
  "URL or local JSON file path to load tool choices from"
);
program.option(
  "--name <displayName>",
  "skip prompt and use this agent display name"
);
program.action(run);
program.parseAsync(process.argv);
