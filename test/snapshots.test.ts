import { describe, it, expect } from "vitest";
import { renderTemplates } from "../src/templates.js";

describe("render snapshots", () => {
  it("agent and docs match snapshot for sample config", async () => {
    const cfg: any = {
      name: "snapshot-agent",
      displayName: "Snapshot Agent",
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

    // snapshot the main outputs (per-template snapshots)
    expect(out["agent.md"]).toMatchSnapshot("agent.md");
    expect(out["tools.md"]).toMatchSnapshot("tools.md");
    expect(out["policies.md"]).toMatchSnapshot("policies.md");
    expect(out["EXAMPLES.md"]).toMatchSnapshot("EXAMPLES.md");
  });
});
