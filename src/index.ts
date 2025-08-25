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

async function run(opts: any) {
  intro("Create Agent Instructions");
  const defaults = await loadDefaults();

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

  const name = await text({
    message: "Agent name",
    initialValue: defaults.name ?? "MyAgent",
  });
  if (isCancel(name)) return;

  const toolList = (await loadToolList(
    (opts && opts.toolsSource) || undefined
  )) as ToolItem[];
  const toolOptions = toolList.map((t) => ({
    value: t.name,
    label: t.hint ? `${t.name} — ${t.hint}` : t.name,
  }));
  toolOptions.push({ value: "other", label: "Other / custom" });
  // Fuzzy-search assisted selection loop. Users can search multiple times
  // to add more tools. Type an empty search to show all. Type `done` to finish.
  function scoreOption(optLabel: string, q: string) {
    const label = optLabel.toLowerCase();
    const qry = q.toLowerCase();
    if (!qry) return 1; // neutral score when no query
    if (label.startsWith(qry)) return 100;
    if (label.includes(qry)) return 50;
    // simple subsequence match: higher score if characters appear in order
    let i = 0;
    for (const ch of qry) {
      i = label.indexOf(ch, i);
      if (i === -1) return 0;
      i++;
    }
    return 10;
  }

  const selectedSet = new Set<string>((defaults.tools ?? []) as string[]);
  let extraToolsRaw = "";
  while (true) {
    const query = await text({
      message:
        "Search tools/frameworks (leave blank to show all, type 'done' to finish)",
      placeholder: "vitest, playwright, typescript",
    });
    if (isCancel(query)) return;
    const q = (query || "").trim();
    if (q.toLowerCase() === "done") break;

    // filter and sort options by fuzzy score
    const filtered = toolOptions
      .map((o) => ({ o, score: scoreOption(o.label, q) }))
      .filter((s) => s.score > 0 || q === "")
      .sort((a, b) => b.score - a.score)
      .map((s) => s.o);

    // ensure 'other' present at end
    const optsForPrompt = filtered.filter((x) => x.value !== "other");
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
    // handle custom entry
    if (pickedList.includes("other")) {
      const resp = await text({
        message: "Comma-separated custom tool names (leave empty to skip)",
        placeholder: "web.run, fileSearch, http.get",
      });
      if (isCancel(resp)) return;
      extraToolsRaw = extraToolsRaw ? `${extraToolsRaw},${resp}` : resp || "";
    }

    for (const p of pickedList) {
      if (p && p !== "other") selectedSet.add(p);
    }

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

  const cfg = AgentConfigSchema.parse({
    name,
    preset,
    libraries: libs,
    style: {
      tsconfig: tsStrict,
      naming: "camelCase",
      docs: "tsdoc",
      tests: "vitest",
      linter: "biome",
    },
    tools: allToolNames.map((n: string) => ({
      name: n,
      description: `${n} tool`,
      input: {},
    })),
  });
  // Persist final tool choices (including accepted recommendations and custom tools)
  await saveDefaults({
    name,
    preset,
    libraries: libs,
    tsconfig: tsStrict,
    tools: allToolNames,
  });
  // decide output parent directory
  let parentOut = process.cwd();
  if (opts.outDir) {
    parentOut = path.resolve(opts.outDir);
  } else if (opts.dev) {
    // create a temp parent directory for dev runs
    parentOut = await fs.mkdtemp(path.join(os.tmpdir(), "create-agent-"));
  }

  const outDir = await writeOutputs(parentOut, cfg);
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
  "--tools-source <url|file>",
  "URL or local JSON file path to load tool choices from"
);
program.action(run);
program.parseAsync(process.argv);
