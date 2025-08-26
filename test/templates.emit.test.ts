import { describe, it, expect } from "vitest";
import { renderTemplates } from "../src/templates.js";
import fs from "node:fs/promises";
import path from "node:path";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

describe("renderTemplates emit options", () => {
  it("does not emit provider-specific templates by default", async () => {
    const cfg: any = {
      name: "a",
      displayName: "A",
      preset: "openai",
      libraries: [],
      tools: [],
      styleRules: [],
    };
    const out = await renderTemplates(cfg as any);
    // ensure no keys start with agents/
    const keys = Object.keys(out);
    // ensure no agent-specific output keys are present
    const hasAgentFiles = keys.some((k) => k.startsWith("agents/"));
    expect(hasAgentFiles).toBe(false);
  });

  it("honors emitAgents option to include provider templates for matching preset", async () => {
    const cfg: any = {
      name: "a",
      displayName: "A",
      preset: "openai",
      libraries: [],
      tools: [],
      styleRules: [],
    };
    const out = await renderTemplates(cfg as any, { emitAgents: true });
    // provider templates under agents/openai should be included
    const keys = Object.keys(out);
    const hasOpenai = keys.some(
      (k) =>
        k.includes("openai/agent.md") || k.includes("agents/openai/agent.md")
    );
    expect(hasOpenai).toBe(true);
  });

  it("respects per-template front-matter emit: true even when emitAgents is false", async () => {
    // create a temporary provider template file with emit: true front-matter
    const uniq = `__testtemp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const tmpDir = path.join(TEMPLATES_DIR, "agents", uniq);
    const tmpFile = path.join(tmpDir, "emit.md.eta");
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      const content = `---json\n{ "emit": true }\n---\n\n# Temp Emit\n\nThis is a test.`;
      await fs.writeFile(tmpFile, content, "utf8");
      const cfg: any = {
        name: "x",
        displayName: "X",
        preset: "openai",
        libraries: [],
        tools: [],
        styleRules: [],
      };
      const out = await renderTemplates(cfg as any);
      // should include the tmp emitted file
      const keys = Object.keys(out);
      const found = keys.some((k) => k.endsWith("emit.md") || k.includes(uniq));
      expect(found).toBe(true);
    } finally {
      // cleanup deterministically
      try {
        await fs.rm(tmpFile, { force: true });
      } catch {}
      try {
        await fs.rmdir(tmpDir);
      } catch {}
    }
  });

  it("enforces when.preset so only matching provider templates are emitted", async () => {
    // create a temp provider template with when.preset set to 'anthropic'
    const tmpDir = path.join(TEMPLATES_DIR, "agents", "__testtemp2__");
    try {
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, "only-anthropic.md.eta");
      const content = `---json\n{ "when": { "preset": "anthropic" }, "emit": true }\n---\n\n# Anthropic Only\n`;
      await fs.writeFile(tmpFile, content, "utf8");
      const cfgOpenai: any = {
        name: "x",
        displayName: "X",
        preset: "openai",
        libraries: [],
        tools: [],
        styleRules: [],
      };
      const outOpenai = await renderTemplates(cfgOpenai as any, {
        emitAgents: true,
      });
      const keysOpen = Object.keys(outOpenai);
      expect(keysOpen.some((k) => k.includes("only-anthropic"))).toBe(false);

      const cfgAnth: any = {
        name: "y",
        displayName: "Y",
        preset: "anthropic",
        libraries: [],
        tools: [],
        styleRules: [],
      };
      const outAnth = await renderTemplates(cfgAnth as any, {
        emitAgents: true,
      });
      const keysAnth = Object.keys(outAnth);
      expect(keysAnth.some((k) => k.includes("only-anthropic"))).toBe(true);

      await fs.rm(tmpFile, { force: true });
      try {
        await fs.rmdir(tmpDir);
      } catch {}
    } finally {
    }
  });
});
