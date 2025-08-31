import { describe, it, expect } from "vitest";
import { generateGuardrails } from "../src/guardrails/generate";

describe("guardrails generation", () => {
  it("renders and validates standard guardrails", async () => {
    const cfg = { name: "test-agent" };
    const res = await generateGuardrails(cfg, { level: "standard", seed: 42 });
    expect(res).toBeDefined();
    expect(res.guardrails).toBeDefined();
    expect(Array.isArray(res.guardrails.policies)).toBe(true);
    expect(res.guardrails.policies.length).toBeGreaterThan(0);
  });
});
