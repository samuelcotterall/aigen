import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Mock @clack/prompts for this integration scenario. We want to simulate the
// interactive flow where the target directory exists and the user chooses
// "merge" so the writer will perform merges and create .bak backups.
vi.mock("@clack/prompts", async () => {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    isCancel: () => false,
    select: vi.fn().mockImplementation((opts: any) => {
      if (opts.message?.includes("Choose a preset"))
        return Promise.resolve("openai");
      if (opts.message?.includes("TypeScript strictness"))
        return Promise.resolve("strict");
      if (opts.message?.includes("Target") && opts.options)
        return Promise.resolve("merge");
      // default to initialValue when present
      return Promise.resolve(
        opts.initialValue ?? (opts.options && opts.options[0]?.value)
      );
    }),
    multiselect: vi.fn().mockResolvedValue([]),
    text: vi.fn().mockResolvedValue("done"),
  };
});

import { run } from "../../src/index";

describe("integration: merge on disk", () => {
  it("merges JSON and markdown on disk and creates backups", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "create-agent-test-"));
    const candidate = path.join(tmp, "my-agent");
    await fs.mkdir(candidate, { recursive: true });

    // create config/agent.json with an existing tool and a meta field
    const cfgDir = path.join(candidate, "config");
    await fs.mkdir(cfgDir, { recursive: true });
    const existingCfg = {
      name: "My Agent",
      tools: [{ name: "search", description: "old" }],
      meta: { a: 1 },
    };
    await fs.writeFile(
      path.join(cfgDir, "agent.json"),
      JSON.stringify(existingCfg, null, 2)
    );

    // policies.md with a top-level header and a policy section
    const policies = `# Policies\n\n## Data retention\nDo not store secrets.`;
    await fs.writeFile(path.join(candidate, "policies.md"), policies);

    // tools.md listing one tool
    const toolsMd = `# Tools\n\n## search\nOld description`;
    await fs.writeFile(path.join(candidate, "tools.md"), toolsMd);

    // run the CLI programmatically, pointing out parent outDir (tmp). We set name
    // such that the candidate directory slug will resolve to "my-agent" and
    // the CLI will detect existing files and ask to merge (our mock returns merge).
    const opts = { outDir: tmp, name: "My Agent" } as any;
    await run(opts);

    // After run, expect backups to exist for merged files
    // Expect presence of a timestamped backup or the legacy .bak
    const cfgFiles = await fs.readdir(cfgDir);
    const agentBakMatch = cfgFiles.find(
      (n) => /agent\.json(\.|).*\.bak$/.test(n) || n === "agent.json.bak"
    );
    const candidateFiles = await fs.readdir(candidate);
    const policiesBakMatch = candidateFiles.find(
      (n) => /policies\.md(\.|).*\.bak$/.test(n) || n === "policies.md.bak"
    );
    expect(agentBakMatch).toBeTruthy();
    expect(policiesBakMatch).toBeTruthy();

    // Read merged agent.json and assert merged fields are present
    const mergedRaw = await fs.readFile(
      path.join(cfgDir, "agent.json"),
      "utf8"
    );
    const merged = JSON.parse(mergedRaw);
    // Keep original meta and also have new fields like slug or tools array merged
    expect(merged.meta).toBeDefined();
    expect(Array.isArray(merged.tools)).toBeTruthy();

    // policies.md should contain original section plus any incoming policies marker or additions
    const mergedPolicies = await fs.readFile(
      path.join(candidate, "policies.md"),
      "utf8"
    );
    expect(mergedPolicies).toContain("## Data retention");

    // cleanup
    await fs.rm(tmp, { recursive: true, force: true });
  }, 30000);
});
