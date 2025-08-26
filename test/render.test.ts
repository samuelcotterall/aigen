import { describe, it, expect } from "vitest";
import { renderTemplates } from "../src/templates.js";

describe("template renderer", () => {
  it("renders agent.md with style rules and do/don't", async () => {
    const cfg: any = {
      name: "test-agent",
      displayName: "Test Agent",
      preset: "openai",
      libraries: ["react"],
      tools: [{ name: "fetch", description: "HTTP" }],
      policies: { safetyLevel: "low" },
      style: { tsconfig: "strict", naming: "kebab", docs: "typedoc" },
      styleRules: [
        {
          id: "r1",
          label: "[sec] r1",
          description: "desc r1",
          doText: "do r1",
          dontText: "dont r1",
          appliesTo: ["react"],
        },
      ],
    };

    const out = await renderTemplates(cfg as any);
    const agent = out["agent.md"];
    expect(agent).toBeDefined();
    expect(agent).toContain("[sec] r1");
    expect(agent).toContain("do r1");
    expect(agent).toContain("dont r1");

    // Exact structure checks: rule heading, description, Do and Don't sections
    const lines = agent.split("\n");
    // find rule heading line index
    const idx = lines.findIndex(
      (l) => l.trim().startsWith("###") && l.includes("r1")
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    // next non-empty lines should include Applies to, Description, Do:, Don't:
    const snippet = lines.slice(idx, idx + 12).join("\n");
    expect(snippet).toMatch(/Applies to:/);
    expect(snippet).toMatch(/Description:/);
    expect(snippet).toMatch(/\*\*Do:\*\*/);
    expect(snippet).toMatch(/\*\*Don't:\*\*/);
    // simple snapshot-like check: ensure fenced code blocks are balanced overall
    const fenceCount = (agent.match(/```/g) || []).length;
    expect(fenceCount % 2).toBe(0);
  });

  it("renders tools.md and EXAMPLES.md and handles no rules", async () => {
    const cfg: any = {
      name: "empty-agent",
      displayName: "Empty Agent",
      preset: "openai",
      libraries: [],
      tools: [],
      policies: {},
      style: {},
      styleRules: [],
    };

    const out = await renderTemplates(cfg as any);
    expect(out["tools.md"]).toBeDefined();
    // tools should show the no-tools message
    expect(out["tools.md"]).toMatch(/No tools selected/);
    expect(out["EXAMPLES.md"]).toBeDefined();
    // agent should contain no-style-rules message
    expect(out["agent.md"]).toMatch(/No style rules were enabled/);

    // assert tools.md has a top-level header and no code-fence leaks
    const tools = out["tools.md"];
    expect(
      tools.split("\n")[0].trim().startsWith("#") || tools.includes("##")
    ).toBeTruthy();
    const toolsFenceCount = (tools.match(/```/g) || []).length;
    expect(toolsFenceCount % 2).toBe(0);
  });
});
