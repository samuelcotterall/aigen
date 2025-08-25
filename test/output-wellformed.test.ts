import { describe, it, expect } from "vitest";
import { renderTemplates } from "../src/templates";
import { AgentConfigSchema } from "../src/schema";

describe("rendered markdown well-formedness", () => {
  it("generates markdown without template markers and balanced fences", async () => {
    const cfg = AgentConfigSchema.parse({
      name: "Test Agent",
      displayName: "Test Agent",
      slug: "test-agent",
      preset: "openai",
      libraries: ["openai"],
      style: {
        tsconfig: "strict",
        naming: "camelCase",
        docs: "tsdoc",
        tests: "vitest",
        linter: "biome",
      },
      tools: [{ name: "vitest", description: "testing", input: {} }],
    } as any);

    const outputs = await renderTemplates(cfg);
    const mdFiles = Object.entries(outputs).filter(([p]) => p.endsWith(".md"));
    expect(mdFiles.length).toBeGreaterThan(0);

    for (const [p, content] of mdFiles) {
      // non-empty
      expect(content.trim().length).toBeGreaterThan(0);
      // no raw template markers
      expect(content).not.toContain("<%");
      expect(content).not.toContain("%>");
      // balanced triple-backtick fences
      const fences = (content.match(/```/g) || []).length;
      expect(fences % 2).toBe(0);
      // at least one top-level header
      expect(content).toMatch(/^#\s+/m);
      // basic markdown link validity: [,](url) pairs should have a valid url
      const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
      for (const m of content.matchAll(linkRegex)) {
        const url = (m as any)[1];
        expect(url).toBeTruthy();
        // disallow leftover template markers inside links
        expect(url).not.toContain("<%");
      }
      // if template includes JSON front-matter (---json ... ---) ensure it's valid JSON
      const fmMatch = content.match(/^---json\s*\n([\s\S]*?)\n---\s*\n?/m);
      if (fmMatch) {
        expect(() => JSON.parse(fmMatch[1])).not.toThrow();
      }
    }
  });
});
