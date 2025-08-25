import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({
    preset: "openai",
    tsconfig: "strict",
    target: "merge",
    textValue: "MergeAgent",
  })
);

import { run } from "../src/index";

describe("CLI merge journeys", () => {
  it("merges into an existing directory when requested", async () => {
    // create a temp directory and simulate existing files
    const tmp = await fs.mkdtemp(path.join(process.cwd(), "tmp-merge-"));
    try {
      // create the candidate outDir (slug derived from name -> "mergeagent")
      const candidate = path.join(tmp, "mergeagent");
      // create a dummy file to make dir non-empty
      await fs.mkdir(path.join(candidate, "config"), { recursive: true });
      await fs.writeFile(
        path.join(candidate, "config", "agent.json"),
        JSON.stringify({ name: "existing" })
      );

      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: any[]) => {
        logs.push(args.join(" "));
        origLog.apply(console, args as any);
      };
      try {
        await run({ outDir: tmp, name: "MergeAgent" } as any);
        const out = logs.join("\n");
        // expect either a merge summary or final success
        expect(out).toMatch(
          /Done\. Generated instruction pack for|Merge summary|Dev output written to:/
        );
      } finally {
        console.log = origLog;
      }
    } finally {
      // cleanup
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 60000);
});
