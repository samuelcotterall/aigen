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
import fs2 from "node:fs/promises";
import fsSync from "node:fs";
import { Eta } from "eta";
import resolveName, { makeSlug } from "./name.js";
import {
  loadPreset,
  savePreset,
  DEFAULT_CONFIG_FILENAME,
  computeTemplatesFingerprint,
} from "./cli/config.js";

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

  // If a config file is passed, load it and treat the run as non-interactive
  // unless explicitly overridden. `--apply-config` is an alias for `--config`.
  const cfgFile = opts.config || opts.applyConfig || undefined;
  if (cfgFile) {
    const loaded = await loadPreset(cfgFile).catch(() => ({}));
    // merge loaded preset into opts so the rest of the flow picks it up
    opts = { ...loaded, ...opts, nonInteractive: true };
  }

  // If a preset was loaded, validate its recorded template fingerprint
  if (cfgFile) {
    try {
      const fpRecorded = (opts && opts.templateFingerprint) || undefined;
      if (fpRecorded && !opts.ignoreTemplateDrift) {
        const fpCurrent = await computeTemplatesFingerprint().catch(
          () => undefined
        );
        if (fpCurrent && fpCurrent !== fpRecorded) {
          console.error(
            `Template fingerprint mismatch: preset=${fpRecorded} current=${fpCurrent}. Use --ignore-template-drift to proceed.`
          );
          return;
        }
      }
    } catch (e) {
      console.error((e as any).message || e);
      return;
    }
  }

  // Run repository detector (src/detectEnv.ts) to seed CLI defaults and
  // influence which prompts we show. This is best-effort and must not
  // fail the CLI if the detector has issues.
  let detectedEnv: any = {};
  try {
    const mod = await import("./detectEnv.js");
    if (mod && typeof mod.detectEnvironment === "function") {
      detectedEnv = await mod
        .detectEnvironment(process.cwd())
        .catch(() => ({}));
    }
  } catch (e) {
    detectedEnv = {};
  }

  // If the detector indicates a VS Code workspace and no preset is set,
  // prefer the vscode preset by default.
  if (!defaults.preset && detectedEnv && detectedEnv.hasVSCodeFolder) {
    defaults.preset = "vscode";
  }

  // Inspect repository files to guess environment(s) and tools to enable by default
  async function detectEnvAndTools(root: string) {
    const inferredEnvs: string[] = [];
    const inferredTools = new Set<string>();
    try {
      // package.json -> node / typescript / react / frameworks
      const pkgPath = path.join(root, "package.json");
      const pkgRaw = await fs.readFile(pkgPath, "utf8").catch(() => "");
      if (pkgRaw) {
        try {
          const pkg = JSON.parse(pkgRaw);
          const deps = Object.assign(
            {},
            pkg.dependencies || {},
            pkg.devDependencies || {}
          );
          if (Object.keys(deps).length) {
            // assume Node/TypeScript project when package.json exists
            // prefer TypeScript if tsconfig or typescript dep present
            const hasTs = await fs
              .stat(path.join(root, "tsconfig.json"))
              .then(() => true)
              .catch(() => false);
            if (hasTs || deps.typescript) inferredEnvs.push("typescript");
            else inferredEnvs.push("typescript");

            // detect React / Next / Vite
            if (deps.react || deps["react-dom"] || deps.next || deps.vite)
              inferredEnvs.push("web");

            // detect common tools from deps
            const map: Record<string, string> = {
              playwright: "playwright",
              puppeteer: "puppeteer",
              vitest: "vitest",
              jest: "jest",
              axios: "axios",
              fetch: "fetch",
            };
            for (const k of Object.keys(map))
              if (deps[k]) inferredTools.add(map[k]);
          }
        } catch {}
      }

      // Python indicators
      const reqPath = path.join(root, "requirements.txt");
      const pyproject = path.join(root, "pyproject.toml");
      const hasReq = await fs
        .stat(reqPath)
        .then(() => true)
        .catch(() => false);
      const hasPyProj = await fs
        .stat(pyproject)
        .then(() => true)
        .catch(() => false);
      if (hasReq || hasPyProj) {
        inferredEnvs.push("python");
        // enable python tools
        inferredTools.add("requests");
        if (hasPyProj) inferredTools.add("poetry");
        if (hasReq) inferredTools.add("pip");
        // detect pytest from common test files
        const hasPyTest = await fs
          .stat(path.join(root, "pytest.ini"))
          .then(() => true)
          .catch(() => false);
        if (hasPyTest) inferredTools.add("pytest");
      }

      // Check for lockfiles / config files that indicate specific tools
      const files = [
        ["playwright.config.ts", "playwright"],
        ["playwright.config.js", "playwright"],
        ["vitest.config.ts", "vitest"],
        ["vitest.config.js", "vitest"],
        ["jest.config.js", "jest"],
        ["jest.config.ts", "jest"],
      ];
      for (const [f, tool] of files) {
        const p = path.join(root, f);
        if (
          await fs
            .stat(p)
            .then(() => true)
            .catch(() => false)
        )
          inferredTools.add(tool);
      }
    } catch (e) {
      // ignore failures, inference is best-effort
    }
    // dedupe inferred envs and default to typescript when none found
    const uniqEnvs = Array.from(new Set(inferredEnvs));
    if (uniqEnvs.length === 0) uniqEnvs.push("typescript");
    return { environments: uniqEnvs, tools: Array.from(inferredTools) };
  }

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

  // New: environment profiles (language/runtime) with suggested tools
  const ENV_PROFILES: Record<string, { label: string; defaults: string[] }> = {
    typescript: { label: "TypeScript/Node", defaults: ["fetch", "vitest"] },
    python: { label: "Python", defaults: ["requests", "pytest"] },
    web: { label: "Browser/Frontend", defaults: ["fetch", "playwright"] },
    other: { label: "Other / polyglot", defaults: [] },
  };

  // Ask for environment selection first; these set recommended tool defaults.
  let environments: string[] = [];
  // run quick detection in cwd for best-effort inference
  const inferred = await detectEnvAndTools(process.cwd());
  const inferredEnvs = inferred.environments || [];
  const inferredTools = new Set(inferred.tools || []);

  if (opts.nonInteractive) {
    environments = opts.environments ?? defaults.environments ?? inferredEnvs;
    // merge inferred tools into defaults when non-interactive
    for (const t of inferredTools) {
      if (
        !defaults.tools ||
        !defaults.tools.find((x: any) => (x.name || x) === t)
      ) {
        // push simple string tool names into defaults.tools for initial selection
        (defaults.tools = defaults.tools || []).push(t);
      }
    }
  } else {
    const envOptions = Object.entries(ENV_PROFILES).map(([k, v]) => ({
      value: k,
      label: v.label,
    }));
    // preselect inferred envs merged with persisted defaults
    const preSelectedEnvs = Array.from(
      new Set([...(defaults.environments || []), ...inferredEnvs])
    );
    const envPicked = await multiselect({
      message: "Select target environment(s) (affects recommended tools)",
      options: envOptions,
      initialValues: preSelectedEnvs.length ? preSelectedEnvs : ["typescript"],
    });
    if (!envPicked) return;
    environments = envPicked as string[];
  }

  // Collect environment-suggested tools (from ENV_PROFILES and inferred detection)
  const envSuggestedTools = new Set<string>();
  for (const e of environments) {
    const prof = ENV_PROFILES[e];
    if (prof && prof.defaults)
      for (const t of prof.defaults) envSuggestedTools.add(t);
  }
  // merge inferred tools (from repo files)
  for (const t of Array.from(inferredTools)) envSuggestedTools.add(t);

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

  // Defer choosing the agent `name` until right before we build the final
  // configuration so it's the last interactive step. Populate `name` later.
  let name: string | undefined;

  const toolList = (await loadToolList(
    (opts && opts.toolsSource) || undefined
  )) as ToolItem[];
  // filter toolList by selected environments (language/ecosystem) but keep inferred and default selections
  function matchesEnv(tool: any, envs: string[]) {
    if (!envs || envs.length === 0) return true;
    const lowered = envs.map(String).map((s) => s.toLowerCase());
    if (tool.language && lowered.includes(String(tool.language).toLowerCase()))
      return true;
    if (
      tool.ecosystem &&
      lowered.includes(String(tool.ecosystem).toLowerCase())
    )
      return true;
    // special mappings
    if (
      lowered.includes("typescript") &&
      (tool.language === "javascript" || tool.language === "typescript")
    )
      return true;
    if (
      lowered.includes("web") &&
      (tool.ecosystem === "browser" || tool.ecosystem === "node")
    )
      return true;
    if (lowered.includes("python") && tool.language === "python") return true;
    return false;
  }
  function formatToolLabel(t: any) {
    const meta = [] as string[];
    if (t.hint) meta.push(t.hint);
    if (t.language) meta.push(String(t.language));
    if (t.ecosystem) meta.push(String(t.ecosystem));
    const suffix = meta.length ? ` — ${meta.join(" / ")}` : "";
    return `${t.name}${suffix}`;
  }
  // Truncate text to a single line and a given max length.
  function truncateOneLine(s: any, max = 80) {
    if (!s && s !== 0) return "";
    const one = String(s).replace(/\s+/g, " ").trim();
    if (one.length <= max) return one;
    return one.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
  }

  function formatToolHint(t: any) {
    // Prefer explicit description, fall back to hint or combined meta
    const base = t.description || t.hint || formatToolLabel(t);
    return truncateOneLine(base, 80);
  }

  // Ensure an Enquirer choice is a plain object with the expected fields.
  function normalizeChoice(choice: any) {
    if (!choice || typeof choice !== "object") {
      const v = choice == null ? "" : String(choice);
      return { name: v, message: v, value: v, disabled: false };
    }
    return {
      name: choice.name || String(choice.value || choice.message || ""),
      message: choice.message || String(choice.name || choice.value || ""),
      value: choice.value ?? choice.name,
      disabled: !!choice.disabled,
      selected: !!choice.selected,
      hint: choice.hint || "",
    } as any;
  }
  // --- Rules / Rulesets support -----------------------------------------
  // Load the project-style schema and expose a flat list of rules.
  async function loadSchemaRules() {
    try {
      const raw = await fs2.readFile(
        path.join(process.cwd(), "schemas", "eslint-style.schema.json"),
        "utf8"
      );
      const schema = JSON.parse(raw) as Record<string, any>;
      const props = (schema.properties || {}) as Record<string, any>;
      const rules: any[] = [];
      for (const [sectionKey, sectionRaw] of Object.entries(props)) {
        const section = sectionRaw as Record<string, any>;
        if (section && section.type === "object" && section.properties) {
          for (const [k, propRaw] of Object.entries(section.properties)) {
            const prop = propRaw as Record<string, any>;
            const id = `${sectionKey}.${k}`;
            rules.push({
              id,
              section: sectionKey,
              key: k,
              description: prop.description || "",
              appliesTo: prop.appliesTo || null,
              type: prop.type || null,
            });
          }
        } else {
          const id = sectionKey;
          const sec = section as Record<string, any>;
          rules.push({
            id,
            section: null,
            key: sectionKey,
            description: (sec && sec.description) || "",
            appliesTo: (sec && sec.appliesTo) || null,
            type: (sec && sec.type) || null,
          });
        }
      }
      return rules;
    } catch (e) {
      return [];
    }
  }

  // Predefined rulesets mapping. Each ruleset references rule ids from the
  // master schema. We default to including whole sections for common envs.
  function buildRulesetsFrom(rules: any[]) {
    const bySection: Record<string, string[]> = {};
    for (const r of rules) {
      const sec = r.section || "general";
      bySection[sec] = bySection[sec] || [];
      bySection[sec].push(r.id);
    }
    const RULESETS: Record<string, string[]> = {
      typescript: [
        ...(bySection["projectStructure"] || []),
        ...(bySection["fileConventions"] || []),
        ...(bySection["fileLimits"] || []),
        ...(bySection["namingConventions"] || []),
        ...(bySection["documentation"] || []),
        ...(bySection["scripts"] || []),
        ...(bySection["testingConventions"] || []),
      ],
      python: [
        ...(bySection["projectStructure"] || []),
        ...(bySection["fileConventions"] || []),
        ...(bySection["fileLimits"] || []),
        ...(bySection["documentation"] || []),
        ...(bySection["scripts"] || []),
        ...(bySection["testingConventions"] || []),
      ],
      web: [
        ...(bySection["projectStructure"] || []),
        ...(bySection["fileConventions"] || []),
        ...(bySection["documentation"] || []),
        ...(bySection["scripts"] || []),
      ],
      default: rules.map((r: any) => r.id),
    };
    return RULESETS;
  }
  const toolOptions = toolList
    .filter((t) => matchesEnv(t, environments))
    .map((t) => ({
      value: t.name,
      // fallback options (non-Enquirer) should show only the name so
      // descriptions aren't always visible.
      label: t.name,
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
  // seed initial selections with environment suggestions
  for (const s of Array.from(envSuggestedTools))
    if (!initialToolNames.includes(s)) initialToolNames.push(s);
  const selectedSet = new Set<string>(initialToolNames as string[]);
  let extraToolsRaw = "";
  // Before prompting: do not print a duplicate header here — the interactive
  // prompt will show the same message. Keep this block intentionally empty.
  // Live multi-select using Enquirer: type to filter choices, space to toggle
  // an item, and Enter to submit the selection. This provides a native
  // filter-as-you-type experience without a separate query step.
  // Normalize choices: ensure valid shape, dedupe by name, and provide safe defaults
  const choiceMap = new Map<string, any>();
  for (const t of toolList || []) {
    if (!t || !t.name) continue;
    if (choiceMap.has(t.name)) continue;
    // only include a tool in choices if it matches the selected envs, or
    // it's in the selectedSet (inferred/default) so users can unselect it.
    if (!matchesEnv(t, environments) && !selectedSet.has(t.name)) continue;
    choiceMap.set(t.name, {
      name: t.name,
      // show only the name in the list; provide a short one-line hint
      // that Enquirer will surface when the item is focused.
      message: t.name,
      hint: formatToolHint(t),
      value: t.name,
      disabled: false,
      selected: selectedSet.has(t.name),
    });
  }
  choiceMap.set("other", {
    name: "other",
    message: "Other / custom",
    value: "other",
    disabled: false,
    selected: false,
  });
  const enquirerChoices = Array.from(choiceMap.values()).map(normalizeChoice);

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

  // --- RULES selection step ---------------------------------------------
  // Moved after `useEnquirer` so we can safely use it.
  const allRules = await loadSchemaRules();
  const RULESETS = buildRulesetsFrom(allRules);
  // Load prior feedback to seed selections
  const priorFeedback = (await loadDefaults()).ruleFeedback || {};

  // Determine default ruleset selection based on envs + libraries
  const candidateRules = new Set<string>();
  for (const e of environments) {
    const set = RULESETS[e] || RULESETS["default"] || [];
    for (const r of set) candidateRules.add(r);
  }
  // Also add rules that apply specifically to selected libraries
  for (const r of allRules) {
    if (r.appliesTo && Array.isArray(r.appliesTo)) {
      for (const lib of libs)
        if (r.appliesTo.includes(lib)) candidateRules.add(r.id);
    }
  }

  // Build choices for rules: show '[section] key' and a one-line truncated
  // description as the hint. Keep `value` as the canonical `id`.
  function listLabel(r: any) {
    const section = r.section ? `[${r.section}] ` : "";
    return `${section}${r.key}`;
  }

  function ruleDoDontText(r: any) {
    // Small, generic Do/Don't guidance derived from description and type.
    const desc = r.description || listLabel(r);
    const doLine = `Do: ${truncateOneLine("Follow: " + desc, 100)}`;
    const dontLine = `Don't: violate this guideline without justification.`;
    return `${doLine}\n${dontLine}`;
  }

  const ruleChoices = allRules.map((r) =>
    normalizeChoice({
      name: r.id,
      message: listLabel(r),
      value: r.id,
      selected: priorFeedback.hasOwnProperty(r.id)
        ? !!priorFeedback[r.id]
        : candidateRules.has(r.id),
      hint: truncateOneLine(
        (r.description || "") +
          (r.appliesTo
            ? ` (applies to: ${[].concat(r.appliesTo).join(", ")})`
            : ""),
        80
      ),
    })
  );

  // Offer an inspection loop so the user can view details for any rule.
  if (!opts.nonInteractive) {
    // Let the user optionally inspect rules before final selection.
    const wantsInspect = await select({
      message: "Would you like to inspect rules before selecting?",
      options: [
        { value: "yes", label: "Yes, inspect rules" },
        { value: "no", label: "No, go to selection" },
      ],
      initialValue: "no",
    });
    if (isCancel(wantsInspect)) return;
    if (wantsInspect === "yes") {
      // Show a searchable list of rule ids (simple select) and display details
      let keepInspecting = true;
      while (keepInspecting) {
        const pick = await select({
          message: "Pick a rule to inspect (or Cancel to finish)",
          options: allRules.map((r) => ({ value: r.id, label: listLabel(r) })),
        });
        if (isCancel(pick)) break;
        const pickedRule = allRules.find((rr) => rr.id === pick);
        if (pickedRule) {
          // show details: truncated one-line desc, applies-to, and Do/Don't
          console.log("\n", listLabel(pickedRule));
          const appliesLine = pickedRule.appliesTo
            ? `Applies to: ${[].concat(pickedRule.appliesTo).join(", ")}`
            : null;
          console.log(
            "  ",
            truncateOneLine(pickedRule.description || "(no description)", 100)
          );
          if (appliesLine) console.log("  ", appliesLine);
          console.log(
            "\n  ",
            ruleDoDontText(pickedRule).replace(/\n/g, "\n  ")
          );
          // allow quick toggle
          const toggle = await select({
            message: `Toggle this rule? (currently ${
              candidateRules.has(pickedRule.id) ? "enabled" : "disabled"
            })`,
            options: [
              { value: "enable", label: "Enable" },
              { value: "disable", label: "Disable" },
              { value: "skip", label: "Skip" },
            ],
            initialValue: "skip",
          });
          if (!isCancel(toggle)) {
            if (toggle === "enable") candidateRules.add(pickedRule.id);
            if (toggle === "disable") candidateRules.delete(pickedRule.id);
          }
        }
        const cont = await select({
          message: "Inspect another rule?",
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No, continue to selection" },
          ],
          initialValue: "yes",
        });
        if (isCancel(cont) || cont === "no") keepInspecting = false;
      }
    }
  }

  // Ask the user to review/select rules (Enquirer when available)
  let selectedRuleIds: string[] = [];
  try {
    if (!opts.nonInteractive && useEnquirer) {
      const ans = await Enquirer.prompt({
        type: "multiselect",
        name: "rules",
        message:
          "Select style rules to enable (space to toggle, Enter to finish)",
        choices: ruleChoices as any,
        limit: 20,
      } as unknown as any);
      selectedRuleIds = (ans as any).rules || [];
    } else if (!opts.nonInteractive) {
      const picked = (await multiselect({
        message: "Select style rules to enable",
        options: allRules.map((r) => ({ value: r.id, label: r.id })),
        initialValues: allRules
          .filter((r) => candidateRules.has(r.id))
          .map((r) => r.id),
      })) as string[];
      selectedRuleIds = picked || [];
    } else {
      // non-interactive: respect prior feedback or candidateRules
      selectedRuleIds = Object.keys(priorFeedback).length
        ? Object.keys(priorFeedback).filter((k) => priorFeedback[k])
        : Array.from(candidateRules);
    }
  } catch (e) {
    // fallback: use candidateRules
    selectedRuleIds = Array.from(candidateRules);
  }

  // Persist user's rule feedback for next runs (mapping ruleId -> enabled)
  try {
    const feedbackMap: Record<string, boolean> = {};
    for (const r of allRules)
      feedbackMap[r.id] = selectedRuleIds.includes(r.id);
    await saveDefaults({
      ...(await loadDefaults()),
      ruleFeedback: feedbackMap,
    });
  } catch (e) {}

  // Allow the user to review pre-selected tools first (before adding more).
  // This is a dedicated, lightweight multiselect that only shows the
  // currently pre-selected tools so users can uncheck any they don't want.
  if (!opts.nonInteractive) {
    const preSelected = Array.from(selectedSet || []);
    if (preSelected.length) {
      try {
        if (useEnquirer) {
          try {
            const reviewChoices = preSelected
              .map((n) => {
                const found = toolList.find((tt) => tt.name === n);
                return {
                  name: n,
                  message: n,
                  value: n,
                  selected: true,
                  hint: found ? formatToolHint(found) : "",
                };
              })
              .map(normalizeChoice);
            const reviewAns = await Enquirer.prompt({
              type: "multiselect",
              name: "reviewed",
              message: "Recommended Tools (space to toggle, Enter to finish)",
              choices: reviewChoices as any,
              limit: Math.max(6, Math.min(12, reviewChoices.length)),
            } as unknown as any);
            const kept = (reviewAns as any).reviewed as string[];
            selectedSet.clear();
            for (const k of kept || []) selectedSet.add(k);
          } catch (err) {
            // Enquirer failed for review step, fallback to clack multiselect
            const kept = (await multiselect({
              message: "Recommended Tools (space to toggle, Enter to finish)",
              options: preSelected.map((s) => ({ value: s, label: s })),
              initialValues: preSelected,
            })) as string[];
            if (!kept) return;
            selectedSet.clear();
            for (const k of kept) selectedSet.add(k);
          }
        } else {
          const kept = (await multiselect({
            message: "Recommended Tools (space to toggle, Enter to finish)",
            options: preSelected.map((s) => ({ value: s, label: s })),
            initialValues: preSelected,
          })) as string[];
          if (!kept) return;
          selectedSet.clear();
          for (const k of kept) selectedSet.add(k);
        }
      } catch {}
    }
  }

  if (opts.nonInteractive) {
    // Non-interactive: respect provided opts.tools or defaults. Do not prompt.
    if (Array.isArray(opts.tools)) {
      for (const t of opts.tools) {
        const n = typeof t === "string" ? t : t.name;
        if (n && n !== "other") selectedSet.add(n);
      }
    }
    if (opts.extraTools) extraToolsRaw = String(opts.extraTools);
  } else if (!useEnquirer) {
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
    // Make this optional: ask whether the user wants to review recommendations.
    if (!opts.nonInteractive) {
      const wantRec = await select({
        message: "Add recommended tools based on your selections?",
        options: [
          { value: "yes", label: "Yes, show recommendations" },
          { value: "no", label: "No, skip" },
        ],
        initialValue: "yes",
      });
      if (!isCancel(wantRec) && wantRec === "yes") {
        const recChoices = await multiselect({
          message:
            "Recommended tools based on your selections — add any you want",
          options: recList.map((r) => ({ value: r, label: r })),
        });
        if (!isCancel(recChoices)) {
          const chosen = (recChoices as string[]).filter(Boolean);
          allToolNames.push(...chosen);
        }
      }
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

  // Build rich styleRules objects for inclusion in config/agent.json.
  // Each rule includes id, label, description, appliesTo, and derived Do/Don't text.
  // Load curated rule example templates once per run and reuse synchronously
  let _ruleExampleCache: Record<string, string> | null = null;
  async function loadRuleExampleTemplatesOnce() {
    if (_ruleExampleCache) return _ruleExampleCache;
    try {
      const tmplDir = path.join(
        process.cwd(),
        "templates",
        "common",
        "rule-examples"
      );
      if (!fsSync.existsSync(tmplDir)) return (_ruleExampleCache = {});
      const files = await fs2.readdir(tmplDir);
      const eta = new Eta({ views: path.join(process.cwd(), "templates") });
      const out: Record<string, string> = {};
      for (const f of files) {
        if (!f.endsWith(".eta")) continue;
        const name = f.replace(/\.md\.eta$/, "");
        const raw = await fs2.readFile(path.join(tmplDir, f), "utf8");
        const body = raw.replace(/^---json[\s\S]*?---\s*\n?/, "");
        const rendered = eta.renderString(body, { cfg: {} });
        out[name] = typeof rendered === "string" ? rendered.trim() : "";
      }
      return (_ruleExampleCache = out);
    } catch (e) {
      return (_ruleExampleCache = {});
    }
  }

  function makeRuleObject(rule: any) {
    const label =
      rule.label || (rule.section ? `[${rule.section}] ${rule.key}` : rule.id);
    const baseDesc = rule.description || label || rule.id;
    // Minimal example generator: produce 1-2 sentence examples based on appliesTo and description
    function generateExampleTextSync(
      r: any,
      templates: Record<string, string>
    ) {
      try {
        const candidates: string[] = [];
        if (r.section) candidates.push(r.section.toLowerCase());
        if (r.key) candidates.push(r.key.toLowerCase());
        if (
          String(r.id || "")
            .toLowerCase()
            .includes("name")
        )
          candidates.push("naming");
        if (
          String(r.id || "")
            .toLowerCase()
            .includes("format")
        )
          candidates.push("formatting");
        if (
          String(r.id || "")
            .toLowerCase()
            .includes("test")
        )
          candidates.push("testing");
        if (
          String(r.id || "")
            .toLowerCase()
            .includes("security")
        )
          candidates.push("security");
        for (const c of candidates) if (templates[c]) return templates[c];
        const parts: string[] = [];
        if (r.appliesTo) {
          const apps = [].concat(r.appliesTo).slice(0, 3).join(", ");
          parts.push(`This rule primarily applies to ${apps}.`);
        }
        if (r.description) {
          const short = String(r.description).split(". ")[0];
          parts.push(`In practice: ${short}.`);
        }
        if (!parts.length)
          parts.push("Apply this rule when relevant to the codebase.");
        return parts.join(" ");
      } catch (e) {
        return "Apply this rule when relevant to the codebase.";
      }
    }
    // Produce a short do/don't pair with an example sentence when possible.
    const shortDo = rule.doText || rule.do || rule.suggestion;
    const shortDont = rule.dontText || rule.dont;
    const derivedDo =
      shortDo || `Follow this guideline: ${String(baseDesc).trim()}.`;
    const derivedDont =
      shortDont ||
      `Avoid deviations from this guideline unless you document why.`;
    // Add an examples paragraph when the rule has an appliesTo hint or longer description.
    // prefer curated templates when available (load once synchronously via cached promise)
    const templatesSync = (() => {
      // NOTE: we intentionally call the async loader but rely on cached value
      // when available; if not yet loaded the template map will be empty.
      loadRuleExampleTemplatesOnce().catch(() => {});
      return _ruleExampleCache || {};
    })();
    const example = (() => {
      if (rule.examples && Array.isArray(rule.examples) && rule.examples[0])
        return String(rule.examples[0]);
      return generateExampleTextSync(rule, templatesSync);
    })();

    return {
      id: rule.id,
      label,
      description: String(baseDesc),
      appliesTo: rule.appliesTo || null,
      doText: derivedDo + (example ? ` ${example}` : ""),
      dontText: derivedDont,
      example: example,
    };
  }

  const styleRules = allRules
    .filter((r) => selectedRuleIds.includes(r.id))
    .map((r) => makeRuleObject(r));
  // Final: resolve name using shared resolver (last interactive step)
  const resolved = await resolveName(opts, defaults, process.cwd());
  name = opts.name || resolved.name;
  let displayName = resolved.displayName;
  // allow final interactive edit of the display name when appropriate
  if (!opts.nonInteractive && !opts.name) {
    const finalName = await text({
      message: "Agent name (final)",
      initialValue: displayName,
    });
    if (isCancel(finalName)) return;
    name = finalName as string;
    displayName = name;
  }

  // compute slug and offer edit only when derived slug differs from display name
  let slug = makeSlug(String(displayName));
  if (!opts.nonInteractive && !opts.name) {
    const derived = makeSlug(String(displayName));
    if (derived !== String(displayName)) {
      const slugEdit = await text({
        message: "Output folder slug (edit if desired)",
        initialValue: slug,
      });
      if (isCancel(slugEdit)) return;
      slug = String(slugEdit || slug);
    }
  }

  // Immediately persist chosen name/slug so subsequent steps or interruptions
  // have the chosen defaults recorded.
  try {
    const existing = await loadDefaults();
    await saveDefaults({ ...existing, name, displayName, slug });
    // Optionally export or save resolved config for deterministic replay
    if (opts.exportConfig || opts.saveConfig) {
      try {
        const exportPath = String(
          opts.exportConfig || opts.saveConfig || DEFAULT_CONFIG_FILENAME
        );
        const toSave: Record<string, any> = {
          schemaVersion: "1.0",
          generatorVersion: (await import("../package.json")).version,
          timestamp: new Date().toISOString(),
          name,
          displayName,
          slug,
          preset,
          libraries: libs,
          environments,
          tools: structuredTools,
        };
        try {
          const fp = await computeTemplatesFingerprint();
          if (fp) toSave.templateFingerprint = fp;
        } catch {}
        if (opts.seed) toSave.randomSeed = opts.seed;
        const saved = await savePreset(exportPath, toSave);
        console.log(`Exported resolved config to: ${saved}`);
      } catch (e) {}
    }
  } catch (e) {}

  const cfg = AgentConfigSchema.parse({
    name,
    displayName,
    slug,
    preset,
    libraries: libs,
    style: {
      // generalize strictness: store under `strictness` and keep tsconfig if TypeScript selected
      tsconfig: tsStrict,
      naming: "camelCase",
      docs: "tsdoc",
      tests: "vitest",
      linter: "biome",
    },
    tools: structuredTools,
    // include the selected rules with richer metadata for templates and downstream tools
    styleRules,
  });
  // Persist final tool choices (including accepted recommendations and custom tools)
  await saveDefaults({
    name,
    displayName,
    slug,
    preset,
    libraries: libs,
    tsconfig: tsStrict,
    environments,
    tools: structuredTools,
  });
  // decide output parent directory
  let parentOut = process.cwd();
  if (opts.outDir) {
    parentOut = path.resolve(opts.outDir);
  } else if (opts.dev) {
    // use ./out for dev runs so temporary/dev outputs stay in the repo
    const outRoot = path.join(process.cwd(), "out");
    try {
      await fs.mkdir(outRoot, { recursive: true });
    } catch {}
    parentOut = await fs.mkdtemp(path.join(outRoot, "create-agent-"));
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
    previewMap = await renderTemplates(cfg, {
      emitAgents: !!opts.emitAgents,
      seed: opts.seed,
    });
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
      const preview = await renderTemplates(cfg, {
        emitAgents: !!opts.emitAgents,
      });
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
program.option(
  "--emit-agents",
  "include provider-specific templates under templates/agents in generated output"
);
program.option("--non-interactive", "run without prompts (use flags/defaults)");
program.option("--dry-run", "preview generated files without writing them");
program.option("--yes", "assume yes for overwrite prompts (non-interactive)");
program.option("--confirm-overwrite", "skip prompt and confirm overwrite");
program.option(
  "--config <file>",
  "load a preset/config JSON file to run non-interactively"
);
program.option("--apply-config <file>", "alias for --config (explicit apply)");
program.option(
  "--export-config <file>",
  "export the resolved config for this run to a JSON file"
);
program.option(
  "--save-config <file>",
  "save the resolved config to disk (default: aigen.config.json)"
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
program.option(
  "--ignore-template-drift",
  "when applying a saved config, do not fail if template fingerprint differs"
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
// Avoid auto-executing the CLI when running under the test harness; tests
// import the module and call `run()` directly with controlled opts.
if (process.env.VITEST !== "true") {
  // add small subcommands to make applying and exporting configs explicit
  program
    .command("apply-config <file>")
    .description(
      "apply a saved aigen.config.json file and run non-interactively"
    )
    .action(async (file) => {
      await run({ config: file, nonInteractive: true });
    });

  program
    .command("export-config [file]")
    .description(
      "run and export the resolved config to a file (default: aigen.config.json)"
    )
    .action(async (file) => {
      await run({ saveConfig: file || DEFAULT_CONFIG_FILENAME });
    });

  program
    .command("save-config [file]")
    .description("alias for export-config")
    .action(async (file) => {
      await run({ saveConfig: file || DEFAULT_CONFIG_FILENAME });
    });

  program.parseAsync(process.argv);
}
