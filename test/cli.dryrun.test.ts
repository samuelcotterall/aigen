import { describe, it, expect, vi } from "vitest";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({
    preset: "openai",
    tsconfig: "strict",
    textValue: "DryRunAgent",
  })
);

import { run } from "../src/index";

describe("CLI dry-run", () => {
  it("prints a preview and does not write files", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      origLog.apply(console, args as any);
    };

    try {
      await run({
        dryRun: true,
        outDir: "/tmp/nonexistent-output",
        name: "DryRun Agent",
      } as any);
      const out = logs.join("\n");
      expect(out).toMatch(/Dry run: \d+ files would be generated/);
      // ensure we didn't print a "Wrote X files to" summary
      expect(out).not.toContain("Wrote ");
    } finally {
      console.log = origLog;
    }
  });
});
